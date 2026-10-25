// VOICE square brackets direct the audio; hide them only in the transcript.
// Keep the original string for synthesis, storage and voice cache lookup.
export function voiceTranscript(text = '') {
  return String(text).replace(/\[[^\]\r\n]*\]/g, '').replace(/[ \t]{2,}/g, ' ').replace(/^[ \t]+|[ \t]+$/gm, '').trim()
}
