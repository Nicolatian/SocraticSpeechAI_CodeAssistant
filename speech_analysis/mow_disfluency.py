import json
import numpy as np
import onnxruntime as ort
from huggingface_hub import hf_hub_download
from transformers import PreTrainedTokenizerFast

MODEL_ID = "sam-castro/mow-disfluency-classifier"

class MowDisfluency:

    def __init__(self):
        print("Loading Mów...")

        model_path = hf_hub_download(repo_id=MODEL_ID, filename="DisfluencyClassifier.onnx")

        labels_path = hf_hub_download(repo_id=MODEL_ID, filename="label_map.json")

        tokenizer_path = hf_hub_download(
            repo_id=MODEL_ID,
            filename="tokenizer.json"
        )
        tokenizer_config_path = hf_hub_download(
            repo_id=MODEL_ID,
            filename="tokenizer_config.json"
        )
        with open(tokenizer_config_path, encoding="utf-8") as file:
            tokenizer_config = json.load(file)

        self.tokenizer = PreTrainedTokenizerFast(
            tokenizer_file=tokenizer_path,
            cls_token=tokenizer_config["cls_token"],
            mask_token=tokenizer_config["mask_token"],
            pad_token=tokenizer_config["pad_token"],
            sep_token=tokenizer_config["sep_token"],
            unk_token=tokenizer_config["unk_token"],
            model_max_length=tokenizer_config["model_max_length"]
        )

        self.model = ort.InferenceSession(
            model_path,
            providers=["CPUExecutionProvider"]
        )

        with open(labels_path, encoding="utf-8") as file:
            raw_labels = json.load(file)

        # Convert label map into ID -> label
        if isinstance(raw_labels, list):
            self.labels = dict(enumerate(raw_labels))
        elif all(str(key).isdigit() for key in raw_labels):
            self.labels = {
                int(key): value for key, value in raw_labels.items()
            }
        else:
            self.labels = {
                int(value): key for key, value in raw_labels.items()
            }

        print("Mów ready.")

    def analyse(self, transcript):

        inputs = self.tokenizer(
            transcript,
            return_tensors="np",
            truncation=True,
            max_length=512
        )

        feeds = {
            item.name: inputs[item.name].astype(np.int64)
            for item in self.model.get_inputs()
            if item.name in inputs
        }

        logits = self.model.run(None, feeds)[0]
        predictions = np.argmax(logits, axis=-1)[0]

        counts = {
            "FP": 0,
            "RP": 0,
            "RV": 0,
            "PW": 0
        }

        for prediction in predictions:
            label = self.labels.get(int(prediction), "O")

            if label in counts:
                counts[label] += 1

        return {
            "fillers": counts["FP"],
            "repetitions": counts["RP"],
            "revisions": counts["RV"],
            "partial_words": counts["PW"]
        }


if __name__ == "__main__":
    detector = MowDisfluency()

    example = "Øhm, I think it is index three. No, wait, maybe index two."

    print(detector.analyse(example))