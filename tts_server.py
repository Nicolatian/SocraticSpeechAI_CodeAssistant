
from flask import Flask, request, jsonify, send_file
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
from huggingface_hub import snapshot_download
import soundfile as sf
import io
import os
import tempfile
import threading
import time

app = Flask(__name__)

MODEL_ID = "CoRal-project/roest-v3-chatterbox-500m"
OUTPUT_WAV = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output.wav")
tts_lock = threading.Lock()

print("Loading TTS model...")

start = time.perf_counter()

model_dir = snapshot_download(repo_id=MODEL_ID)
model = ChatterboxMultilingualTTS.from_local(model_dir, device="cuda")

print(f"Model loaded in {time.perf_counter() - start:.2f} seconds!")


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "pid": os.getpid()})


@app.route("/tts/audio", methods=["GET"])
def latest_audio():
    if not os.path.isfile(OUTPUT_WAV):
        return jsonify({"error": "No speech has been generated yet."}), 404

    response = send_file(OUTPUT_WAV, mimetype="audio/wav", conditional=False)
    response.headers["Cache-Control"] = "no-store"
    return response


@app.route("/tts", methods=["POST"])
def generate_speech():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400

    text = data.get("text")
    if not isinstance(text, str) or not text.strip():
        return jsonify({"error": "No text provided"}), 400

    with tts_lock:
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
        audio_bytes = audio_buffer.getvalue()

        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(
                dir=os.path.dirname(OUTPUT_WAV),
                prefix=".output-",
                suffix=".wav",
                delete=False,
            ) as temp_file:
                temp_path = temp_file.name
                temp_file.write(audio_bytes)
            os.replace(temp_path, OUTPUT_WAV)
        finally:
            if temp_path is not None and os.path.exists(temp_path):
                os.unlink(temp_path)

    print(f"Generated speech in {generation_time:.2f} seconds")
    return jsonify({"audioUrl": "/tts/audio"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8002)
