import asyncio
from services.phonemes import PhonemeService
import soundfile as sf
import os

def test():
    print("Testing ONNX Phoneme Extraction...")
    service = PhonemeService()
    
    # Check memory footprint
    import psutil
    process = psutil.Process(os.getpid())
    print(f"Memory Usage after loading model: {process.memory_info().rss / 1024 / 1024:.2f} MB")
    
    # Load test audio
    audio_path = "test_dummy.wav"
    if not os.path.exists(audio_path):
        print("test_dummy.wav not found. Generating a 1s dummy audio.")
        import numpy as np
        audio = np.zeros(16000, dtype=np.float32)
    else:
        audio, sr = sf.read(audio_path)
    
    phonemes = service.get_phonemes(audio)
    print("Resulting Phonemes:", phonemes)

if __name__ == "__main__":
    test()
