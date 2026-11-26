import argparse
import numpy as np
import pandas as pd
import torch

from pathlib import Path
from datasets import Dataset
from sklearn.model.selection import train_test_split
from skearn.metrics import accuracy_score, f1_score

from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    DataCollatorWithPadding,
    Trainer,
    TrainingArguments,
)

#Setting up paths, labels, ids and device configuration
BASE_MODEL = "Maltehb/aelectra-danish-electra-small-cased"
ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "training" / "conceptual_training.csv"
MODEL_PATH = ROOT / "models" / "aelectra_model"

LABELS = ["correct", "partial", "misconception", "unclear", "irrelevant"]
LABEL2ID = {label: i for i, label in enumerate(LABELS)}
ID2LABEL = {i: label for label, i in LABEL2ID.items()}

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


#Training the model
def train():
    print("Loading training data...")

    df = pd.read_csv(DATA_PATH)
    df = df.dropna(subset=["text", "label"])
    df["text"] = df["text"].astype(str).str.strip()
    df["label"] = df["label"].astype(str).str.strip().str.lower()
    
    unknown = set(df["label"]) - set(LABELS)

    if unknown:
        raise ValueError(f"Unknown labels found in the dataset: {unknown}")

    #Each class needs enough exaples for strategic training.
    counts = df["label"].value_counts()

    insufficient = [label for label in LABELS if counts.get(label, 0) < 2]
    if insufficient:
        raise ValueError(f"Insufficient examples for labels: {insufficient}. "
        "Add at least two examples per class before training")

    #Splitting the dataset into training and validation sets
    validation_size = max(len(LABELS), round(len(df) * 0.2))

    if len(df) < validation_size < len(LABELS):
        raise ValueError(f"Not enough data for validation. ")
    
    train_df, validation_df = train_test_split(df, test_size=validation_size, stratify=df["label"], random_state=42)