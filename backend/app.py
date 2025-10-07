from flask import Flask, request, jsonify
from model_handler import analyze_text
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # allow cross-origin requests from Chrome extension

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.get_json()
    text = data.get("text", "")
    result = analyze_text(text)
    return jsonify(result)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
