from huggingface_hub import snapshot_download
import soundfile as sf
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

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
    "Hej! Velkommen til vores projekt. "
    "I dag skal vi lære noget om kunstig intelligens."
)

wav = model.generate(
    text,
    language_id="da"
)

sf.write("output.wav", wav.squeeze().cpu().numpy(), model.sr)

print("Audio saved to output.wav")
