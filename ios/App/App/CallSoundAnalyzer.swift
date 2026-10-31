import Foundation
import CoreML

// Consumes the existing 16kHz call PCM tap. Model execution and the optional
// 3.5s in-memory hit buffer never own the microphone or the call audio session.
final class CallSoundAnalyzer {
    private let queue = DispatchQueue(label: "home.call.yamnet", qos: .utility)
    private let lock = NSLock()
    private var generation = UUID()
    private var accepting = false
    private var queued = 0
    // All remaining mutable state belongs to queue.
    private var model: MLModel?
    private let predictOverride: (([Float]) throws -> [Double])?
    private var asrAvailable = false
    init(predict: (([Float]) throws -> [Double])? = nil) { predictOverride = predict }
    private var samples: [Float] = []
    private var total = 0
    private var nextWindow = 15600
    private var policy = CallSoundPolicy()
    private var asr = CallSoundASR()
    private struct Window {
        var scores: [Double]
        var features: CallVocalFeatures
        var clip: Data
        var end: Double
        var asrReady: Bool
    }
    private var windows: [UUID: Window] = [:]
    private var detection: ((CallSoundDetection) -> Void)?
    private var failure: (() -> Void)?
    private var health: (([String: Any]) -> Void)?
    private var windowCount = 0

    private func current(_ token: UUID) -> Bool {
        lock.lock(); defer { lock.unlock() }; return generation == token
    }
    func stop() {
        lock.lock(); generation = UUID(); accepting = false; lock.unlock()
        queue.async {
            self.samples.removeAll(keepingCapacity: false); self.windows.removeAll()
            self.total = 0; self.nextWindow = 15600; self.policy = CallSoundPolicy(); self.asr = CallSoundASR()
            self.detection = nil; self.failure = nil
            self.health = nil; self.windowCount = 0
        }
    }
    func start(ready: @escaping ([String]) -> Void, detection: @escaping (CallSoundDetection) -> Void, failed: @escaping () -> Void, health: @escaping ([String: Any]) -> Void = { _ in }) {
        stop(); lock.lock(); let token = generation; lock.unlock()
        queue.async {
            guard self.current(token) else { return }
            do {
                if self.model == nil && self.predictOverride == nil {
                    guard let url = Bundle.main.url(forResource: "YAMNet", withExtension: "mlmodelc") else { throw URLError(.fileDoesNotExist) }
                    let config = MLModelConfiguration(); config.computeUnits = .all
                    self.model = try MLModel(contentsOf: url, configuration: config)
                    // Warm Core ML before accepting live buffers, so the first
                    // GPU/ANE compilation cannot overflow the PCM input queue.
                    _ = try self.predict([Float](repeating: 0, count: 15600))
                }
                if self.predictOverride == nil {
                    guard let input = self.model?.modelDescription.inputDescriptionsByName["waveform"], input.multiArrayConstraint?.shape == [15600] else { throw URLError(.cannotDecodeContentData) }
                }
                guard self.current(token) else { return }
                self.detection = detection; self.failure = failed; self.health = health
                self.lock.lock(); if self.generation == token { self.accepting = true }; self.lock.unlock()
                DispatchQueue.main.async { if self.current(token) { ready(CallSoundPolicy.rules.keys.sorted()) } }
            } catch { DispatchQueue.main.async { if self.current(token) { failed() } } }
        }
    }
    func observeASR(_ text: String) {
        lock.lock(); let token = generation, enabled = accepting; lock.unlock()
        guard enabled else { return }; let at = ProcessInfo.processInfo.systemUptime
        queue.async { if self.current(token) { self.asr.add(text, at: at) } }
    }
    func setASRAvailable(_ ready: Bool) {
        queue.async { self.asrAvailable = ready; if !ready { self.asr = CallSoundASR() } }
    }
    func feed(_ data: Data) {
        lock.lock()
        guard accepting else { lock.unlock(); return }
        let token = generation
        // Do not silently join audio across a dropped span: a fresh capture
        // epoch is required before another observation can be sent.
        guard queued < 8 else { accepting = false; lock.unlock(); queue.async { self.fail(token) }; return }
        queued += 1; lock.unlock()
        let receivedAt = ProcessInfo.processInfo.systemUptime
        queue.async {
            defer { self.lock.lock(); self.queued -= 1; self.lock.unlock() }
            guard self.current(token) else { return }
            do {
                let count = data.count / 2
                guard count > 0, count <= 16000, data.count % 2 == 0 else { throw URLError(.badServerResponse) }
                data.withUnsafeBytes { raw in
                    let pcm = raw.bindMemory(to: Int16.self)
                    for i in 0..<count { self.samples.append(Float(pcm[i])/32768) }
                }
                self.total += count
                if self.samples.count > 72000 { self.samples.removeFirst(self.samples.count-72000) }
                while self.total >= self.nextWindow {
                    let tail = self.total-self.nextWindow, endIndex = self.samples.count-tail, startIndex = endIndex-15600
                    guard startIndex >= 0 else { throw URLError(.cannotDecodeContentData) }
                    let patch = Array(self.samples[startIndex..<endIndex])
                    let started = ProcessInfo.processInfo.systemUptime
                    let scores = try self.predict(patch)
                    guard scores.count == 521 else { throw URLError(.cannotParseResponse) }
                    guard scores.allSatisfy({ $0.isFinite && $0 >= 0 && $0 <= 1 }) else { throw URLError(.cannotParseResponse) }
                    let features = CallVocalFeatures.measure(patch)
                    self.windowCount += 1
                    if self.windowCount == 1 || self.windowCount % 10 == 0 {
                        let top = scores.indices.max(by: { scores[$0] < scores[$1] }) ?? 0
                        let water = ["water", "wet", "trickle"].flatMap { Array(CallSoundPolicy.rules[$0]?.keys ?? Dictionary<Int, Double>().keys) }.map { scores[$0] }.max() ?? 0
                        let rms = sqrt(patch.reduce(0.0) { $0+Double($1)*Double($1) }/Double(patch.count))
                        let report: [String: Any] = ["samples": self.total, "windows": self.windowCount, "rmsDbfs": min(0,max(-120,20*log10(max(rms,0.000001)))), "topClass": top, "topConfidence": scores[top], "waterConfidence": water, "analysisMs": (ProcessInfo.processInfo.systemUptime-started)*1000]
                        let callback = self.health
                        DispatchQueue.main.async { if self.current(token) { callback?(report) } }
                    }
                    let end = receivedAt - Double(tail)/16000
                    let clipStart = max(0,endIndex-56000)
                    let clip = Self.wav(Array(self.samples[clipStart..<endIndex]))
                    let id = UUID(); self.windows[id] = Window(scores: scores, features: features, clip: clip, end: end, asrReady: self.asrAvailable)
                    guard self.windows.count <= 8 else { throw URLError(.resourceUnavailable) }
                    // ASR may arrive after the sound. Wait 1.5s before deciding
                    // that a pitched human vocalization contained no real words.
                    self.queue.asyncAfter(deadline: .now()+1.5) { self.evaluate(id, token: token) }
                    self.nextWindow += 7680
                }
            } catch { self.fail(token) }
        }
    }
    private func predict(_ patch: [Float]) throws -> [Double] {
        if let predict = predictOverride { return try predict(patch) }
        guard let model = model else { throw URLError(.fileDoesNotExist) }
        let input = try MLMultiArray(shape: [15600], dataType: .float32)
        let pointer = input.dataPointer.bindMemory(to: Float.self, capacity: 15600)
        for i in 0..<15600 { pointer[i] = patch[i] }
        let provider = try MLDictionaryFeatureProvider(dictionary: ["waveform": MLFeatureValue(multiArray: input)])
        let output = try model.prediction(from: provider)
        guard let name = output.featureNames.first, let values = output.featureValue(for: name)?.multiArrayValue, values.count == 521 else { throw URLError(.cannotParseResponse) }
        return (0..<521).map { values[$0].doubleValue }
    }
    private func evaluate(_ id: UUID, token: UUID) {
        guard current(token), let window = windows.removeValue(forKey: id) else { return }
        var candidates = CallSoundPolicy.candidates(scores: window.scores)
        let text = asr.text(start: window.end-0.975, end: window.end)
        if window.asrReady && asrAvailable, let inferred = window.features.infer(scores: window.scores, text: text), candidates[inferred.kind] == nil { candidates[inferred.kind] = inferred }
        for var item in policy.observe(candidates, time: window.end) {
            item.clip = window.clip; let callback = detection
            DispatchQueue.main.async { if self.current(token) { callback?(item) } }
        }
    }
    private func fail(_ token: UUID) {
        guard current(token) else { return }; let callback = failure
        samples.removeAll(); windows.removeAll(); policy = CallSoundPolicy(); asr = CallSoundASR()
        lock.lock(); accepting = false; lock.unlock()
        DispatchQueue.main.async { if self.current(token) { callback?() } }
    }
    static func wav(_ samples: [Float]) -> Data {
        var data = Data()
        func u16(_ x: UInt16) { var v = x.littleEndian; withUnsafeBytes(of: &v) { data.append(contentsOf: $0) } }
        func u32(_ x: UInt32) { var v = x.littleEndian; withUnsafeBytes(of: &v) { data.append(contentsOf: $0) } }
        data.append(contentsOf: "RIFF".utf8); u32(UInt32(36+samples.count*2)); data.append(contentsOf: "WAVEfmt ".utf8)
        u32(16); u16(1); u16(1); u32(16000); u32(32000); u16(2); u16(16)
        data.append(contentsOf: "data".utf8); u32(UInt32(samples.count*2))
        for sample in samples { let v = Int16(max(-32768,min(32767,Int(sample*32768)))); u16(UInt16(bitPattern: v)) }
        return data
    }
}
