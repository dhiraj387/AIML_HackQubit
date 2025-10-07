from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline

MODEL_NAME = "Hate-speech-CNERG/dehatebert-mono-english"

print("⏳ Loading model...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)
nlp = pipeline("text-classification", model=model, tokenizer=tokenizer, truncation=True, padding=True)
print("✅ Model ready!")

def analyze_text(text):
    result = nlp(text)[0]
    label = result["label"]
    score = round(result["score"] * 100, 2)

    if "hate" in label.lower() or "offensive" in label.lower():
        status = "⚠️ Toxic / Offensive"
    elif "non" in label.lower() or "neutral" in label.lower():
        status = "✅ Safe / Neutral"
    else:
        status = "🟡 Unclear / Needs Review"

    return {"label": label, "confidence": score, "status": status}
