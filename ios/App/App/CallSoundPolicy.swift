import Foundation

struct CallSoundDetection {
    var kind: String
    var confidence: Double
    var classIndex: Int
    var source = "yamnet"
    var continued = false
    var voicedRatio = 0.0
    var pitchHz = 0.0
    var clip = Data()
}

// Rules between the markers are generated from server/sound-whitelist.json.
struct CallSoundPolicy {
    // BEGIN GENERATED YAMNET RULES
    static let rules: [String: [Int: Double]] = [
        "water": [282: 0.35, 291: 0.35, 364: 0.4, 438: 0.35, 439: 0.35, 442: 0.3, 446: 0.35],
        "wet": [440: 0.3, 441: 0.25],
        "trickle": [443: 0.3, 444: 0.3],
        "flush": [368: 0.5],
        "slap": [58: 0.45, 454: 0.4, 461: 0.3],
        "whip": [466: 0.4],
        "vibration": [125: 0.4, 370: 0.35, 376: 0.35, 490: 0.45, 517: 0.3],
        "moan": [22: 0.3, 33: 0.3],
        "whimper": [21: 0.35],
        "pant": [36: 0.55, 40: 0.35],
        "gasp": [39: 0.4],
        "cry": [19: 0.4],
        "scream": [11: 0.45],
        "laugh": [13: 0.55, 15: 0.55, 16: 0.55, 17: 0.55, 18: 0.55],
        "sigh": [23: 0.55],
        "vocal": [:],
    ]
    static let humanClasses: [Int] = [0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 19, 20, 21, 22, 23, 32, 33, 34, 36, 38, 40, 41]
    // END GENERATED YAMNET RULES
    private var previous: [String: (time: Double, count: Int, lastEmission: Double?)] = [:]
    private var emitted: [String: Double] = [:]
    private var lastWindow = -Double.infinity

    static func candidates(scores: [Double]) -> [String: CallSoundDetection] {
        guard scores.count == 521 else { return [:] }
        var result: [String: CallSoundDetection] = [:]
        for (kind, classes) in rules {
            for (index, threshold) in classes where scores[index].isFinite && scores[index] >= threshold && scores[index] <= 1 {
                if scores[index] > (result[kind]?.confidence ?? -1) { result[kind] = CallSoundDetection(kind: kind, confidence: scores[index], classIndex: index) }
            }
        }
        return result
    }
    mutating func observe(_ candidates: [String: CallSoundDetection], time: Double) -> [CallSoundDetection] {
        guard time.isFinite, time > lastWindow else { return [] }
        lastWindow = time
        var result: [CallSoundDetection] = []
        for kind in Self.rules.keys.sorted() {
            guard var candidate = candidates[kind] else { previous[kind] = nil; continue }
            let prev = previous[kind], continuous = prev != nil && time - prev!.time <= 1.1
            let count = continuous ? prev!.count + 1 : 1
            let lastInRun = continuous ? prev!.lastEmission : nil
            previous[kind] = (time, count, lastInRun)
            if count >= 2 && time - (emitted[kind] ?? -.infinity) >= 4 {
                candidate.continued = lastInRun != nil
                result.append(candidate)
            }
        }
        let chosen = Array(result.sorted { $0.confidence > $1.confidence }.prefix(2))
        for item in chosen {
            emitted[item.kind] = time
            if let prev = previous[item.kind] { previous[item.kind] = (prev.time, prev.count, time) }
        }
        return chosen
    }
}

struct CallSoundASR {
    private var observations: [(at: Double, text: String)] = []
    mutating func add(_ text: String, at: Double) {
        observations.removeAll { at - $0.at > 6 }
        if !text.isEmpty { observations.append((at, String(text.prefix(400)))) }
        if observations.count > 80 { observations.removeFirst(observations.count - 80) }
    }
    func text(start: Double, end: Double) -> String {
        observations.filter { $0.at >= start - 0.1 && $0.at <= end + 1.6 }.map { $0.text }.joined()
    }
    static func hasWords(_ text: String) -> Bool {
        let fillers = Set("嗯啊呜哼唔呃哈呀哦噢喔诶欸额".unicodeScalars)
        let normalized = text.lowercased().replacingOccurrences(of: "\\b(uh|ah|um|hmm|mm|oh)\\b", with: "", options: .regularExpression)
        return normalized.unicodeScalars.contains { (CharacterSet.letters.contains($0) || CharacterSet.decimalDigits.contains($0)) && !fillers.contains($0) }
    }
}
