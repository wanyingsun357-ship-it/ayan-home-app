import Foundation

struct CallVocalFeatures {
    var voicedRatio: Double
    var pitchHz: Double
    var bandRatio: Double

    static func measure(_ samples: [Float]) -> CallVocalFeatures {
        guard samples.count >= 1024 else { return .init(voicedRatio: 0, pitchHz: 0, bandRatio: 0) }
        var active = 0, pitches: [Double] = []
        for offset in stride(from: 0, through: samples.count - 512, by: 320) {
            var energy = 0.0
            for i in 0..<512 { let x = Double(samples[offset+i]); energy += x*x }
            guard energy / 512 > 0.00001 else { continue }; active += 1
            var diff = [Double](repeating: 0, count: 108), total = 0.0
            for tau in 1...107 {
                var d = 0.0
                for j in 0..<400 { let x = Double(samples[offset+j] - samples[offset+j+tau]); d += x*x }
                diff[tau] = d
            }
            for tau in 1...107 { total += diff[tau]; diff[tau] = total > 0 ? diff[tau]*Double(tau)/total : 1 }
            var tau = 23
            while tau <= 107 {
                if diff[tau] < 0.35 { while tau < 107 && diff[tau+1] < diff[tau] { tau += 1 }; pitches.append(16000 / Double(tau)); break }
                tau += 1
            }
        }
        let ratio = active > 0 ? Double(pitches.count)/Double(active) : 0
        pitches.sort(); let pitch = pitches.isEmpty ? 0 : pitches[pitches.count/2]
        // Narrow-band real DFT via Goertzel; no FFT or complex-array allocation.
        let offset = samples.count-1024
        var window = [Double](repeating: 0, count: 1024)
        for i in 0..<1024 { window[i] = Double(samples[offset+i])*(0.5-0.5*cos(2*Double.pi*Double(i)/1024)) }
        var low = 0.0, high = 0.0
        for bin in 7...96 {
            let coefficient = 2*cos(2*Double.pi*Double(bin)/1024); var a = 0.0, b = 0.0
            for x in window { let next = x + coefficient*a - b; b = a; a = next }
            let energy = max(0,a*a+b*b-coefficient*a*b)
            if Double(bin)*16000/1024 < 500 { low += energy } else { high += energy }
        }
        return .init(voicedRatio: ratio, pitchHz: pitch, bandRatio: high/max(low,1e-12))
    }
    func infer(scores: [Double], text: String) -> CallSoundDetection? {
        guard scores.count == 521, voicedRatio >= 0.30, (150...700).contains(pitchHz), !CallSoundASR.hasWords(text) else { return nil }
        guard let index = CallSoundPolicy.humanClasses.filter({ scores[$0].isFinite && scores[$0] >= 0.12 && scores[$0] <= 1 }).max(by: { scores[$0] < scores[$1] }) else { return nil }
        let kind: String
        if text.contains("呜") { kind = "whimper" }
        else if text.contains(where: { "嗯哼唔呃".contains($0) }) { kind = "moan" }
        else if text.contains(where: { "啊哈呀".contains($0) }) { kind = "vocal" }
        else if [19,20,21].contains(index) { kind = "whimper" }
        else if (6...11).contains(index) { kind = "vocal" }
        else { kind = bandRatio >= 0.45 ? "vocal" : "moan" }
        return CallSoundDetection(kind: kind, confidence: scores[index], classIndex: index, source: "vocal-heuristic", voicedRatio: voicedRatio, pitchHz: pitchHz)
    }
}
