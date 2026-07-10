from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from services.phonemes import PhonemeService
from services.transcription import TranscriptionService
from services.expected_phonemes import ExpectedPhonemeService
from services.scoring import ScoringService
from services.feedback import FeedbackService
import shutil
import os
import uuid
import subprocess
import imageio_ffmpeg
import soundfile as sf
import dotenv

# Load environment variables from .env file
dotenv.load_dotenv()

app = FastAPI()

# Allow CORS for Next.js frontend
frontend_urls = os.getenv("FRONTEND_URL", "http://localhost:3000")
allowed_origins = [url.strip() for url in frontend_urls.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services globally
transcriber = TranscriptionService()
expected_phoneme_recognizer = ExpectedPhonemeService()
phoneme_recognizer = PhonemeService()
scorer = ScoringService()
feedback_service = FeedbackService()

TEMP_DIR = "temp_uploads"
os.makedirs(TEMP_DIR, exist_ok=True)

@app.post("/detect-language")
async def detect_language_endpoint(file: UploadFile = File(...)):
    if not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File provided is not an audio file.")

    file_ext = os.path.splitext(file.filename)[1]
    temp_file_path = os.path.join(TEMP_DIR, f"{uuid.uuid4()}{file_ext}")
    
    try:
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        temp_wav_path = os.path.join(TEMP_DIR, f"{uuid.uuid4()}_16k.wav")
        
        # Convert first 30s to WAV
        subprocess.run([
            ffmpeg_exe, "-y", "-i", temp_file_path, 
            "-ar", "16000", "-ac", "1", "-t", "30", temp_wav_path
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        
        # Await the async groq call
        info = await transcriber.detect_language(temp_wav_path)
        
        return info
        
    except Exception as e:
        print(f"Error in language detection: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        if 'temp_wav_path' in locals() and os.path.exists(temp_wav_path):
            os.remove(temp_wav_path)

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    if not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File provided is not an audio file.")

    file_ext = os.path.splitext(file.filename)[1]
    temp_file_path = os.path.join(TEMP_DIR, f"{uuid.uuid4()}{file_ext}")
    
    try:
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        temp_wav_path = os.path.join(TEMP_DIR, f"{uuid.uuid4()}_16k.wav")
        
        subprocess.run([
            ffmpeg_exe, "-y", "-i", temp_file_path, 
            "-ar", "16000", "-ac", "1", temp_wav_path
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            
        # 1. Transcribe audio to text with word-level timestamps via Groq (Async)
        transcription_text, words_list = await transcriber.transcribe(temp_wav_path)
        
        # Load full audio data for slicing
        full_audio_data, sample_rate = sf.read(temp_wav_path)
        
        words_payload = []
        scores_sum = 0
        
        for w in words_list:
            word_text = w["word"].strip()
            if not word_text:
                continue
                
            start_idx = max(0, int((w["start"] - 0.05) * 16000))
            end_idx = min(len(full_audio_data), int((w["end"] + 0.05) * 16000))
            word_audio = full_audio_data[start_idx:end_idx]
            
            actual_phonemes = ""
            if len(word_audio) > 1600:
                # 2. Extract actual phonemes using local PyTorch model (Sync)
                actual_phonemes = phoneme_recognizer.get_phonemes(word_audio)
                
            # 3. Calculate scores
            cleaned_word = "".join(c for c in word_text if c.isalnum() or c == "'")
            expected_phonemes, classification = expected_phoneme_recognizer.get_word_phonemes(cleaned_word)
            
            word_score_data = scorer.calculate_word_score(expected_phonemes, actual_phonemes)
            
            words_payload.append({
                "word": word_text,
                "classification": classification,
                "expected": word_score_data["expected"],
                "actual": word_score_data["actual"],
                "score": word_score_data["score"]
            })
            scores_sum += word_score_data["score"]
            
        overall_score = round(scores_sum / len(words_payload), 2) if words_payload else 100.0
        
        # 4. Generate AI Speech Coach feedback
        feedback_text = feedback_service.generate_feedback(transcription_text, overall_score, words_payload)
        
        response = {
            "transcript": transcription_text,
            "overall_score": overall_score,
            "words": words_payload
        }
        if feedback_text is not None:
            response["ai_feedback"] = feedback_text
            
        return response
        
    except Exception as e:
        print(f"Error in transcription endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        if 'temp_wav_path' in locals() and os.path.exists(temp_wav_path):
            os.remove(temp_wav_path)
