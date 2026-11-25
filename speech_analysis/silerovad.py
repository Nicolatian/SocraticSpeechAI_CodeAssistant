import math
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
from scipy.signal import resample_poly
from silero_vad import get_speech_timestamps, load_silero_vad

SAMPLE_RATE = 16000


class SileroVAD:
    def __init__(self):
        print("Loading Silero VAD...")
        self.model = load_silero_vad(onnx=True)
        print("Silero VAD ready.")

    def analyse(self, audio_path):
        audio, sample_rate = sf.read(audio_path, dtype="float32", always_2d=True)
        audio = audio.mean(axis=1)

        if sample_rate != SAMPLE_RATE:
            divisor = math.gcd(sample_rate, SAMPLE_RATE)
            audio = resample_poly(
                audio,
                SAMPLE_RATE // divisor,
                sample_rate // divisor
            ).astype(np.float32)

        audio = torch.from_numpy(np.ascontiguousarray(audio))

        segments = get_speech_timestamps(
            audio,
            self.model,
            sampling_rate=SAMPLE_RATE,
            return_seconds=True
        )

        pauses = []

        for previous, current in zip(segments, segments[1:]):
            duration = current['start'] - previous['end']
            if duration >= 0.54:
                pauses.append(round(duration, 3))

        total_speech_duration = sum(
            segment['end'] - segment['start'] for segment in segments
        )

        return {
            "speech_segments": len(segments),
            "pauses_count": len(pauses),
            "pauses_durations": pauses,
            "total_speech_duration": round(total_speech_duration, 3)
        }

if __name__ == "__main__":
    detector = SileroVAD()
    audio_path = Path(__file__).resolve().parent.parent / "uden titel.wav"
    result = detector.analyse(audio_path)
    print(result)