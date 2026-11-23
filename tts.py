from huggingface_hub import snapshot_download
import soundfile as sf
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
import time

MODEL_ID = "CoRal-project/roest-v3-chatterbox-500m"

print("Downloading/loading model...")

model_dir = snapshot_download(
    repo_id=MODEL_ID
)

model = ChatterboxMultilingualTTS.from_local(
    model_dir,
    device="cuda"
)

print("Model loaded!")

text = (
    "Tag indeks 2 i dit array, og indsæt det i en ny variabel."
    
)

start = time.perf_counter()
wav = model.generate(text, language_id="da")
generation_time = time.perf_counter() - start

audio_duration = wav.shape[-1] / model.sr

print(f"Generation time: {generation_time:.2f} seconds")
print(f"Audio duration: {audio_duration:.2f} seconds")
print(f"Real-time factor: {generation_time / audio_duration:.2f}x")

sf.write("output.wav", wav.squeeze().cpu().numpy(), model.sr)

print("Audio saved to output.wav")
