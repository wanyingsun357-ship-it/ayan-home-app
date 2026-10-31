import Foundation
import OSLog
import UIKit
import AVFoundation
import PushKit
import LiveCommunicationKit
import Capacitor

@objc(NativeCallsPlugin)
public class NativeCallsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeCallsPlugin"
    public let jsName = "NativeCalls"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "configure", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startOutgoing", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "present", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "answer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setMuted", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setSpeaker", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setSoundEnabled", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getState", returnType: CAPPluginReturnPromise)
    ]
    public override func load() {
        if #available(iOS 17.4, *) { DispatchQueue.main.async { NativeCallService.shared.plugin = self } }
    }
    @objc func configure(_ call: CAPPluginCall) {
        guard #available(iOS 17.4, *) else { call.resolve(["supported": false]); return }
        DispatchQueue.main.async {
            let service = NativeCallService.shared
            service.plugin = self; service.start()
            call.resolve(service.state())
        }
    }
    @objc func getState(_ call: CAPPluginCall) {
        guard #available(iOS 17.4, *) else { call.resolve(["supported": false]); return }
        DispatchQueue.main.async { call.resolve(NativeCallService.shared.state()) }
    }
    @objc func present(_ call: CAPPluginCall) {
        guard #available(iOS 17.4, *), let info = call.getObject("native") else { call.reject("Native call unavailable"); return }
        Task { @MainActor in
            do { try await NativeCallService.shared.present(info); call.resolve(NativeCallService.shared.state()) }
            catch { call.reject("无法显示系统来电") }
        }
    }
    @objc func startOutgoing(_ call: CAPPluginCall) {
        guard #available(iOS 17.4, *), let info = call.getObject("native"), let current = call.getObject("call") else { call.reject("Native outgoing call unavailable"); return }
        Task { @MainActor in
            do { try await NativeCallService.shared.startOutgoing(info, call: current); call.resolve(NativeCallService.shared.state()) }
            catch { call.reject("系统拨出失败") }
        }
    }
    @objc func answer(_ call: CAPPluginCall) {
        guard #available(iOS 17.4, *) else { call.reject("Native call unavailable"); return }
        Task { @MainActor in
            do { try await NativeCallService.shared.answer(); call.resolve(["ok": true]) }
            catch { call.reject("接听失败") }
        }
    }
    @objc func end(_ call: CAPPluginCall) {
        guard #available(iOS 17.4, *) else { call.resolve(); return }
        Task { @MainActor in
            do { try await NativeCallService.shared.end(); call.resolve(["ok": true]) }
            catch { call.reject("挂断失败，请重试") }
        }
    }
    @objc func setMuted(_ call: CAPPluginCall) {
        guard #available(iOS 17.4, *) else { call.resolve(); return }
        Task { @MainActor in
            do { try await NativeCallService.shared.setMuted(call.getBool("muted") ?? false); call.resolve() }
            catch { call.reject("无法切换静音") }
        }
    }
    @objc func setSoundEnabled(_ call: CAPPluginCall) {
        guard #available(iOS 17.4, *) else { call.reject("Sound sensing unavailable"); return }
        DispatchQueue.main.async {
            NativeCallService.shared.setSoundEnabled(call.getBool("enabled") ?? false)
            call.resolve(NativeCallService.shared.state())
        }
    }
    @objc func setSpeaker(_ call: CAPPluginCall) {
        guard #available(iOS 17.4, *) else { call.resolve(); return }
        DispatchQueue.main.async {
            do { try AVAudioSession.sharedInstance().overrideOutputAudioPort((call.getBool("on") ?? false) ? .speaker : .none); call.resolve() }
            catch { call.reject("无法切换音频输出") }
        }
    }
}

@available(iOS 17.4, *)
@MainActor final class NativeCallService: NSObject, PKPushRegistryDelegate, ConversationManagerDelegate, AVAudioPlayerDelegate {
    static let shared = NativeCallService()
    weak var plugin: NativeCallsPlugin?
    private let origin = "https://entangledforever.com"
    private var manager: ConversationManager!
    private var registry: PKPushRegistry?
    private var voipToken = ""
    private var info: [String: Any]?
    private var currentCall: [String: Any]?
    private var outgoing = false
    private let log = Logger(subsystem: "com.entangledforever.home", category: "NativeCalls")
    private var joined = false
    private var audioActive = false
    var muted = false
    private var player: AVAudioPlayer?
    private var engine: AVAudioEngine?
    private var socket: URLSessionWebSocketTask?
    private var socketGeneration = UUID()
    private var pcm: [Data] = []
    private var sendingPCM = false
    private var polling: Task<Void, Never>?
    private var ringTimeout: Task<Void, Never>?
    private var flushTask: Task<Void, Never>?
    private var partialFinals = ""
    private var sayQueue: [String] = []
    private var waitingReply = false
    private var replyTimeout: Task<Void, Never>?
    private var played = Set<String>()
    private var playQueue: [[String: Any]] = []
    private var loadingAudio = false
    private var pendingHangup = false
    private var systemTitle = ""
    private var endingRemotely = false
    private let soundAnalyzer = CallSoundAnalyzer()
    private var soundPreference = CallSoundPreference()
    private var soundEnabled: Bool { soundPreference.enabled }
    private var soundListening = false
    private var soundFailed = false
    private var soundKinds: [String] = []
    private var soundSettingKey = ""
    private var soundRevision = 0
    private var soundGeneration = UUID()
    private var soundSync: Task<Void, Never>?
    private var soundRequests: [UUID: Task<Void, Never>] = [:]
    private var soundHealthRequest: Task<Void, Never>?
    private var soundHealthID: UUID?

    func setSoundEnabled(_ enabled: Bool) {
        soundPreference.set(enabled); soundFailed = false
        soundSettingKey = ""; refreshSoundCapture(); emit("soundState")
    }
    private var maySenseSound: Bool { soundEnabled && !soundFailed && joined && audioActive && !muted && player == nil && !loadingAudio }
    private func stopSoundCapture() {
        soundGeneration = UUID(); soundListening = false; soundAnalyzer.stop()
        soundSync?.cancel(); soundSync = nil
        for task in soundRequests.values { task.cancel() }; soundRequests.removeAll()
        soundHealthRequest?.cancel(); soundHealthRequest = nil; soundHealthID = nil
    }
    private func refreshSoundCapture() {
        if let input = engine?.inputNode, input.isVoiceProcessingEnabled, input.isVoiceProcessingBypassed != soundEnabled {
            // Keep environmental sounds in the shared mic tap. Playback/mute
            // still send silence to ASR and invalidate the sensing epoch.
            input.isVoiceProcessingBypassed = soundEnabled
        }
        let wanted = maySenseSound
        guard joined, let id = callID else { stopSoundCapture(); soundSettingKey = ""; return }
        let reason = !soundEnabled ? "disabled" : soundFailed ? "analysis_failed" : !audioActive ? "audio_inactive" : muted ? "muted" : (player != nil || loadingAudio) ? "playback" : "listening"
        let key = "\(id)|\(soundEnabled)|\(wanted)|\(reason)"
        guard key != soundSettingKey else { return }
        stopSoundCapture(); soundSettingKey = key; soundRevision += 1
        let revision = soundRevision, token = soundGeneration, enabled = soundEnabled
        soundSync = Task { @MainActor in
            do {
                _ = try await self.request("sound-setting", body: ["enabled": enabled, "capturing": wanted, "revision": revision, "model": "yamnet-v1", "saveClips": true, "reason": reason, "nativeBuild": Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "0"])
                guard !Task.isCancelled, self.callID == id, self.soundGeneration == token, wanted, self.maySenseSound else { return }
                // Let playback echo settle before starting a fresh classification window.
                try await Task.sleep(nanoseconds: 700_000_000)
                guard !Task.isCancelled, self.soundGeneration == token, self.maySenseSound else { return }
                self.soundAnalyzer.start(ready: { [weak self] kinds in
                    guard let self = self, self.soundGeneration == token, self.maySenseSound else { return }
                    self.soundKinds = kinds; self.soundListening = true; self.emit("soundState")
                }, detection: { [weak self] detection in
                    self?.reportSound(detection, revision: revision, generation: token)
                }, failed: { [weak self] in
                    guard let self = self, self.soundGeneration == token else { return }
                    self.soundFailed = true; self.soundSettingKey = ""; self.refreshSoundCapture(); self.emit("soundState")
                }, health: { [weak self] data in
                    self?.reportSoundHealth(data, revision: revision, generation: token)
                })
            } catch {
                guard !Task.isCancelled, self.callID == id, self.soundGeneration == token else { return }
                self.soundSettingKey = ""; self.emit("soundState") // next state poll can retry
            }
        }
    }
    private func reportSoundHealth(_ data: [String: Any], revision: Int, generation: UUID) {
        guard maySenseSound, soundListening, soundGeneration == generation, let id = callID, soundHealthRequest == nil else { return }
        let requestID = UUID(); soundHealthID = requestID
        var body = data; body["revision"] = revision
        body["voiceProcessingEnabled"] = engine?.inputNode.isVoiceProcessingEnabled ?? false
        body["voiceProcessingBypassed"] = engine?.inputNode.isVoiceProcessingBypassed ?? false
        soundHealthRequest = Task { @MainActor in
            defer { if self.soundHealthID == requestID { self.soundHealthRequest = nil; self.soundHealthID = nil } }
            guard !Task.isCancelled, self.callID == id, self.soundGeneration == generation else { return }
            _ = try? await self.request("sound-health", body: body)
        }
    }
    private func reportSound(_ detection: CallSoundDetection, revision: Int, generation: UUID) {
        guard maySenseSound, soundListening, soundGeneration == generation, let id = callID, soundRequests.count < 2 else { return }
        let event = UUID()
        soundRequests[event] = Task { @MainActor in
            defer { self.soundRequests[event] = nil }
            guard !Task.isCancelled, self.callID == id, self.soundGeneration == generation else { return }
            var body: [String: Any] = ["eventId": event.uuidString, "kind": detection.kind, "confidence": detection.confidence, "revision": revision, "classIndex": detection.classIndex, "source": detection.source, "continued": detection.continued]
            if detection.clip.count >= 32044 { body["clipWav"] = detection.clip.base64EncodedString() }
            if detection.source == "vocal-heuristic" { body["evidence"] = ["voicedRatio": detection.voicedRatio, "pitchHz": detection.pitchHz, "asrWords": false] }
            do { _ = try await self.request("sound", body: body) }
            catch {
                // Drop this observation. If the service restarted or the network
                // lost a setting, synchronize a new epoch rather than replay it.
                guard !Task.isCancelled, self.callID == id, self.soundGeneration == generation, self.maySenseSound else { return }
                self.soundSettingKey = ""; self.refreshSoundCapture(); self.emit("soundState")
            }
        }
    }
    private var registrationID: String {
        if let value = UserDefaults.standard.string(forKey: "native-call-device-id") { return value }
        let value = UUID().uuidString; UserDefaults.standard.set(value, forKey: "native-call-device-id"); return value
    }
    private var callID: String? { info?["callId"] as? String }
    private var uuid: UUID? { (info?["uuid"] as? String).flatMap(UUID.init(uuidString:)) }
    private var conversation: Conversation? { manager?.conversations.first(where: { $0.uuid == uuid }) }

    func start() {
        guard registry == nil else { return }
        manager = ConversationManager(configuration: .init(ringtoneName: nil, iconTemplateImageData: nil, maximumConversationGroups: 1, maximumConversationsPerConversationGroup: 1, includesConversationInRecents: false, supportsVideo: false, supportedHandleTypes: [.generic]))
        manager.delegate = self
        let push = PKPushRegistry(queue: .main); push.delegate = self; push.desiredPushTypes = [.voIP]; registry = push
    }
    func state() -> [String: Any] {
        var result: [String: Any] = ["supported": true, "deviceId": registrationID, "token": voipToken, "mediaOwned": joined || outgoing, "supportsOutgoing": true, "muted": muted, "supportsSoundSensing": true, "soundModel": "yamnet-v1", "soundClips": true, "soundRetentionDays": 7, "soundEnabled": soundEnabled, "soundListening": soundListening, "soundFailed": soundFailed, "soundCategories": soundKinds]
        #if DEBUG
        result["environment"] = "sandbox"
        #else
        result["environment"] = "production"
        #endif
        if let call = currentCall { result["call"] = call }
        if let id = callID { result["callId"] = id }
        return result
    }
    private func emit(_ type: String, _ extras: [String: Any] = [:]) {
        var result = state(); result["type"] = type
        for (key, value) in extras { result[key] = value }
        plugin?.notifyListeners("event", data: result)
    }
    func pushRegistry(_ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials, for type: PKPushType) {
        guard type == .voIP else { return }
        voipToken = pushCredentials.token.map { String(format: "%02x", $0) }.joined(); emit("token")
    }
    func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {
        voipToken = ""; emit("tokenInvalidated")
    }
    // Use PushKit's async delegate directly. No detached Task and no completion
    // signalled before the awaited system report has completed.
    @MainActor func pushRegistry(_ registry: PKPushRegistry, didReceiveIncomingPushWith payload: PKPushPayload, for type: PKPushType) async {
        guard type == .voIP else { return }
        let value = payload.dictionaryPayload.reduce(into: [String: Any]()) { if let key = $1.key as? String { $0[key] = $1.value } }
        await reportRequiredPush(value)
    }
    private func validInfo(_ value: [String: Any]) -> Bool {
        guard let id = value["callId"] as? String, id.hasPrefix("call-"), let raw = value["uuid"] as? String, UUID(uuidString: raw) != nil, let token = value["token"] as? String else { return false }
        return token.count == 64
    }
    private func reportRequiredPush(_ value: [String: Any]) async {
        start()
        let reportedUUID = (value["uuid"] as? String).flatMap(UUID.init(uuidString:)) ?? UUID()
        let handle = Handle(type: .generic, value: "晏白", displayName: "晏白邀请你语音通话")
        log.notice("VoIP push: beginning required system report")
        // Never reuse the UI/SSE dedup return here: every required push must reach
        // the system reporter, including duplicates, conflicts and invalid data.
        do { try await manager.reportNewIncomingConversation(uuid: reportedUUID, update: .init(members: [handle], capabilities: [])) }
        catch { log.error("VoIP report rejected: \(String(describing: error), privacy: .public)"); return }
        log.notice("VoIP push: system report completed")
        guard validInfo(value) else { endReported(reportedUUID); return }
        if info != nil {
            if callID != value["callId"] as? String { endReported(reportedUUID) }
            return
        }
        adoptIncoming(value)
    }
    private func endReported(_ id: UUID) {
        if let c = manager.conversations.first(where: { $0.uuid == id }) { manager.reportConversationEvent(.conversationEnded(Date(), .failed), for: c) }
        log.notice("VoIP push: rejected invalid or conflicting conversation")
    }
    private func adoptIncoming(_ value: [String: Any]) {
        soundPreference.beginCall()
        stopSoundCapture(); soundSettingKey = ""; soundFailed = false
        info = value; outgoing = false; joined = false; muted = false; played.removeAll(); playQueue.removeAll()
        systemTitle = "晏白邀请你语音通话"
        emit("ringing"); poll()
        let id = callID
        ringTimeout?.cancel()
        ringTimeout = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 46_000_000_000)
            guard !Task.isCancelled, self.callID == id, !self.joined else { return }
            self.finish(reason: .unanswered)
        }
    }
    func present(_ value: [String: Any]) async throws {
        start()
        guard validInfo(value), let raw = value["uuid"] as? String, let newUUID = UUID(uuidString: raw) else { throw URLError(.badServerResponse) }
        if callID == value["callId"] as? String { return }
        guard info == nil else { throw URLError(.cannotConnectToHost) }
        let handle = Handle(type: .generic, value: "晏白", displayName: "晏白邀请你语音通话")
        try await manager.reportNewIncomingConversation(uuid: newUUID, update: .init(members: [handle], capabilities: []))
        if info == nil { adoptIncoming(value) }
    }
    func startOutgoing(_ value: [String: Any], call: [String: Any]) async throws {
        start()
        guard validInfo(value), let raw = value["uuid"] as? String, let id = UUID(uuidString: raw), call["by"] as? String == "her" else { throw URLError(.badServerResponse) }
        if callID == value["callId"] as? String, outgoing { return }
        guard info == nil else { throw URLError(.cannotConnectToHost) }
        soundPreference.beginCall()
        stopSoundCapture(); soundSettingKey = ""; soundFailed = false
        info = value; currentCall = call; outgoing = true; joined = false; muted = false; played.removeAll(); playQueue.removeAll()
        let handle = Handle(type: .generic, value: "晏白", displayName: "晏白：呼叫中")
        do { try await manager.perform([StartConversationAction(conversationUUID: id, handles: [handle], isVideo: false)]) }
        catch { info = nil; currentCall = nil; outgoing = false; throw error }
        emit("state"); poll()
    }
    func answer() async throws {
        guard let uuid = uuid else { throw URLError(.resourceUnavailable) }
        try await manager.perform([JoinConversationAction(conversationUUID: uuid)])
    }
    private func transcript(_ text: String) -> String {
        text.replacingOccurrences(of: #"\[[^\]\r\n]*\]"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: #"\[[^\]\r\n]*$"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: #"[ \t]{2,}"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
    private func updateSystemTitle(_ title: String) {
        guard joined, let conversation = conversation, systemTitle != title else { return }
        let handle = Handle(type: .generic, value: title, displayName: title)
        manager.reportConversationEvent(.conversationUpdated(.init(members: [handle], activeRemoteMembers: [handle])), for: conversation)
        systemTitle = title
    }
    private func showSystemSpeech(text: String, zh: String) {
        let translated = transcript(zh)
        let line = (translated.isEmpty ? "正在说话…" : translated).replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
        let snippet = String(line.prefix(96)) + (line.count > 96 ? "…" : "")
        updateSystemTitle(snippet.isEmpty ? "晏白" : "晏白：" + snippet)
    }
    func end() async throws {
        guard let uuid = uuid else { return }
        try await manager.perform([EndConversationAction(conversationUUID: uuid)])
    }
    func setMuted(_ value: Bool) async throws {
        guard let uuid = uuid else { return }
        try await manager.perform([MuteConversationAction(conversationUUID: uuid, isMuted: value)])
    }
    private func request(_ endpoint: String, body: [String: Any]? = nil) async throws -> Data {
        guard let id = callID, let token = info?["token"] as? String else { throw URLError(.userAuthenticationRequired) }
        var url = origin + "/api/native-call/" + endpoint
        if body == nil { url += "?id=" + id }
        var req = URLRequest(url: URL(string: url)!); req.timeoutInterval = endpoint == "audio" ? 65 : 15
        req.setValue("Bearer " + token, forHTTPHeaderField: "Authorization")
        if var payload = body { payload["id"] = id; req.httpMethod = "POST"; req.setValue("application/json", forHTTPHeaderField: "Content-Type"); req.httpBody = try JSONSerialization.data(withJSONObject: payload) }
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let response = response as? HTTPURLResponse, (200..<300).contains(response.statusCode) else { throw URLError(.badServerResponse) }
        return data
    }
    func conversationManagerDidBegin(_ manager: ConversationManager) {}
    func conversationManagerDidReset(_ manager: ConversationManager) { finish(reason: .failed) }
    func conversationManager(_ manager: ConversationManager, conversationChanged conversation: Conversation) {}
    func conversationManager(_ manager: ConversationManager, timedOutPerforming action: ConversationAction) { action.fail(); finish(reason: .failed) }
    func conversationManager(_ manager: ConversationManager, didActivate audioSession: AVAudioSession) {
        audioActive = true
        do { try beginMic() } catch { emit("error", ["message": "麦克风未能启动"]) }
        pumpAudio()
    }
    func conversationManager(_ manager: ConversationManager, didDeactivate audioSession: AVAudioSession) { audioActive = false; stopMic(); refreshSoundCapture() }
    func conversationManager(_ manager: ConversationManager, perform action: ConversationAction) {
        guard action.conversationUUID == uuid else { action.fail(); return }
        if let starting = action as? StartConversationAction {
            guard outgoing else { starting.fail(); return }
            Task { @MainActor in
                do {
                    let id = self.callID
                    let granted = await withCheckedContinuation { continuation in AVAudioSession.sharedInstance().requestRecordPermission { continuation.resume(returning: $0) } }
                    guard granted, id == self.callID else { throw URLError(.noPermissionsToReadFile) }
                    try AVAudioSession.sharedInstance().setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth, .allowBluetoothA2DP])
                    if let c = self.conversation { manager.reportConversationEvent(.conversationStartedConnecting(Date()), for: c) }
                    starting.fulfill(); self.emit("state"); self.poll()
                } catch { starting.fail(); self.finish(reason: .failed) }
            }
        } else if let join = action as? JoinConversationAction {
            Task { @MainActor in
                do {
                    let id = self.callID
                    let granted = await withCheckedContinuation { continuation in AVAudioSession.sharedInstance().requestRecordPermission { continuation.resume(returning: $0) } }
                    guard granted else { throw URLError(.noPermissionsToReadFile) }
                    try AVAudioSession.sharedInstance().setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth, .allowBluetoothA2DP])
                    if let c = self.conversation { manager.reportConversationEvent(.conversationStartedConnecting(Date()), for: c) }
                    let data = try await self.request("action", body: ["action": "answer"])
                    guard id == self.callID else { join.fail(); return }
                    if let result = try JSONSerialization.jsonObject(with: data) as? [String: Any] { self.currentCall = result["call"] as? [String: Any] }
                    self.joined = true; self.ringTimeout?.cancel()
                    if let c = self.conversation { manager.reportConversationEvent(.conversationConnected(Date()), for: c) }
                    self.updateSystemTitle("晏白：通话中")
                    join.fulfill(dateConnected: Date()); self.emit("answered")
                    if self.audioActive { try self.beginMic() }; self.poll()
                } catch { join.fail(); self.finish(reason: .failed) }
            }
        } else if let mute = action as? MuteConversationAction {
            muted = mute.isMuted; soundPreference.microphone(muted: muted); if !muted { soundFailed = false }; partialFinals = ""; flushTask?.cancel(); refreshSoundCapture(); mute.fulfill(); emit("state")
        } else if let ending = action as? EndConversationAction {
            let decline = !joined && !outgoing
            Task { @MainActor in
                do {
                    _ = try await self.request("action", body: ["action": decline ? "decline" : "end"])
                    ending.fulfill(dateEnded: Date()); self.finish(reason: .remoteEnded)
                } catch { ending.fail(); self.emit("error", ["message": "挂断未送达，请重试"]) }
            }
        } else { action.fail() }
    }
    private func poll() {
        polling?.cancel(); let id = callID
        polling = Task { @MainActor in
            while !Task.isCancelled && self.callID == id {
                do {
                    let data = try await self.request("state")
                    guard !Task.isCancelled, self.callID == id else { return }
                    if let result = try JSONSerialization.jsonObject(with: data) as? [String: Any], let call = result["call"] as? [String: Any] {
                        self.currentCall = call; self.emit("state")
                        if call["status"] as? String == "ended" { self.finish(reason: .remoteEnded); return }
                        if self.outgoing && !self.joined && call["status"] as? String == "active" {
                            self.joined = true
                            if let c = self.conversation { self.manager.reportConversationEvent(.conversationConnected(Date()), for: c) }
                            self.updateSystemTitle("晏白：通话中")
                            if self.audioActive { try self.beginMic() }
                        }
                        if self.joined {
                            self.refreshSoundCapture()
                            for entry in (call["entries"] as? [[String: Any]] ?? []).filter({ $0["who"] as? String == "him" }) {
                                if let stamp = entry["t"] as? String, !self.played.contains(stamp) { self.played.insert(stamp); self.playQueue.append(entry); self.waitingReply = false; self.replyTimeout?.cancel() }
                            }
                            self.pendingHangup = call["hangupPending"] as? Bool ?? false
                            self.pumpAudio(); self.sendNext()
                        }
                    }
                } catch { if !Task.isCancelled { self.emit("connection", ["message": "正在重连电话"]) } }
                try? await Task.sleep(nanoseconds: 1_200_000_000)
            }
        }
    }
    private func pumpAudio() {
        guard joined, audioActive, player == nil, !loadingAudio else { return }
        guard !playQueue.isEmpty else {
            if pendingHangup && !endingRemotely {
                endingRemotely = true
                Task { @MainActor in
                    do { _ = try await self.request("action", body: ["action": "played-hangup"]); self.finish(reason: .remoteEnded) }
                    catch { self.endingRemotely = false }
                }
            }
            return
        }
        let entry = playQueue.removeFirst(), id = callID
        guard let stamp = entry["t"] as? String else { return }
        loadingAudio = true; refreshSoundCapture(); flushTask?.cancel(); partialFinals = ""
        Task { @MainActor in
            defer { self.loadingAudio = false }
            do {
                let data = try await self.request("audio", body: ["entryTime": stamp])
                guard self.callID == id, self.joined else { return }
                let player = try AVAudioPlayer(data: data); self.player = player; player.delegate = self
                if !player.play() { throw URLError(.cannotDecodeContentData) }
                let text = entry["text"] as? String ?? "", zh = entry["zh"] as? String ?? ""
                self.showSystemSpeech(text: text, zh: zh)
                self.emit("speaking", ["text": self.transcript(text), "zh": self.transcript(zh)])
            } catch {
                self.player = nil; self.soundSettingKey = ""; self.updateSystemTitle("晏白：通话中"); self.emit("error", ["message": "这句语音未能播放，文字仍在通话记录里"])
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { self.pumpAudio() }
            }
        }
    }
    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        self.player = nil; partialFinals = ""; updateSystemTitle("晏白"); emit("listening"); pumpAudio(); refreshSoundCapture()
    }
    private func beginMic() throws {
        guard joined, audioActive, engine == nil else { return }
        let engine = AVAudioEngine(), input = engine.inputNode
        try? input.setVoiceProcessingEnabled(true)
        if input.isVoiceProcessingEnabled { input.isVoiceProcessingBypassed = soundEnabled }
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else { throw URLError(.cannotDecodeContentData) }
        input.installTap(onBus: 0, bufferSize: 2048, format: format) { [weak self] buffer, _ in
            guard let floats = buffer.floatChannelData?[0] else { return }
            let ratio = buffer.format.sampleRate / 16000, count = Int(Double(buffer.frameLength) / ratio)
            guard count > 0 else { return }
            var values = [Int16](repeating: 0, count: count)
            for i in 0..<count { let x = max(-1, min(1, floats[min(Int(Double(i) * ratio), Int(buffer.frameLength) - 1)])); values[i] = Int16(x * (x < 0 ? 32768 : 32767)) }
            let data = values.withUnsafeBytes { Data($0) }
            DispatchQueue.main.async { self?.sendPCM(data) }
        }
        self.engine = engine; engine.prepare(); try engine.start(); connectASR(); refreshSoundCapture()
    }
    private func connectASR() {
        guard joined, audioActive else { return }
        soundAnalyzer.setASRAvailable(false)
        socket?.cancel(with: .goingAway, reason: nil); socketGeneration = UUID(); let generation = socketGeneration
        let ws = URLSession.shared.webSocketTask(with: URL(string: "wss://entangledforever.com/ws/asr")!); socket = ws; ws.resume()
        Task { @MainActor in
            do {
                while self.joined && generation == self.socketGeneration {
                    let message = try await ws.receive()
                    guard generation == self.socketGeneration else { return }
                    let data: Data
                    switch message { case .string(let s): data = Data(s.utf8); case .data(let d): data = d; @unknown default: continue }
                    guard let event = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { continue }
                    if event["type"] as? String == "ready" { self.soundAnalyzer.setASRAvailable(true) }
                    if event["type"] as? String == "error" { throw URLError(.cannotConnectToHost) }
                    if self.muted || self.player != nil || self.loadingAudio { continue }
                    if self.maySenseSound, let text = event["text"] as? String, ["partial", "final"].contains(event["type"] as? String ?? "") { self.soundAnalyzer.observeASR(text) }
                    if event["type"] as? String == "partial" { self.emit("partial", ["text": event["text"] ?? ""]) }
                    if event["type"] as? String == "final", let text = event["text"] as? String {
                        self.partialFinals += text; self.flushTask?.cancel()
                        self.flushTask = Task { @MainActor in
                            try? await Task.sleep(nanoseconds: 1_000_000_000)
                            guard !Task.isCancelled, self.joined else { return }
                            let text = self.partialFinals.trimmingCharacters(in: .whitespacesAndNewlines); self.partialFinals = ""
                            if !text.isEmpty { self.sayQueue.append(text); self.emit("partial", ["text": ""]); self.sendNext() }
                        }
                    }
                }
            } catch {
                guard self.joined, self.audioActive, generation == self.socketGeneration else { return }
                self.soundAnalyzer.setASRAvailable(false)
                self.emit("connection", ["message": "识别正在重连"])
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                if generation == self.socketGeneration { self.connectASR() }
            }
        }
    }
    private func sendPCM(_ data: Data) {
        guard joined, audioActive else { return }
        if maySenseSound && soundListening { soundAnalyzer.feed(data) }
        guard let socket = socket else { return }
        pcm.append((muted || player != nil || loadingAudio) ? Data(repeating: 0, count: data.count) : data)
        if pcm.count > 12 { pcm.removeFirst(pcm.count - 12) }
        guard !sendingPCM else { return }; sendingPCM = true
        let generation = socketGeneration
        Task { @MainActor in
            defer { self.sendingPCM = false }
            while !self.pcm.isEmpty && self.joined && generation == self.socketGeneration {
                let data = self.pcm.removeFirst()
                do { try await socket.send(.data(data)) } catch { self.pcm.removeAll(); break }
            }
        }
    }
    private func sendNext() {
        guard joined, !waitingReply, !sayQueue.isEmpty else { return }
        waitingReply = true; let text = sayQueue.removeFirst(), id = callID
        replyTimeout?.cancel()
        replyTimeout = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 90_000_000_000)
            guard !Task.isCancelled, self.callID == id, self.waitingReply else { return }
            self.waitingReply = false; self.emit("error", ["message": "回复暂时没有接上，可以再说一句"]); self.sendNext()
        }
        Task { @MainActor in
            do { _ = try await self.request("say", body: ["text": text]) }
            catch { guard self.callID == id else { return }; self.waitingReply = false; self.emit("error", ["message": "这句话未送达，请再说一次"]) }
        }
    }
    private func stopMic() {
        soundAnalyzer.setASRAvailable(false)
        socketGeneration = UUID(); socket?.cancel(with: .goingAway, reason: nil); socket = nil
        stopSoundCapture(); soundSettingKey = ""
        engine?.inputNode.removeTap(onBus: 0); engine?.stop(); engine = nil; pcm.removeAll(); flushTask?.cancel()
    }
    private func finish(reason: Conversation.EndedReason) {
        guard info != nil else { return }
        let c = conversation
        joined = false; outgoing = false; audioActive = false; polling?.cancel(); polling = nil; ringTimeout?.cancel(); ringTimeout = nil
        stopMic(); player?.stop(); player = nil; playQueue.removeAll(); sayQueue.removeAll(); loadingAudio = false; waitingReply = false; replyTimeout?.cancel(); pendingHangup = false; endingRemotely = false
        if let c = c { manager.reportConversationEvent(.conversationEnded(Date(), reason), for: c) }
        emit("ended"); info = nil; currentCall = nil; systemTitle = ""
    }
}

