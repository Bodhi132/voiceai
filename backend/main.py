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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services globally
transcriber = TranscriptionService(model_size="base", device="cpu", compute_type="int8")
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
        
        subprocess.run([
            ffmpeg_exe, "-y", "-i", temp_file_path, 
            "-ar", "16000", "-ac", "1", temp_wav_path
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        
        _, info = transcriber.model.transcribe(temp_wav_path)
        
        return {"language": info.language, "probability": float(info.language_probability)}
        
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

    # Save file temporarily with a unique name
    file_ext = os.path.splitext(file.filename)[1]
    temp_file_path = os.path.join(TEMP_DIR, f"{uuid.uuid4()}{file_ext}")
    
    try:
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Convert the uploaded file to a 16kHz mono WAV using imageio-ffmpeg
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        temp_wav_path = os.path.join(TEMP_DIR, f"{uuid.uuid4()}_16k.wav")
        
        subprocess.run([
            ffmpeg_exe, "-y", "-i", temp_file_path, 
            "-ar", "16000", "-ac", "1", temp_wav_path
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            
        # 1. Transcribe audio to text with word-level timestamps
        transcription_text, words_list = transcriber.transcribe(temp_wav_path)
        
        # Load full audio data for slicing
        full_audio_data, sample_rate = sf.read(temp_wav_path)
        
        words_payload = []
        scores_sum = 0
        
        for w in words_list:
            word_text = w["word"].strip()
            # Skip empty entries if any
            if not word_text:
                continue
                
            # Clean word for punctuation (keep apostrophes for words like "don't")
            cleaned_word = re_clean_word = "".join(c for c in word_text if c.isalnum() or c == "'")
            
            # Determine expected phonemes and classification (dictionary_word vs proper_noun)
            expected_phonemes, classification = expected_phoneme_recognizer.get_word_phonemes(cleaned_word)
            
            # Slice audio for this specific word (with 0.05 seconds padding)
            start_idx = max(0, int((w["start"] - 0.05) * 16000))
            end_idx = min(len(full_audio_data), int((w["end"] + 0.05) * 16000))
            word_audio = full_audio_data[start_idx:end_idx]
            
            actual_phonemes = ""
            # Only send to model if the audio chunk has reasonable size (at least 0.1 seconds)
            if len(word_audio) > 1600:
                try:
                    actual_phonemes = phoneme_recognizer.get_phonemes(word_audio)
                except Exception as e:
                    print(f"Failed to get actual phonemes for word '{word_text}': {e}")
            
            # Compare expectations vs actuals using Levenshtein distance on phoneme level
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
        
        # 5. Generate AI Speech Coach feedback
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
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clean up the temporary files
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        if 'temp_wav_path' in locals() and os.path.exists(temp_wav_path):
            os.remove(temp_wav_path)
