
from flask import Flask, request, jsonify, send_file
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
from huggingface_hub import snapshot_download
import soundfile as sf
import torch
import io
import time

app = Flask(__name__)

MODEL_ID = "CoRal-project/roest-v3-chatterbox-500m"

print("Loading TTS model...")

start = time.perf_counter()

model_dir = snapshot_download(repo_id=MODEL_ID)
model = ChatterboxMultilingualTTS.from_local(model_dir, device="cuda")

print(f"Model loaded in {time.perf_counter() - start:.2f} seconds!")


@app.route("/tts", methods=["POST"])
def generate_speech():
    data = request.get_json()
    text = data.get("text", "")

    if not text.strip():
        return jsonify({"error": "No text provided"}), 400

    start = time.perf_counter()

    wav = model.generate(text, language_id="da")

    generation_time = time.perf_counter() - start

    audio_buffer = io.BytesIO()

    sf.write(
        audio_buffer,
        wav.squeeze().cpu().numpy(),
        model.sr,
        format="WAV"
    )

    audio_buffer.seek(0)

    print(f"Generated speech in {generation_time:.2f} seconds")

    return send_file(
        audio_buffer,
        mimetype="audio/wav",
        download_name="speech.wav"
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8002)
