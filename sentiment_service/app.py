from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch
from transformers import BertTokenizer, BertForSequenceClassification
import numpy as np
import json
import os
from dotenv import load_dotenv
import uvicorn

load_dotenv()

from contextlib import asynccontextmanager

def load_model_and_config():
    global model, tokenizer, config, label_encoder_classes
    try:
        with open('model/model_config.json', 'r') as f:
            config = json.load(f)
        
        model = BertForSequenceClassification.from_pretrained('model/best_model', local_files_only=True)
        tokenizer = BertTokenizer.from_pretrained('model/best_model', local_files_only=True)
        model.to(device)
        model.eval()
        
        label_encoder_classes = np.load('model/label_encoder_classes.npy', allow_pickle=True)
        label_encoder_classes = label_encoder_classes.tolist()
        
        print("Model, tokenizer, and configurations loaded successfully!")
        return True
    except Exception as e:
        print(f"Error loading model and configurations: {str(e)}")
        return False

@asynccontextmanager
async def lifespan(app: FastAPI):
    if not load_model_and_config():
        print("Warning: Could not load model and configurations. Please ensure the model is trained first.")
    yield
    # Clean up if necessary

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model and configurations
model = None
tokenizer = None
config = None
label_encoder_classes = None
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

class AnalyzeRequest(BaseModel):
    text: str

@app.get('/health')
async def health_check():
    return {
        'status': 'ok',
        'model_loaded': model is not None,
        'device': str(device)
    }

def preprocess_text(text):
    # Tokenize and prepare for BERT
    encoding = tokenizer(
        text,
        add_special_tokens=True,
        max_length=config['max_length'],
        padding='max_length',
        truncation=True,
        return_tensors='pt'
    )
    return encoding

@app.post('/analyze')
async def analyze_sentiment(request: AnalyzeRequest):
    try:
        if model is None:
            raise HTTPException(status_code=500, detail="Model not loaded")

        text = request.text
        
        if not text:
            raise HTTPException(status_code=400, detail="No text provided")

        # Preprocess the text
        encoding = preprocess_text(text)
        
        # Move tensors to device
        input_ids = encoding['input_ids'].to(device)
        attention_mask = encoding['attention_mask'].to(device)
        
        # Get model prediction
        with torch.no_grad():
            outputs = model(input_ids=input_ids, attention_mask=attention_mask)
            predictions = torch.nn.functional.softmax(outputs.logits, dim=1)
            
        # Get predicted class and confidence
        confidence, predicted_idx = torch.max(predictions, dim=1)
        predicted_emotion = label_encoder_classes[predicted_idx.item()]
        confidence = confidence.item()
        
        # Check for suicidal content and high confidence
        needs_immediate_help = predicted_emotion == 'suicidal' and confidence > 0.7

        return {
            'emotion': predicted_emotion,
            'confidence': confidence,
            'needs_immediate_help': needs_immediate_help
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error processing request: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == '__main__':
    port = int(os.getenv('SENTIMENT_SERVICE_PORT', 5000))
    uvicorn.run("app:app", host="0.0.0.0", port=port)
