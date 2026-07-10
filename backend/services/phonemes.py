import torch
from transformers import Wav2Vec2Processor, Wav2Vec2ForCTC
import numpy as np

class PhonemeService:
    def __init__(self):
        print("Loading local Phoneme model (this may take a minute on first run)...")
        model_id = "vitouphy/wav2vec2-xls-r-300m-phoneme"
        self.processor = Wav2Vec2Processor.from_pretrained(model_id)
        self.model = Wav2Vec2ForCTC.from_pretrained(model_id)
        print("Phoneme model loaded!")

    def get_phonemes(self, audio_data: np.ndarray, sample_rate: int = 16000) -> str:
        """
        Extracts phonemes from the given audio data using a local Wav2Vec2 model.
        """
        try:
            # Ensure the audio is a 1D float32 array
            if audio_data.ndim > 1:
                audio_data = audio_data.mean(axis=1)  # Convert to mono if stereo
            
            inputs = self.processor(audio_data, sampling_rate=sample_rate, return_tensors="pt")
            
            with torch.no_grad():
                logits = self.model(**inputs).logits
                
            predicted_ids = torch.argmax(logits, dim=-1)
            transcription = self.processor.batch_decode(predicted_ids)[0]
            
            return transcription.strip()
        except Exception as e:
            print(f"Error during local phoneme extraction: {e}")
            return ""
