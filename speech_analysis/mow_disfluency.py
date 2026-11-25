import json
import numpy as np
import onnxruntime as ort
from huggingface_hub import hf_hub_download
from transformers import AutoTokenizer

MODEL_ID = "sam-castro/mow-disfluency-classifier"


class MowDisfluency:

    def __init__(self):
        model_path = hf_hub_download(MODEL_ID, "DisfluencyClassifier.onnx")

        label_path = hf_hub_download( MODEL_ID,"label_map.json")

        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)

        self.model = ort.InferenceSession(
            model_path,
            providers=["CPUExecutionProvider"]
        )

        with open(label_path, encoding="utf-8") as f:
            labels = json.load(f)

        if isinstance(labels, list):
            self.labels = {i: label for i, label in enumerate(labels)}
        else:
            self.labels = {
                int(k): v for k, v in labels.items()
            }

    def analyse(self, transcript):

        encoded = self.tokenizer(transcript, return_tensors="np", truncation=True, max_length=512)

        inputs = {
            item.name: encoded[item.name].astype(np.int64)
            for item in self.model.get_inputs()
            if item.name in encoded
        }

        output = self.model.run(None, inputs)[0]
        predictions = np.argmax(output, axis=-1)[0]

        counts = {"FP": 0, "RP": 0, "RV": 0, "PW": 0}
        word_ids = encoded.word_ids()

        counted_words = set()

        for prediction, word_id in zip(predictions, word_ids):

            if word_id is None or word_id in counted_words:
                continue

            counted_words.add(word_id)
            label = self.labels.get(int(prediction), "O")
            if label in counts:
                counts[label] += 1

        return counts


if __name__ == "__main__":
    detector = MowDisfluency()
    text = "Øhm, I think it is index three. No, wait, index two."
    print(detector.analyse(text))