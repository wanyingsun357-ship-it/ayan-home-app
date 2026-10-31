"""Reproducible official YAMNet -> Core ML conversion. No private audio used."""
import csv, hashlib, json, os, pathlib, sys, urllib.request
os.environ.setdefault('TF_CPP_MIN_LOG_LEVEL', '2')
import numpy as np
import tensorflow as tf
import coremltools as ct
from scipy.io import wavfile
from scipy.signal import resample_poly
from fractions import Fraction

ROOT = pathlib.Path(__file__).resolve().parents[2]
UPSTREAM = pathlib.Path(__file__).parent / 'upstream'
SOURCE_COMMIT = 'fb25c876d54f6e333ccfeb962642e64a87d5cc33'
# Current upstream uses the standalone legacy tf_keras package. TensorFlow 2.12
# already contains that same Keras API; this alias does not change the network.
sys.modules['tf_keras'] = tf.keras
sys.path.insert(0, str(UPSTREAM))
import yamnet, params

CACHE = ROOT / '.yamnet-cache'
CACHE.mkdir(exist_ok=True)
def download(url, name):
    p = CACHE / name
    if not p.exists():
        with urllib.request.urlopen(url, timeout=120) as r: p.write_bytes(r.read())
    return p
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
weights = download('https://storage.googleapis.com/audioset/yamnet.h5', 'yamnet.h5')
p = params.Params()
reference = yamnet.yamnet_frames_model(p)
reference.load_weights(str(weights))
features = tf.keras.Input(shape=(96, 64), name='mel_patch')
scores, _ = yamnet.yamnet(features, p)
network = tf.keras.Model(features, scores)
network.set_weights(reference.get_weights())

# One 0.975s patch = 96 periodic-Hann STFT frames of length 400, hop 160.
# Use real matrix multiplications instead of complex FFT; retain the complete
# spectral frontend in float32 so quiet samples cannot underflow when squared.
indices = np.arange(96)[:, None] * 160 + np.arange(400)[None, :]
window = (0.5 - 0.5 * np.cos(2*np.pi*np.arange(400)/400)).astype(np.float32)
angle = 2*np.pi*np.outer(np.arange(400), np.arange(257))/512
real = tf.constant(np.cos(angle).astype(np.float32))
imag = tf.constant(-np.sin(angle).astype(np.float32))
mel = tf.signal.linear_to_mel_weight_matrix(64, 257, 16000, 125, 7500)

@tf.function(input_signature=[tf.TensorSpec([15600], tf.float32, name='waveform')])
def forward(waveform):
    with tf.name_scope('frontend_float32'):
        frames = tf.gather(waveform, tf.constant(indices, tf.int32)) * tf.constant(window)
        re = tf.matmul(frames, real)
        im = tf.matmul(frames, imag)
        magnitude = tf.sqrt(re*re + im*im)
        patch = tf.math.log(tf.matmul(magnitude, mel) + tf.constant(0.001, tf.float32))
        patch = tf.expand_dims(patch, 0)
    return tf.identity(network(patch, training=False)[0], name='scores')

concrete = forward.get_concrete_function()
model = ct.convert([concrete], source='tensorflow', convert_to='mlprogram',
    inputs=[ct.TensorType(name='waveform', shape=(15600,), dtype=np.float32)],
    minimum_deployment_target=ct.target.iOS16,
    compute_precision=ct.transform.FP16ComputePrecision(op_selector=lambda op: 'frontend_float32' not in op.name and not any(name in op.name.lower() for name in ['dense', 'sigmoid', 'classifier'])),
    compute_units=ct.ComputeUnit.CPU_ONLY)
model.author = 'TensorFlow Authors; fixed-patch Core ML conversion for Entangled Home'
model.license = 'Apache-2.0'
model.short_description = 'Official YAMNet: 15600 samples at 16kHz -> 521 AudioSet scores'
model.user_defined_metadata['tensorflow_models_commit'] = SOURCE_COMMIT
model.user_defined_metadata['frontend_precision'] = 'float32 real DFT; no complex FFT'
model.user_defined_metadata['weights_sha256'] = digest(weights)
ops = model._mil_program.functions['main'].operations
frontend = [op for op in ops if 'frontend_float32' in op.name and op.op_type in ['matmul', 'mul', 'sqrt', 'log']]
assert frontend, 'Must identify the exported spectral frontend'
print('FRONTEND_TYPES', [(op.name, str(out.dtype)) for op in frontend for out in op.outputs], flush=True)
assert all(out.dtype == ct.converters.mil.mil.types.fp32 for op in frontend for out in op.outputs), 'Spectral frontend lost float32'

labels = list(csv.DictReader((UPSTREAM/'yamnet_class_map.csv').open()))
assert len(labels) == 521 and all(int(row['index']) == i for i,row in enumerate(labels))
rng = np.random.default_rng(20261031)
fixtures = [('silence', np.zeros(15600, np.float32)),
    ('quiet_noise', rng.normal(0, .0001, 15600).astype(np.float32)),
    ('tone_220', (.05*np.sin(2*np.pi*220*np.arange(15600)/16000)).astype(np.float32)),
    ('noise', rng.normal(0, .03, 15600).astype(np.float32))]
for name in ['miaow_16k', 'speech_whistling2']:
    f = download('https://storage.googleapis.com/audioset/'+name+'.wav', name+'.wav')
    rate, data = wavfile.read(f)
    if np.issubdtype(data.dtype, np.integer): data = data.astype(np.float32)/max(abs(np.iinfo(data.dtype).min),np.iinfo(data.dtype).max)
    else: data=data.astype(np.float32)
    if data.ndim>1: data=data.mean(axis=1)
    if rate!=16000:
        ratio=Fraction(16000,int(rate));data=resample_poly(data,ratio.numerator,ratio.denominator).astype(np.float32)
    for offset in [0, 8000, 16000]:
        sample=data[offset:offset+15600]
        if len(sample)==15600: fixtures.append((name+'_'+str(offset),sample))

results=[]
for name,sample in fixtures:
    original=reference(sample, training=False)[0].numpy()[0]
    dft=forward(sample).numpy()
    prediction=model.predict({'waveform':sample})
    converted=np.asarray(next(iter(prediction.values()))).reshape(-1)
    assert converted.shape==(521,) and np.isfinite(converted).all()
    dft_error=float(np.max(np.abs(original-dft)))
    error=float(np.max(np.abs(original-converted)))
    top_original=np.argsort(original)[-5:][::-1].tolist()
    top_converted=np.argsort(converted)[-5:][::-1].tolist()
    same_top5=set(top_original)==set(top_converted)
    item={'fixture':name,'dft_max_abs_error':dft_error,'coreml_max_abs_error':error,'top5_same':same_top5,'reference_top5':top_original,'coreml_top5':top_converted}
    results.append(item);print('VALIDATION',json.dumps(item),flush=True)
    assert dft_error <= .02 and error <= .02 and same_top5, 'YAMNet equivalence gate failed: '+name

out=ROOT/'ios/App/App/YAMNet.mlpackage'
model.save(str(out))
report={'source_commit':SOURCE_COMMIT,'weights_url':'https://storage.googleapis.com/audioset/yamnet.h5','weights_sha256':digest(weights),
    'tensorflow':tf.__version__,'coremltools':ct.__version__,'input_samples':15600,'sample_rate':16000,'hop_samples':7680,'classes':521,
    'frontend_precision':'float32','network_precision':'float16','output_name':next(iter(prediction.keys())),
    'validation':results,'all_pass':True,'model_files':{str(f.relative_to(out)):digest(f) for f in out.rglob('*') if f.is_file()}}
(ROOT/'ios/App/App/YAMNet-validation.json').write_text(json.dumps(report,indent=2)+'\n')
(ROOT/'ios/App/App/YAMNet-labels.json').write_text(json.dumps([r['display_name'] for r in labels],ensure_ascii=False)+'\n')
print('EXPORTED',out,'BYTES',sum(f.stat().st_size for f in out.rglob('*') if f.is_file()),flush=True)
