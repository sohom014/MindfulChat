# MindfulChat — AI-Powered Mental Health Companion

> A full-stack, AI-driven chatbot that provides compassionate, evidence-based mental health support using real-time sentiment analysis, retrieval-augmented generation (RAG), and Google Gemini.

---

## 🧠 What It Does

MindfulChat is an anonymous, 24/7 mental health support chatbot. Users type or speak a message, and the system:

1. **Analyzes their emotional state** in real-time using a fine-tuned BERT model.
2. **Retrieves clinically verified therapy techniques** from a Pinecone vector database via RAG.
3. **Generates an empathetic, grounded response** using Google Gemini (LLM), tailored to the detected emotion.
4. **Flags crisis situations** (e.g., suicidal ideation) and surfaces Indian helpline resources immediately.

---

## 🏗️ Architecture Overview

```
┌─────────────────┐      ┌──────────────────────┐      ┌────────────────────────┐
│   Frontend      │─────▶│   Node.js Backend    │─────▶│  BERT Sentiment Service│
│  (HTML/CSS/JS)  │      │  (Express + MongoDB) │      │  (Python / FastAPI)    │
└─────────────────┘      │         │             │      └────────────────────────┘
                         │         ▼             │
                         │  ┌──────────────┐     │
                         │  │  Pinecone    │     │
                         │  │  (RAG Vector │     │
                         │  │   Search)    │     │
                         │  └──────────────┘     │
                         │         │             │
                         │         ▼             │
                         │  ┌──────────────┐     │
                         │  │ Google Gemini│     │
                         │  │   (LLM)     │     │
                         │  └──────────────┘     │
                         └──────────────────────┘
```

| Layer               | Tech Stack                                                       |
|---------------------|------------------------------------------------------------------|
| **Frontend**        | Vanilla HTML/CSS/JS, Font Awesome, Google Fonts (Outfit)         |
| **Backend API**     | Node.js, Express 5, Mongoose (MongoDB), JWT Auth, bcrypt         |
| **Sentiment Model** | Python, FastAPI, HuggingFace Transformers, PyTorch (BERT)        |
| **RAG Pipeline**    | Pinecone vector DB, Gemini Embedding API (`gemini-embedding-001`)|
| **LLM**            | Google Gemini (`gemini-2.5-flash`)                               |
| **Database**        | MongoDB (users, chat history, sessions)                          |

---

## ✨ Key Features

### AI & NLP Pipeline
- **BERT Sentiment Analysis** — Fine-tuned classifier detecting 5 emotional states: `anxiety`, `depression`, `stress`, `suicidal`, and `neutral`, with confidence scores.
- **RAG (Retrieval-Augmented Generation)** — Queries a Pinecone vector store of 50+ clinically verified therapy techniques to ground Gemini's responses in real evidence.
- **Google Gemini Integration** — Generates warm, concise, context-aware therapeutic responses using emotion-specific prompting.
- **Crisis Detection** — Automatically flags `suicidal` sentiment with high confidence (>0.7) and surfaces emergency helpline numbers (Sneha, iCall).

### User Experience
- **Speech-to-Text (STT)** — Mic button using Web Speech API for hands-free input.
- **Text-to-Speech (TTS)** — Speaker icon on bot responses for audio playback via SpeechSynthesis API.
- **Multi-Session Chat History** — Persistent chat sessions stored in MongoDB, with a sidebar for session management.
- **Dark/Light Theme Toggle** — User-selectable theme with smooth transitions.
- **Glassmorphism UI** — Modern design with animated blobs, glass-card effects, and micro-animations.
- **Fully Responsive** — Mobile-optimized layout with collapsible sidebar and hamburger menu.

### Security & Auth
- **JWT Authentication** — Stateless token-based auth with bcrypt password hashing.
- **Role-Based Access** — Admin flag on users for accessing the admin panel.
- **Admin Dashboard** — Dedicated panel for user management and system monitoring.

### Crisis Resources Page
- Curated directory of Indian mental health helplines: **AASRA**, **NIMHANS**, **Vandrevala Foundation**, **Kiran Helpline**.

---

## 📁 Project Structure

```
Testing/
├── start.ps1                   # One-command launcher (starts BERT service → Node backend)
├── frontend/
│   ├── index.html              # SPA with Home, About, Resources, Chat views
│   ├── script.js               # Client-side logic (auth, chat, STT/TTS, sessions)
│   ├── styles.css              # Full design system (themes, glassmorphism, animations)
│   ├── admin.html/js/css       # Admin panel UI
├── backend/
│   ├── app.js                  # Express server entry point
│   ├── controllers/
│   │   ├── chatController.js   # 3-step pipeline: Sentiment → RAG → Gemini
│   │   ├── ragService.js       # Pinecone vector search with retry & timeout
│   │   ├── userController.js   # Register, Login, JWT generation
│   │   └── geminiChatHandler.js
│   ├── models/
│   │   ├── User.js             # User schema with bcrypt pre-save hook
│   │   └── Chat.js             # Chat schema (message, response, sentiment, session)
│   ├── routes/                 # Express route definitions
│   └── middleware/             # JWT auth middleware
├── sentiment_service/
│   ├── app.py                  # FastAPI server serving the BERT model
│   ├── train_model.py          # BERT fine-tuning script
│   ├── dataset.py              # Dataset preparation utilities
│   ├── sentiment_dataset.csv   # Training data
│   └── model/                  # Saved BERT model weights & config
```

---

## 🚀 How to Run

```powershell
# Single command from the Testing/ directory:
powershell -ExecutionPolicy Bypass -File start.ps1
```

The launcher script:
1. Starts the **BERT Sentiment Service** (Python/FastAPI on port 5000)
2. Waits for the model to fully load (health-check polling)
3. Starts the **Node.js Backend** (Express on port 5500)
4. Frontend is served as static files at `http://localhost:5500`

---

## 👥 Built By

**Team NeuroSync** — Sohom Ghosh & Rahul Saxena
