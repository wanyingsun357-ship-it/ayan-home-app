import Foundation
import Capacitor
import AVFoundation
import UIKit

// 通话时的音频会话:语音通话模式、允许蓝牙、听筒/扬声器切换、屏幕不自动锁
@objc(AudioSessionPlugin)
public class AudioSessionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AudioSessionPlugin"
    public let jsName = "AudioSession"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startCall", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endCall", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setSpeaker", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "route", returnType: CAPPluginReturnPromise),
    ]

    private func routeInfo() -> [String: Any] {
        let r = AVAudioSession.sharedInstance().currentRoute
        let outs = r.outputs.map { $0.portType.rawValue }
        let ins = r.inputs.map { $0.portType.rawValue }
        let speaker = outs.contains(AVAudioSession.Port.builtInSpeaker.rawValue)
        let bt = outs.contains(where: { $0.contains("Bluetooth") }) || ins.contains(where: { $0.contains("Bluetooth") })
        return ["outputs": outs, "inputs": ins, "speaker": speaker, "bluetooth": bt]
    }

    @objc func startCall(_ call: CAPPluginCall) {
        let speaker = call.getBool("speaker") ?? false
        let s = AVAudioSession.sharedInstance()
        do {
            try s.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth, .allowBluetoothA2DP, .duckOthers])
            try s.setActive(true, options: [])
            try s.overrideOutputAudioPort(speaker ? .speaker : .none)
            DispatchQueue.main.async { UIApplication.shared.isIdleTimerDisabled = true }
            call.resolve(routeInfo())
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func setSpeaker(_ call: CAPPluginCall) {
        let on = call.getBool("on") ?? false
        do {
            try AVAudioSession.sharedInstance().overrideOutputAudioPort(on ? .speaker : .none)
            call.resolve(routeInfo())
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func endCall(_ call: CAPPluginCall) {
        let s = AVAudioSession.sharedInstance()
        do {
            try s.overrideOutputAudioPort(.none)
            try s.setActive(false, options: [.notifyOthersOnDeactivation])
        } catch {}
        DispatchQueue.main.async { UIApplication.shared.isIdleTimerDisabled = false }
        call.resolve(routeInfo())
    }

    @objc func route(_ call: CAPPluginCall) {
        call.resolve(routeInfo())
    }
}

// 壳的主控制器:在这里把本地插件挂到桥上
class HomeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(AudioSessionPlugin())
    }
}
