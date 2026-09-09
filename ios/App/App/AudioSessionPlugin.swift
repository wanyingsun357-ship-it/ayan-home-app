import Foundation
import Capacitor
import AVFoundation
import UIKit
import CoreLocation

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
        let s = AVAudioSession.sharedInstance()
        do {
            var opts: AVAudioSession.CategoryOptions = [.allowBluetooth, .allowBluetoothA2DP, .duckOthers]
            if on { opts.insert(.defaultToSpeaker) }
            try s.setCategory(.playAndRecord, mode: .voiceChat, options: opts)
            try s.setActive(true, options: [])
            try s.overrideOutputAudioPort(on ? .speaker : .none)
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
        bridge?.registerPluginInstance(LocationPlugin())
    }
}

// 定位:前台取当前位置;"始终"权限下监听显著位置变化(走到教学楼这种级别),后台也直接上报给桥
@objc(LocationPlugin)
public class LocationPlugin: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    public let identifier = "LocationPlugin"
    public let jsName = "Location"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "request", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "current", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startBackground", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopBackground", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
    ]
    private let manager = CLLocationManager()
    private var oneShot: CAPPluginCall?
    private var reportURL = "https://entangledforever.com/api/location"

    public override func load() {
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        manager.pausesLocationUpdatesAutomatically = true
    }
    private func authString() -> String {
        switch manager.authorizationStatus {
        case .authorizedAlways: return "always"
        case .authorizedWhenInUse: return "whenInUse"
        case .denied: return "denied"
        case .restricted: return "restricted"
        default: return "prompt"
        }
    }
    @objc func status(_ call: CAPPluginCall) { call.resolve(["auth": authString()]) }
    @objc func request(_ call: CAPPluginCall) {
        let always = call.getBool("always") ?? false
        if always { manager.requestAlwaysAuthorization() } else { manager.requestWhenInUseAuthorization() }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { call.resolve(["auth": self.authString()]) }
    }
    @objc func current(_ call: CAPPluginCall) {
        oneShot = call
        manager.requestLocation()
    }
    @objc func startBackground(_ call: CAPPluginCall) {
        if let u = call.getString("url") { reportURL = u }
        if manager.authorizationStatus == .authorizedAlways {
            manager.allowsBackgroundLocationUpdates = true
            manager.startMonitoringSignificantLocationChanges()
            call.resolve(["ok": true, "auth": authString()])
        } else {
            call.resolve(["ok": false, "auth": authString()])
        }
    }
    @objc func stopBackground(_ call: CAPPluginCall) {
        manager.stopMonitoringSignificantLocationChanges()
        call.resolve(["ok": true])
    }
    private func post(_ loc: CLLocation, src: String) {
        guard let url = URL(string: reportURL) else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: Any] = ["lat": loc.coordinate.latitude, "lng": loc.coordinate.longitude, "acc": loc.horizontalAccuracy, "src": src]
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        URLSession.shared.dataTask(with: req).resume()
    }
    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last else { return }
        if let call = oneShot {
            oneShot = nil
            call.resolve(["lat": loc.coordinate.latitude, "lng": loc.coordinate.longitude, "acc": loc.horizontalAccuracy])
            post(loc, src: "app")
        } else {
            post(loc, src: "bg")
        }
    }
    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        if let call = oneShot { oneShot = nil; call.reject(error.localizedDescription) }
    }
}
