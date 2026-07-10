import torch
import soundfile as sf
from transformers import Wav2Vec2Processor, Wav2Vec2ForCTC

class PhonemeService:
    def __init__(self):
        # We use a robust, pre-trained phoneme recognition model based on Wav2Vec2.
        model_id = "vitouphy/wav2vec2-xls-r-300m-phoneme"
        print("Loading Phoneme model (this may take a minute on first run)...")
        self.processor = Wav2Vec2Processor.from_pretrained(model_id)
        self.model = Wav2Vec2ForCTC.from_pretrained(model_id)
        self.device = torch.device("cpu")
        self.model.to(self.device)
        print("Phoneme model loaded!")

    def get_phonemes(self, audio_input, lang_id: str = "eng") -> str:
        """
        Extracts phonemes directly from the audio file or numpy array using Wav2Vec2.
        """
        try:
            # Handle both file paths and pre-loaded numpy arrays (for word-level slicing)
            if isinstance(audio_input, str):
                data, sample_rate = sf.read(audio_input)
            else:
                data = audio_input

            # Ensure mono
            if len(data.shape) > 1:
                data = data.mean(axis=1)

            # Process audio through model
            input_values = self.processor(data, return_tensors="pt", sampling_rate=16000).input_values
            
            with torch.no_grad():
                logits = self.model(input_values.to(self.device)).logits
            
            # Decode the predicted phoneme IDs
            predicted_ids = torch.argmax(logits, dim=-1)
            transcription = self.processor.batch_decode(predicted_ids)
            
            return transcription[0]
        except Exception as e:
            print(f"Error during phoneme extraction: {e}")
            raise e
