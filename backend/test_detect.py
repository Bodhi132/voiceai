import soundfile as sf
import numpy as np
from faster_whisper import WhisperModel

try:
    model = WhisperModel("base", device="cpu", compute_type="int8")
    
    # create a quick 1-sec dummy audio array at 16000 hz
    dummy_audio = np.zeros(16000, dtype=np.float32)
    
    lang, prob, _ = model.detect_language(audio=dummy_audio)
    print(f"Lang: {lang}, Prob: {prob}")
except Exception as e:
    print(e)
