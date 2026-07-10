import os
from groq import AsyncGroq

class TranscriptionService:
    def __init__(self):
        # Initialize Groq client (uses GROQ_API_KEY environment variable)
        self.client = AsyncGroq()

    async def transcribe(self, file_path: str) -> tuple[str, list[dict]]:
        """
        Transcribes the given audio file using Groq Whisper API and returns the combined text and word-level timestamps.
        """
        try:
            with open(file_path, "rb") as file:
                # Call Groq Whisper API asynchronously
                transcription = await self.client.audio.transcriptions.create(
                    file=(os.path.basename(file_path), file.read()),
                    model="whisper-large-v3",
                    response_format="verbose_json",
                    timestamp_granularities=["word"]
                )
            
            full_text = getattr(transcription, "text", "")
            words_list = []
            
            words = getattr(transcription, "words", [])
            for w in words:
                # Handle both dict-like and object-like access depending on SDK versions
                word_text = w.word if hasattr(w, 'word') else w.get('word', '')
                start = w.start if hasattr(w, 'start') else w.get('start', 0.0)
                end = w.end if hasattr(w, 'end') else w.get('end', 0.0)
                
                words_list.append({
                    "word": word_text,
                    "start": float(start),
                    "end": float(end)
                })
                    
            return full_text.strip(), words_list
            
        except Exception as e:
            print(f"Error during Groq transcription: {e}")
            raise e

    async def detect_language(self, file_path: str) -> dict:
        """
        Detects the language of the audio file using Groq Whisper API.
        """
        try:
            with open(file_path, "rb") as file:
                transcription = await self.client.audio.transcriptions.create(
                    file=(os.path.basename(file_path), file.read()),
                    model="whisper-large-v3",
                    response_format="verbose_json"
                )
            
            # Whisper returns the language code (e.g., 'english' or 'en')
            lang = getattr(transcription, "language", "en")
            
            # Convert 'english' to 'en' just in case.
            lang_code = lang[:2].lower() if len(lang) > 2 else lang.lower()
            
            return {"language": lang_code, "probability": 1.0}
        except Exception as e:
            print(f"Error during Groq language detection: {e}")
            raise e
