# YAMNet call sound observations

Implements the full sound-recognition path described at https://ariaduet.pages.dev/ai-hears-your-body/ . Existing native call ownership, ASR, sentence-by-sentence English TTS, and the Chinese-first bilingual UI remain shared with the current app.

## Model and whitelist

`tools/yamnet/upstream` pins the Apache-2.0 TensorFlow YAMNet source. `convert.py` uses the canonical public weights, real DFT matrix multiplications, a float32 spectral frontend and stable float32 probability head. Convolutions use float16. The conversion workflow checks actual exported operation types and compares ten deterministic/public audio patches with the original TensorFlow model. Every patch must have the same top-five class set and maximum score difference <=0.02. The report and per-file hashes are bundled beside the model. Conversion validation is not a measurement of phone microphone accuracy or runtime latency.

`sound-whitelist.json` is the source for class indices, names, individual thresholds and human-class indices. `generate-rules.cjs --check` prevents Swift/server divergence. It includes all thirteen tutorial groups (water, wet/squish, trickle, toilet flush, slap, whip, vibration, moan, whimper, pant, gasp, cry, scream), plus retained laughter/sigh and inferred vocalization. Other model classes never become observations.

The same existing 16kHz mono PCM feeds the classifier: 15600-sample window, 7680-sample hop, two consecutive matching windows, maximum score among eligible aliases, four-second per-name local cooldown. A continuing run carries the continuation flag; a gap resets it. The utility queue, model windows, ASR text and optional audio buffer are bounded. No second microphone, audio session or continuous disk recording is opened.

## Auxiliary vocal detection

The highest configured human-class score must be >=0.12. YIN uses a 0.35 cumulative-mean-normalized difference threshold; at least 30% of audible 32ms frames must be voiced, with median pitch 150–700Hz. Candidates wait 1.5 seconds for timestamped partial/final ASR. Real letters or Han words block inference; filler-only text can classify moan/whimper/vocalization. Without fillers, the leading human class or the 500–1500Hz / 100–500Hz energy ratio (0.45 boundary) selects the label. Inference requires an ASR-ready transport both at capture and evaluation; direct YAMNet classes can continue independently during ASR reconnection.

These are acoustic heuristics, not confirmed emotions, physical conditions, actions or sources. They require real-device calibration. Voice playback, mute, typing, audio deactivation, off and end invalidate capture generation and cancel pending analysis/upload; resuming starts fresh, after playback echo settles. A stopped microphone clears ASR availability. Overload drops the capture epoch rather than stitching noncontiguous audio into a clip.

## Authenticated observations and optional clips

The user explicitly selected uploading hit clips with seven-day retention. The native capability advertises this, and the call switch says that enabling sensing saves hit clips for seven days. The default first-run switch remains off and the existing per-device choice persists. `sound-setting` carries the model and clip opt-in alongside the capture revision. Build44 requests remain category-only and retain their original Apple thresholds/names; Build43/browser capability fallbacks remain supported.

`/api/native-call/sound` retains the existing per-call bearer authentication, revision, event-ID deduplication and category bounds. Direct detections must meet the threshold for their actual whitelist class. Heuristics require the configured human class and bounded voiced/pitch/ASR evidence; client free text never enters model prompts. A clip is accepted only in an opted-in current capture epoch, as canonical 16kHz mono PCM16 WAV between 1 and 3.5 seconds. It ends at the detection window and may be shorter just after capture resumes.

The server batches 1.2 seconds, deduplicates each name for eight seconds and permits two category hints per counterpart reply (shared turnId), resetting after 40 seconds without a new reply. Busy/stale/paused/limited/duplicate events do not retain recordings. Only delivered hits persist; a failed enqueue removes staged files. Clip-write failure still allows the category hint and shows that the clip was not saved.

Raw WAV plus measurement metadata live in `/var/lib/entangled-call-sounds`, outside the app, public static tree and project backups; directory0700/files0600. No raw audio or base64 is written to calls/history/SSE, Git, model assets or a public URL. Only clip IDs, expiry and numeric measurements appear in the event. An expiry timer deletes WAV and metadata at seven days; startup and fifteen-minute sweeps recover missed expirations and crash orphans. Do not copy this directory into longer-lived backups. No HTTP route exposes these private recordings.

Measurements are RMS/peak dBFS (not calibrated physical dB SPL), active duration within the clip, energy-onset rate and YIN pitch trend. Hints may include concise measured descriptions. Clip duration is not full event duration; energy onsets are not a guarantee of physical taps or actions.

## UI and verification

Successful observations appear as a thin purple “听到了♡” note, separately from speech and in the matching call history, with optional measured description. Existing bilingual groups, English expansion choice, per-sentence playback, reader scroll position and latest button remain unchanged.

Run `node --test server/call-sounds.test.cjs server/sound-clips.test.cjs server/call-stream.test.cjs tests/call-ui.test.cjs`, `node server/native-calls.test.cjs`, and the native workflow. The workflow tests whitelist/YIN/late ASR, actual shared-PCM windowing/WAV/epoch cancellation, then compiles the app/model with Xcode. For private bridge VM checks, set `AYAN_CALL_BRIDGE_SOURCE` to the narrowly patched bridge; the test substitutes a private clip store and synthetic conversation. The integration patch is against Build44's bridge, not an instruction to overwrite unrelated runtime changes. Production checks never send test calls, speech, pushes or model requests.
