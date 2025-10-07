from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification
from langdetect import detect
import torch
import re

# -------------------------------
# App Setup
# -------------------------------
app = FastAPI(title="Hate Speech & Toxicity Detection API v2")

# Allow CORS for Chrome Extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development only
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

device = 0 if torch.cuda.is_available() else -1

# -------------------------------
# Models
# -------------------------------
print("🚀 Loading models... This may take a minute")

# Zero-shot multilingual model
zero_shot_model = pipeline(
    "zero-shot-classification",
    model="joeddav/xlm-roberta-large-xnli",
    device=device
)

# IndicBERT / MuRIL for Indian languages
indic_model_name = "ai4bharat/indic-bert"
indic_model = AutoModelForSequenceClassification.from_pretrained(indic_model_name)
indic_tokenizer = AutoTokenizer.from_pretrained(indic_model_name)

# English fine-tuned model
english_model = pipeline(
    "text-classification",
    model="cardiffnlp/twitter-roberta-base-offensive",
    device=device
)

# Toxicity labels
CATEGORIES = ["toxic", "offensive", "neutral"]

print("✅ Models loaded successfully!")

# -------------------------------
# Helper Functions
# -------------------------------
def clean_text(text: str) -> str:
    """Remove HTML tags, extra spaces, scripts"""
    text = re.sub(r"<.*?>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()

def detect_language(text: str) -> str:
    """Detect language using langdetect"""
    try:
        lang = detect(text)
        return lang
    except:
        return "unknown"

def get_explanations(text: str, top_n: int = 5):
    """Highlight top toxic words with order preserved"""
    words = re.findall(r'\w+', text.lower())
    toxic_words = ["hate", "stupid", "kill", "bad", "dumb", "ganda", "buri", "maro"]  # custom dictionary
    highlights = [w for w in words if w in toxic_words]

    # preserve order & remove duplicates
    seen = set()
    ordered_highlights = []
    for w in highlights:
        if w not in seen:
            seen.add(w)
            ordered_highlights.append(w)
    return ordered_highlights[:top_n]

def ensemble_predict(text: str, lang: str):
    """Combine predictions from multiple models"""
    scores = {label: 0.0 for label in CATEGORIES}

    # Zero-shot classification
    try:
        zs = zero_shot_model(text, CATEGORIES)
        for lbl, sc in zip(zs["labels"], zs["scores"]):
            scores[lbl] += sc * 0.5  # 50% weight
    except:
        pass

    # English model
    if lang == "en":
        try:
            en = english_model(text)[0]
            label = en["label"].lower()
            if label in scores:
                scores[label] += en["score"] * 0.5
        except:
            pass

    # Indic model for Indian languages
    if lang in ["hi", "ta", "bn", "mr", "gu", "kn", "ml"]:
        try:
            inputs = indic_tokenizer(text, return_tensors="pt", truncation=True, max_length=128)
            outputs = indic_model(**inputs)
            probs = torch.nn.functional.softmax(outputs.logits, dim=-1).detach().numpy()[0]
            # Assuming 3-class output: [neutral, offensive, toxic]
            scores["neutral"] += probs[0]*0.5
            scores["offensive"] += probs[1]*0.5
            scores["toxic"] += probs[2]*0.5
        except:
            pass

    # Final prediction
    final_label = max(scores, key=scores.get)
    return final_label, scores

# -------------------------------
# API Endpoints
# -------------------------------
@app.get("/")
def home():
    return {"message": "Welcome to Hate Speech & Toxicity Detection API v2"}

@app.get("/predict")
def predict(text: str = Query(..., description="Text to analyze")):
    """Predicts whether text is toxic, offensive, or neutral with explanations"""
    try:
        cleaned_text = clean_text(text)
        lang = detect_language(cleaned_text)

        label, scores = ensemble_predict(cleaned_text, lang)
        highlights = get_explanations(cleaned_text)

        return {
            "text": cleaned_text,
            "language": lang,
            "label": label,
            "scores": {k: float(f"{v:.4f}") for k, v in scores.items()},
            "highlights": highlights
        }

    except Exception as e:
        return {"error": str(e)}

