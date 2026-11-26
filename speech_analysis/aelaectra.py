import argparse
from pathlib import Path

import numpy as np
import pandas as pd
import torch

from datasets import Dataset
from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    DataCollatorWithPadding,
    Trainer,
    TrainingArguments,
)


# CONFIGURATION for nedes
# Hugging Face model ID
BASE_MODEL = "Maltehb/aelaectra-danish-electra-small-cased"

ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = Path(__file__).resolve().with_name("conceptual_training_exercises_clean.csv")
MODEL_PATH = ROOT / "models" / "aelaectra_model"

LABELS = ["correct", "partial", "misconception", "unclear", "irrelevant"]
LABEL2ID = {label: index for index, label in enumerate(LABELS)}
ID2LABEL = {index: label for label, index in LABEL2ID.items()}

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
_classifier = None



# DATA PREPARATION
def load_data():
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Training CSV not found: {DATA_PATH}")

    df = pd.read_csv(DATA_PATH, sep=";")

    required_columns = {"exercise_id", "exercise", "student_explanation", "label"}
    missing = required_columns - set(df.columns)
    if missing:
        raise ValueError(f"CSV is missing columns: {sorted(missing)}")

    df = df.dropna(subset=["exercise_id", "exercise", "student_explanation", "label"]).copy()
    for column in ["exercise_id", "exercise", "student_explanation", "label"]:
        df[column] = df[column].astype(str).str.strip()

    df["label"] = df["label"].str.lower()
    unknown = set(df["label"]) - set(LABELS)
    if unknown:
        raise ValueError(f"Unknown labels in CSV: {sorted(unknown)}")

    # Combine the task and the student's explanation as model input.
    df["text"] = (
        "Opgave: " + df["exercise"] +
        "\nElevens forklaring: " + df["student_explanation"]
    )

    # Remove exact duplicate examples only; different answers to the same
    # exercise are intentionally retained as separate training examples.
    df = df.drop_duplicates(subset=["exercise_id", "student_explanation", "label"])

    missing_labels = set(LABELS) - set(df["label"])
    if missing_labels:
        raise ValueError(f"CSV has no examples for labels: {sorted(missing_labels)}")

    return df


# TRAINING the modeol
def train():
    global _classifier

    print("Loading Ælæctra training data...")
    df = load_data()

    print(f"Total examples: {len(df)}")
    print(f"Unique exercises: {df['exercise_id'].nunique()}")
    print("Examples per label:")
    print(df["label"].value_counts().reindex(LABELS, fill_value=0))

    # Hold out complete exercises for validation.
    splitter = GroupShuffleSplit(n_splits=1, test_size=0.22, random_state=42)
    train_indices, validation_indices = next(
        splitter.split(df, groups=df["exercise_id"])
    )

    train_df = df.iloc[train_indices].copy()
    validation_df = df.iloc[validation_indices].copy()

    for split_name, split_df in [("training", train_df), ("validation", validation_df)]:
        missing = set(LABELS) - set(split_df["label"])
        if missing:
            raise ValueError(
                f"The {split_name} split is missing labels: {sorted(missing)}. "
                "Add more varied examples or adjust the exercise-level split."
            )

    print(f"Training examples: {len(train_df)}")
    print(f"Validation examples: {len(validation_df)}")
    print(f"Validation exercises: {sorted(validation_df['exercise_id'].unique())}")

    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)

    def prepare_dataset(frame):
        model_frame = frame[["text", "label"]].copy()
        model_frame["labels"] = model_frame.pop("label").map(LABEL2ID).astype(int)

        dataset = Dataset.from_pandas(model_frame, preserve_index=False)

        def tokenize(batch):
            return tokenizer(batch["text"], truncation=True, max_length=256)

        return dataset.map(tokenize, batched=True, remove_columns=["text"])

    train_dataset = prepare_dataset(train_df)
    validation_dataset = prepare_dataset(validation_df)

    model = AutoModelForSequenceClassification.from_pretrained(
        BASE_MODEL,
        num_labels=5,
        id2label=ID2LABEL,
        label2id=LABEL2ID,
    )

    def calculate_metrics(result):
        predictions = np.argmax(result.predictions, axis=-1)
        return {
            "accuracy": accuracy_score(result.label_ids, predictions),
            "f1": f1_score(
                result.label_ids,
                predictions,
                average="macro",
                zero_division=0,
            ),
        }

    collator = DataCollatorWithPadding(tokenizer=tokenizer)

    training_args = TrainingArguments(
        output_dir=str(MODEL_PATH),
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        num_train_epochs=6,
        per_device_train_batch_size=8,
        per_device_eval_batch_size=8,
        learning_rate=2e-5,
        weight_decay=0.01,
        warmup_ratio=0.1,
        metric_for_best_model="eval_f1",
        greater_is_better=True,
        save_total_limit=2,
        logging_strategy="epoch",
        report_to="none",
        seed=42,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=validation_dataset,
        processing_class=tokenizer,
        data_collator=collator,
        compute_metrics=calculate_metrics,
    )

    print("Starting fine-tuning...")
    trainer.train()

    trainer.save_model(str(MODEL_PATH))
    tokenizer.save_pretrained(str(MODEL_PATH))

    metrics = trainer.evaluate()
    print("\nFine-tuning completed.")
    print(f"Validation accuracy: {metrics['eval_accuracy']:.3f}")
    print(f"Validation macro-F1: {metrics['eval_f1']:.3f}")
    print("Note: this is a small synthetic starter dataset, so these metrics are only a pipeline check.")

    predictions = trainer.predict(validation_dataset)
    predicted_labels = predictions.predictions.argmax(axis=-1)
    true_labels = predictions.label_ids

    print("Accuracy:", accuracy_score(true_labels, predicted_labels))
    print("\nClassification report:")
    print(classification_report(
        true_labels,
        predicted_labels,
        labels=[0, 1, 2, 3, 4],
        target_names=["correct", "partial", "misconception", "unclear", "irrelevant"],
        zero_division=0,
    ))
    print(f"Confusion matrix labels (true rows, predicted columns): {LABELS}")
    print(confusion_matrix(
        true_labels,
        predicted_labels,
        labels=[0, 1, 2, 3, 4],
    ))

    print("Model label mapping:")
    print(model.config.id2label)
    print("\nDataset label mapping:")
    print(LABEL2ID)

    for entry in trainer.state.log_history:
        if "loss" in entry or "eval_loss" in entry:
            print(entry)
    
    _classifier = None



# PREDICTION classifier
class ConceptualClassifier:
    def __init__(self):
        if not (MODEL_PATH / "config.json").exists():
            raise RuntimeError("Ælæctra is not fine-tuned yet. Run --train first.")

        print("Loading fine-tuned Ælæctra...")
        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
        self.model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
        self.model.to(DEVICE)
        self.model.eval()
        print(f"Ælæctra ready on {DEVICE}.")

    def predict(self, exercise, student_explanation):
        if not exercise.strip() or not student_explanation.strip():
            raise ValueError("Both exercise and student explanation are required.")

        text = (
            f"Opgave: {exercise}\n"
            f"Elevens forklaring: {student_explanation}"
        )

        inputs = self.tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=256,
        )
        inputs = {key: value.to(DEVICE) for key, value in inputs.items()}

        with torch.inference_mode():
            logits = self.model(**inputs).logits

        probabilities = torch.softmax(logits, dim=-1)[0]
        prediction = int(torch.argmax(probabilities).item())
        predicted_label = self.model.config.id2label[str(prediction)] if str(prediction) in self.model.config.id2label else self.model.config.id2label[prediction]

        scores = {
            self.model.config.id2label[str(i)] if str(i) in self.model.config.id2label else self.model.config.id2label[i]: round(float(probabilities[i].item()), 3)
            for i in range(len(LABELS))
        }

        return {
            "classification": predicted_label,
            "confidence": scores[predicted_label],
            "scores": scores,
        }


# Load once per process, next predictions reuse the same model.
def predict(exercise, student_explanation):
    global _classifier
    if _classifier is None:
        _classifier = ConceptualClassifier()
    return _classifier.predict(exercise, student_explanation)



# COMMAND LINEs
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fine-tune and test Ælæctra for PEAR.")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--train", action="store_true", help="Fine-tune the model")
    mode.add_argument("--predict", action="store_true", help="Run one prediction")
    mode.add_argument("--interactive", action="store_true", help="Enter exercise and answer manually")
    parser.add_argument("--exercise", type=str, help="Exercise prompt for --predict")
    parser.add_argument("--answer", type=str, help="Student explanation for --predict")

    args = parser.parse_args()

    if args.train:
        train()
    elif args.predict:
        if not args.exercise or not args.answer:
            parser.error("--predict requires both --exercise and --answer")
        print(predict(args.exercise, args.answer))
    elif args.interactive:
        print("Manual Ælæctra test. Type :q to quit.")
        while True:
            exercise = input("\nExercise: ").strip()
            if exercise.lower() == ":q":
                break
            answer = input("Student explanation: ").strip()
            if answer.lower() == ":q":
                break
            print(predict(exercise, answer))
            