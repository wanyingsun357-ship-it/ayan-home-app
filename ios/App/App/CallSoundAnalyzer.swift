import Foundation
import AVFoundation
import SoundAnalysis

// Consumes the existing call's resampled PCM. It never opens an audio device,
// writes recordings, or touches the call's ASR/socket/audio-session ownership.
final class CallSoundAnalyzer {
    private let queue = DispatchQueue(label: "home.call.sound-analysis", qos: .utility)
    private let lock = NSLock()
    private var generation = UUID()
    private var accepting = false
    private var pending = 0
    // The following properties belong only to queue.
    private var analyzer: SNAudioStreamAnalyzer?
    private var observer: CallSoundObserver?
    private var policy = CallSoundPolicy()
    private var frame: AVAudioFramePosition = 0
    private let format = AVAudioFormat(standardFormatWithSampleRate: 16_000, channels: 1)!

    private func current(_ token: UUID) -> Bool {
        lock.lock(); defer { lock.unlock() }; return generation == token
    }
    func stop() {
        lock.lock(); generation = UUID(); accepting = false; lock.unlock()
        queue.async { self.analyzer?.removeAllRequests(); self.analyzer = nil; self.observer = nil; self.policy = CallSoundPolicy(); self.frame = 0 }
    }
    func start(ready: @escaping ([String]) -> Void, detection: @escaping (String, Double) -> Void, failed: @escaping () -> Void) {
        stop()
        lock.lock(); let token = generation; lock.unlock()
        queue.async {
            guard self.current(token) else { return }
            do {
                let request = try SNClassifySoundRequest(classifierIdentifier: .version1)
                request.windowDuration = CMTime(seconds: 1, preferredTimescale: 16_000)
                request.overlapFactor = 0.5
                let kinds = CallSoundPolicy.supportedKinds(labels: request.knownClassifications)
                guard !kinds.isEmpty else { throw URLError(.unsupportedURL) }
                let analyzer = SNAudioStreamAnalyzer(format: self.format)
                let observer = CallSoundObserver(result: { [weak self] result in
                    self?.queue.async { [weak self] in
                        guard let self = self, self.current(token) else { return }
                        let scores = Dictionary(result.classifications.map { ($0.identifier, $0.confidence) }, uniquingKeysWith: max)
                        let detections = self.policy.observe(scores: scores, time: CMTimeGetSeconds(result.timeRange.start))
                        for item in detections {
                            DispatchQueue.main.async { if self.current(token) { detection(item.kind, item.confidence) } }
                        }
                    }
                }, error: { [weak self] in
                    guard let self = self else { return }
                    DispatchQueue.main.async { if self.current(token) { failed() } }
                })
                try analyzer.add(request, withObserver: observer)
                guard self.current(token) else { analyzer.removeAllRequests(); return }
                self.analyzer = analyzer; self.observer = observer
                self.lock.lock(); if self.generation == token { self.accepting = true }; self.lock.unlock()
                DispatchQueue.main.async { if self.current(token) { ready(kinds) } }
            } catch { DispatchQueue.main.async { if self.current(token) { failed() } } }
        }
    }
    func feed(_ data: Data) {
        lock.lock()
        guard accepting, pending < 4 else { lock.unlock(); return }
        let token = generation; pending += 1; lock.unlock()
        queue.async {
            defer { self.lock.lock(); self.pending -= 1; self.lock.unlock() }
            guard self.current(token), let analyzer = self.analyzer else { return }
            let count = data.count / MemoryLayout<Int16>.size
            guard count > 0, let buffer = AVAudioPCMBuffer(pcmFormat: self.format, frameCapacity: AVAudioFrameCount(count)), let samples = buffer.floatChannelData?[0] else { return }
            buffer.frameLength = AVAudioFrameCount(count)
            data.withUnsafeBytes { raw in
                let pcm = raw.bindMemory(to: Int16.self)
                for i in 0..<count { samples[i] = Float(pcm[i]) / 32768 }
            }
            analyzer.analyze(buffer, atAudioFramePosition: self.frame)
            self.frame += AVAudioFramePosition(count)
        }
    }
}

private final class CallSoundObserver: NSObject, SNResultsObserving {
    private let result: (SNClassificationResult) -> Void
    private let error: () -> Void
    init(result: @escaping (SNClassificationResult) -> Void, error: @escaping () -> Void) { self.result = result; self.error = error }
    func request(_ request: SNRequest, didProduce result: SNResult) { if let result = result as? SNClassificationResult { self.result(result) } }
    func request(_ request: SNRequest, didFailWithError error: Error) { self.error() }
    func requestDidComplete(_ request: SNRequest) {}
}
