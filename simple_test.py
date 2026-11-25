#!/usr/bin/env python3

import os
import sys

VENV_DIR = "/workspace/hviske-stt-venv"
VENV_PYTHON = os.path.join(VENV_DIR, "bin", "python")

if os.path.abspath(sys.prefix) != VENV_DIR:
    os.execv(VENV_PYTHON, [VENV_PYTHON, os.path.abspath(__file__), *sys.argv[1:]])

from huggingface_hub import snapshot_download

import torch

print("Loading Hviske v6...")

model_dir = snapshot_download(repo_id="syvai/hviske-v6")
sys.path.insert(0, model_dir)

from processing_whisper_qwen import HviskeASR

device = os.environ.get("HVISKE_DEVICE", "cuda" if torch.cuda.is_available() else "cpu")
asr = HviskeASR.from_pretrained(model_dir, device=device)

print("Model loaded successfully!")

if device.startswith("cuda"):
    print("GPU:", torch.cuda.get_device_name(0))
else:
    print("Device:", device)

audio_path = "/workspace/uden titel.wav"

print("Starting transcription...")

transcription = asr.transcribe(
    audio_path,
    cased=True,
    punctuated=True
)

print("Output type:", type(transcription))
print("Raw transcription:", repr(transcription))