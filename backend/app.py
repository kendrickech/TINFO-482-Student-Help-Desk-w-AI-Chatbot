# app.py
from flask import Flask, jsonify
from flask_cors import CORS
from auth import auth_bp

app = Flask(__name__)
app.secret_key = "dev-secret-key"  # fine for school
CORS(app, supports_credentials=True, origins=["http://localhost:3000", "http://localhost:5173"])

app.register_blueprint(auth_bp)

@app.get("/health")
def health():
    return jsonify({"status": "ok"})

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)