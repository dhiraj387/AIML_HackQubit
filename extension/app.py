from flask import Flask, request, jsonify, make_response
from transformers import pipeline
from math import ceil
import logging

app = Flask(__name__)

# Configure logging to show info and above
logging.basicConfig(level=logging.INFO)

# Load the pre-trained model with safer defaults
try:
    # Use top_k=None to return scores for all labels (recommended over deprecated return_all_scores)
    classifier = pipeline(
        "text-classification",
        model="unitary/toxic-bert",
        top_k=None  # return all scores per label
    )
    logging.info("Model loaded successfully")
except Exception as e:
    logging.error(f"Error loading model: {e}")
    classifier = None

# Label to category mapping
LABEL_MAPPING = {
    'toxic': 'Malicious',
    'severe_toxic': 'Malicious',
    'obscene': 'Sensitive',
    'threat': 'Malicious',
    'insult': 'Sensitive',
    'identity_hate': 'Sensitive'
}
DEFAULT_CATEGORY = 'Safe'

# Enhanced CORS support
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
    response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
    return response

def _chunk_text(text, max_tokens=300):
    # Rough token approximation using whitespace; BERT max is 512 tokens
    # Keep chunks below 400 to allow for special tokens
    words = text.split()
    chunk_size = max_tokens
    chunks = []
    for i in range(0, len(words), chunk_size):
        chunks.append(' '.join(words[i:i+chunk_size]))
    return chunks or ['']

def _aggregate_category_scores(per_chunk_scores):
    aggregated = {}
    for category_scores in per_chunk_scores:
        for category, score in category_scores.items():
            # Take max across chunks for each category
            if category not in aggregated or score > aggregated[category]:
                aggregated[category] = score
    return aggregated

def classify_text(text):
    """Classify text using the loaded model."""
    if not text.strip():
        return {'category': DEFAULT_CATEGORY, 'confidence': 1.0}
    
    try:
        if classifier is None:
            return {'error': 'Model not loaded', 'category': 'Error', 'confidence': 0.0}

        # Chunk long text to avoid 512 token limit
        chunks = _chunk_text(text)
        per_chunk_category_scores = []
        for chunk in chunks:
            try:
                results = classifier(chunk, truncation=True)
                # Pipeline can return either:
                # - List[List[dict]] when return_all_scores=True (batch of examples -> list per example)
                # - List[dict] in some versions/configs
                per_label_scores = []
                if isinstance(results, list) and len(results) > 0:
                    first = results[0]
                    if isinstance(first, list):
                        # Expected nested list: take first (single example)
                        per_label_scores = first
                    elif isinstance(first, dict):
                        # Sometimes pipeline returns a flat list of dicts for single example
                        if all(isinstance(x, dict) for x in results):
                            per_label_scores = results
                        else:
                            per_label_scores = [first]
                    else:
                        logging.debug(f"Unexpected classifier result element type: {type(first)}")
                else:
                    logging.debug(f"Unexpected classifier result shape: {type(results)} / {results}")
                category_scores = {}
                for item in per_label_scores:
                    label = (item.get('label') or '').lower()
                    score = float(item.get('score', 0))
                    category = LABEL_MAPPING.get(label, DEFAULT_CATEGORY)
                    if category not in category_scores or score > category_scores[category]:
                        category_scores[category] = score
                per_chunk_category_scores.append(category_scores)
            except Exception as chunk_error:
                logging.error(f"Chunk classification error: {chunk_error}")
                continue

        if not per_chunk_category_scores:
            return {'error': 'No chunks classified', 'category': 'Error', 'confidence': 0.0}

        category_scores = _aggregate_category_scores(per_chunk_category_scores)

        max_category = max(category_scores.items(), key=lambda x: x[1])
        return {'category': max_category[0], 'confidence': float(max_category[1])}

    except Exception as e:
        logging.exception("Classification error")
        return {'error': f'Classification error: {str(e)}', 'category': 'Error', 'confidence': 0.0}

@app.route('/analyze', methods=['POST', 'OPTIONS'])
def analyze():
    if request.method == 'OPTIONS':
        return make_response('', 200)
    
    if not request.is_json:
        return jsonify({'error': 'Request must be JSON'}), 400
    
    data = request.get_json()
    text = data.get('text', '')
    
    if not isinstance(text, str):
        return jsonify({'error': 'Text must be a string'}), 400
    
    result = classify_text(text)
    return jsonify(result)

@app.route('/health', methods=['GET'])
def health():
    model_name = None
    try:
        model_obj = getattr(classifier, 'model', None)
        if model_obj is not None:
            model_name = getattr(getattr(model_obj, 'config', None), 'name_or_path', None) or getattr(model_obj, 'name_or_path', None)
    except Exception:
        model_name = None
    return jsonify({
        'status': 'healthy',
        'model_loaded': classifier is not None,
        'model_name': model_name
    })

@app.route('/self_test', methods=['GET'])
def self_test():
    if classifier is None:
        return jsonify({'ok': False, 'error': 'Model not loaded'}), 500
    try:
        sample_text = "This is a simple test."
        result = classify_text(sample_text)
        if 'error' in result:
            logging.error(f"Self-test classification returned error: {result['error']}")
            return jsonify({'ok': False, 'error': result['error'], 'details': result}), 500
        model_name = None
        try:
            model_obj = getattr(classifier, 'model', None)
            if model_obj is not None:
                model_name = getattr(getattr(model_obj, 'config', None), 'name_or_path', None) or getattr(model_obj, 'name_or_path', None)
        except Exception:
            model_name = None
        return jsonify({'ok': True, 'model_name': model_name, 'sample_text': sample_text, 'result': result}), 200
    except Exception as e:
        logging.exception("Self test error")
        return jsonify({'ok': False, 'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002, debug=True)