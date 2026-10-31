import Foundation

var preference = CallSoundPreference()
precondition(preference.enabled, "Open microphone defaults to sensing")
preference.set(false); precondition(!preference.enabled, "Manual pause is available")
preference.microphone(muted: true); precondition(!preference.enabled)
preference.microphone(muted: false); precondition(preference.enabled, "Unmuting enables sensing again")
preference.set(false); preference.beginCall(); precondition(preference.enabled, "Each call starts enabled")

func scores(_ pairs: [Int: Double]) -> [Double] { var s = [Double](repeating: 0, count: 521); for (i,v) in pairs { s[i] = v }; return s }
func observe(_ policy: inout CallSoundPolicy, _ values: [Int: Double], _ time: Double) -> [CallSoundDetection] { policy.observe(CallSoundPolicy.candidates(scores: scores(values)), time: time) }
var policy = CallSoundPolicy()
precondition(observe(&policy,[282:0.8],0).isEmpty)
precondition(observe(&policy,[438:0.8],0.48).first?.kind == "water", "Aliases share consecutive count")
precondition(observe(&policy,[282:0.8],0.48).isEmpty, "Duplicate model window")
for i in 2...9 { precondition(observe(&policy,[282:0.8],Double(i)*0.48).isEmpty) }
precondition(observe(&policy,[282:0.8],4.8).first?.continued == true)
precondition(observe(&policy,[282:0.8],10).isEmpty, "Gaps reset consecutive windows")
precondition(observe(&policy,[282:0.8],10.48).first?.continued == false)
for (kind,classes) in CallSoundPolicy.rules { for (index,threshold) in classes {
    var p = CallSoundPolicy()
    precondition(observe(&p,[index:threshold-0.001],0).isEmpty)
    precondition(observe(&p,[index:threshold],0.48).isEmpty)
    let hit = observe(&p,[index:threshold],0.96).first
    precondition(hit?.kind == kind && hit?.classIndex == index, "Whitelist class \(index)")
} }
precondition(CallSoundPolicy.candidates(scores: scores([200:1])).isEmpty, "Outside whitelist")
precondition(CallSoundPolicy.candidates(scores: scores([282:.nan])).isEmpty)
precondition(!CallSoundASR.hasWords("嗯…啊啊，呜，哼。uh hmm"))
precondition(CallSoundASR.hasWords("嗯，我在这里"))
precondition(CallSoundASR.hasWords("I am here"))
var asr = CallSoundASR(); asr.add("hello", at: 12.4)
precondition(CallSoundASR.hasWords(asr.text(start: 10, end: 11)), "Delayed ASR blocks a matching old window")
precondition(asr.text(start: 15, end: 16).isEmpty, "Old ASR does not block later sounds")
let tone: [Float] = (0..<15600).map { Float(0.03*sin(2*Double.pi*220*Double($0)/16000)) }
let feature = CallVocalFeatures.measure(tone)
precondition(feature.voicedRatio > 0.9 && abs(feature.pitchHz-220) < 8 && feature.bandRatio < 0.45)
precondition(feature.infer(scores: scores([0:0.3]), text: "")?.kind == "moan")
precondition(feature.infer(scores: scores([0:0.3]), text: "呜")?.kind == "whimper")
precondition(feature.infer(scores: scores([0:0.3]), text: "啊")?.kind == "vocal")
precondition(feature.infer(scores: scores([0:0.3]), text: "我在说话") == nil)
precondition(feature.infer(scores: scores([517:0.9]), text: "") == nil, "Nonhuman tone cannot infer a vocalization")
let silence = CallVocalFeatures.measure([Float](repeating: 0, count: 15600))
precondition(silence.infer(scores: scores([0:0.9]), text: "") == nil)
print("YAMNet whitelist, continuous windows, YIN, spectral ratio and delayed ASR policy passed")
