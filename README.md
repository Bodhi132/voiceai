# VoiceAI - AI Pronunciation Assessment Tool

VoiceAI is a full-stack web application designed to help non-native English speakers improve their pronunciation. By leveraging highly optimized local ONNX models and cloud-based LLMs, it provides a highly detailed, word-by-word breakdown of a user's spoken English compared to standard textbook pronunciation, complete with actionable coaching feedback.

## 🚀 Features

- **Blazing Fast Transcription**: Uses the **Groq API** (`whisper-large-v3`) to instantly transcribe audio and locate the exact start and end timestamps of every spoken word, while verifying the language is English.
- **Phoneme Alignment & Scoring**:
  - Compares the **Expected Pronunciation** (using `cmudict` or a `g2p_en` neural fallback for proper nouns) against the **Actual Pronunciation**.
  - **Memory-Optimized Local Inference**: Extracts actual phonemes from raw audio using a `Wav2Vec2` model (`vitouphy/wav2vec2-xls-r-300m-phoneme`). To fit into strict free-tier cloud environments, the 1.2 GB PyTorch model is mathematically compressed into a highly optimized 400 MB **INT8 ONNX graph**, allowing it to run entirely on the CPU with minimal RAM.
  - Scores every individual word using Levenshtein distance matching on the phonetic sounds.
- **AI Speech Coach**: Analyzes phonetic errors and overall scores using the Groq API (Llama 3) to generate a customized, encouraging practice routine.
- **Beautiful UI**: Built with Next.js and Tailwind CSS, featuring smooth micro-interactions powered by Framer Motion and a detailed results dashboard.

---

## 🏗️ Architecture

```mermaid
flowchart TD
    classDef frontend fill:#3B82F6,stroke:#2563EB,stroke-width:2px,color:white;
    classDef backend fill:#10B981,stroke:#059669,stroke-width:2px,color:white;
    classDef external fill:#F59E0B,stroke:#D97706,stroke-width:2px,color:white;
    classDef aiModel fill:#8B5CF6,stroke:#7C3AED,stroke-width:2px,color:white;

    subgraph Client ["Next.js Frontend (Deployed on Render)"]
        direction TB
        UploadPage["Upload UI\n(Audio Capture)"]:::frontend
        ResultsPage["Results Dashboard\n(Score & Feedback)"]:::frontend
    end

    subgraph Server ["FastAPI Backend (Deployed on Azure App Service)"]
        direction TB
        MainRouter["main.py\n(API Router)"]:::backend
        FFmpeg["FFmpeg\n(Audio Normalization)"]:::backend
        ExpectedPhonemes["ExpectedPhonemeService\n(g2p_en & cmudict)"]:::aiModel
        ActualPhonemes["PhonemeService\n(ONNX INT8 Wav2Vec2)"]:::aiModel
        Scorer["ScoringService\n(Levenshtein Distance)"]:::backend
        Feedback["FeedbackService\n(Prompt Generation)"]:::backend
    end

    subgraph Cloud ["Groq Cloud APIs"]
        GroqWhisper["Whisper-large-v3\n(Transcribe & Timestamps)"]:::external
        GroqLlama["Llama-3\n(AI Speech Coach)"]:::external
    end

    UploadPage -- "1. Upload Audio" --> MainRouter
    MainRouter -- "2. Normalize Audio" --> FFmpeg
    FFmpeg -- "3. Clean Audio" --> MainRouter
    
    MainRouter -- "4. Check Language & Transcribe" --> GroqWhisper
    GroqWhisper -- "5. Transcript & Timestamps" --> MainRouter
    
    MainRouter -- "6. Send Word Text" --> ExpectedPhonemes
    MainRouter -- "7. Sliced Audio Chunks" --> ActualPhonemes
    
    ExpectedPhonemes -- "Expected Sounds" --> Scorer
    ActualPhonemes -- "Actual Sounds" --> Scorer
    
    Scorer -- "8. Word Scores" --> Feedback
    Feedback -- "9. Generate Prompt" --> GroqLlama
    GroqLlama -- "10. AI Coaching Feedback" --> Feedback
    
    Feedback -- "11. Final JSON Payload" --> ResultsPage
```

---

## ☁️ Deployment & CI/CD Strategy

To successfully deploy this memory-heavy AI application for free, a highly customized Continuous Integration (CI/CD) pipeline was built to navigate strict cloud memory limits:

- **Frontend**: Deployed seamlessly on **Render**.
- **Backend**: Hosted on **Azure App Service (Linux)**.
- **The Memory Challenge**: Initially, we attempted to deploy the FastAPI backend on **Render's Free Tier**, but the strict 512 MB RAM limit caused immediate `Out of Memory` crashes when attempting to load the PyTorch machine learning models. We then pivoted to Azure's B1 tier (which offers 1.75 GB of RAM). However, Azure also struggled and timed out when trying to download and compile the massive 1.2 GB PyTorch models during the deployment build phase. 
- **GitHub Actions (The Secret Sauce)**: To bypass all cloud memory constraints, a custom **GitHub Actions workflow** was engineered to intercept code pushes. We hijacked GitHub's powerful 7 GB RAM runner to act as a remote build server. The GitHub runner downloads the heavy PyTorch model, executes the `export_onnx.py` script to mathematically compress it into INT8 ONNX files, and packages only the lightweight, 400 MB result directly to Azure. Azure simply boots up `uvicorn` and serves the highly-optimized API effortlessly!

---

## 💻 Tech Stack

**Frontend:**
- [Next.js](https://nextjs.org/) (App Router)
- React
- Tailwind CSS
- Framer Motion

**Backend:**
- [FastAPI](https://fastapi.tiangolo.com/) (Python)
- ONNX Runtime (CPU Inference)
- Numpy
- `g2p_en` & `nltk` (Expected Phonemes)
- [Groq API](https://groq.com/) (Whisper for transcription, Llama 3 for Speech Coach Feedback)

---

## 🛠️ Local Setup Instructions

### Prerequisites
- **Node.js** (v18+)
- **Python** (3.9+)
- **FFmpeg** installed on your system.

### 1. Backend Setup (FastAPI)

Navigate to the backend directory and set up a Python virtual environment:

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`
```

Install the requirements and generate the ONNX model:

```bash
pip install torch transformers onnx onnxruntime onnxscript -r requirements.txt
python export_onnx.py
pip uninstall -y torch transformers onnxscript
```

Create a `.env` file in the `backend/` folder and add your Groq API key:

```env
GROQ_API_KEY=gsk_your_api_key_here
```

Start the FastAPI server:

```bash
uvicorn main:app --reload
```
*(The API will be available at `http://localhost:8000`)*

### 2. Frontend Setup (Next.js)

Open a new terminal, navigate to the client directory, and install the dependencies:

```bash
cd client
npm install
```

Start the Next.js development server:

```bash
npm run dev
```
*(The frontend will be available at `http://localhost:3000`)*

---

*Built by Bodhi132*
