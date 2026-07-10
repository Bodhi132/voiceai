import asyncio
import os
from services.transcription import TranscriptionService
from services.expected_phonemes import ExpectedPhonemeService
from services.phonemes import PhonemeService
from services.scoring import ScoringService

def test():
    transcriber = TranscriptionService(model_size="base", device="cpu", compute_type="int8")
    expected_phoneme_recognizer = ExpectedPhonemeService()
    phoneme_recognizer = PhonemeService()
    scorer = ScoringService()
    
    # We need a dummy audio file. Let's just test the ExpectedPhonemeService and ScoringService directly first.
    text = "Hello world"
    expected = expected_phoneme_recognizer.get_phonemes(text)
    print("Expected:", expected)
    
    actual = "həloʊwɜrld"
    score = scorer.calculate_score(expected, actual)
    print("Score:", score)

if __name__ == "__main__":
    test()
