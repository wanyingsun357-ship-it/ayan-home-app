import Foundation

// This policy also runs as a standalone Swift test without a microphone.
struct CallSoundPolicy {
    static let aliases: [String: [String]] = [
        "laugh": ["laughter", "laughing", "giggle", "giggles", "chuckle", "human_laughter"],
        "breath": ["breathing", "breath", "pant", "panting", "human_breathing"],
        "sigh": ["sigh", "sighing", "human_sigh"],
        "gasp": ["gasp", "gasping", "human_gasp"],
        "cry": ["crying", "sobbing", "crying_sobbing", "human_crying"]
    ]
    static let thresholds: [String: Double] = ["laugh": 0.55, "breath": 0.65, "sigh": 0.55, "gasp": 0.60, "cry": 0.60]
    private var previous: [String: (time: Double, count: Int)] = [:]
    private var emitted: [String: Double] = [:]
    private var lastWindow: Double = -.infinity

    static func supportedKinds(labels: [String]) -> [String] {
        let available = Set(labels)
        return aliases.keys.filter { kind in aliases[kind]!.contains(where: { available.contains($0) }) }.sorted()
    }
    mutating func observe(scores: [String: Double], time: Double) -> [(kind: String, confidence: Double)] {
        guard time.isFinite, time > lastWindow else { return [] }
        lastWindow = time
        var detections: [(kind: String, confidence: Double)] = []
        for kind in Self.aliases.keys.sorted() {
            let score = Self.aliases[kind]!.compactMap { scores[$0] }.filter { $0.isFinite && $0 >= 0 && $0 <= 1 }.max() ?? 0
            guard score >= Self.thresholds[kind]! else { previous[kind] = nil; continue }
            let prev = previous[kind]
            let count = (prev != nil && time - prev!.time <= 1.1) ? prev!.count + 1 : 1
            previous[kind] = (time, count)
            if count >= 2 && time - (emitted[kind] ?? -.infinity) >= 4 {
                emitted[kind] = time
                detections.append((kind, score))
            }
        }
        return Array(detections.prefix(2))
    }
}
