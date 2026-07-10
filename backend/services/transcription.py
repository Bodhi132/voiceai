from faster_whisper import WhisperModel
import os

class TranscriptionService:
    def __init__(self, model_size="base", device="cpu", compute_type="int8"):
        # We initialize the model only once. For CPU, int8 is standard.
        self.model = WhisperModel(model_size, device=device, compute_type=compute_type)

    def transcribe(self, file_path: str) -> tuple[str, list[dict]]:
        """
        Transcribes the given audio file and returns the combined text and word-level timestamps.
        """
        try:
            segments, info = self.model.transcribe(file_path, beam_size=5, word_timestamps=True)
            
            words_list = []
            full_text = []
            for segment in segments:
                full_text.append(segment.text)
                if segment.words:
                    for word in segment.words:
                        words_list.append({
                            "word": word.word,
                            "start": word.start,
                            "end": word.end
                        })
            return "".join(full_text).strip(), words_list
        except Exception as e:
            print(f"Error during transcription: {e}")
            raise e
