import Foundation

func spin(_ seconds: Double) { RunLoop.current.run(until: Date().addingTimeInterval(seconds)) }
func pcm(_ n: Int) -> Data {
    var data = Data(); for i in 0..<n { var sample = Int16(1000*sin(2*Double.pi*220*Double(i)/16000)).littleEndian; withUnsafeBytes(of: &sample) { data.append(contentsOf: $0) } }; return data
}
var ready = false, failed = false, hits: [CallSoundDetection] = [], predictionCount = 0
let analyzer = CallSoundAnalyzer(predict: { patch in
    precondition(patch.count == 15600); predictionCount += 1
    var scores = [Double](repeating: 0, count: 521); scores[282] = 0.8; return scores
})
func start() {
    ready = false
    analyzer.start(ready: { kinds in precondition(kinds.contains("water") && kinds.contains("moan")); ready = true }, detection: { hits.append($0) }, failed: { failed = true })
    spin(0.1); precondition(ready && !failed)
}
analyzer.feed(pcm(16000)); spin(0.1); precondition(predictionCount == 0, "Default off does not collect")
start(); analyzer.feed(pcm(16000)); spin(0.5); analyzer.feed(pcm(8000)); spin(1.8)
precondition(hits.count == 1 && hits[0].kind == "water", "Two consecutive model windows emit one observation")
precondition(hits[0].clip.count == 44+23280*2, "Clip ends at the exact model window and never includes future audio")
analyzer.stop(); let previous = predictionCount; analyzer.feed(pcm(16000)); spin(0.1); precondition(predictionCount == previous)
hits = []; start(); analyzer.feed(pcm(16000)); spin(0.5); analyzer.feed(pcm(8000)); spin(0.1); analyzer.stop(); spin(1.8)
precondition(hits.isEmpty, "Pause cancels pending delayed windows and their clips")
start(); analyzer.feed(pcm(16000)); spin(1.8); precondition(hits.isEmpty, "A new epoch cannot reuse the previous epoch's first window")
analyzer.stop(); precondition(!failed)
print("Shared PCM analysis, exact-window WAV, default-off and capture epoch cancellation passed")
