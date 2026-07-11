import nltk

class ScoringService:
    def calculate_word_score(self, expected_arpabet: str, actual_phonemes: str) -> dict:
        """
        Compares expected ARPABET vs actual phonemes at the word level.
        Returns expected, actual, score, and distance.
        """
        expected_tokens = expected_arpabet.split()
        
        # The model outputs space-separated lowercase ARPABET phonemes (or similar tokens)
        ignore_tokens = {'h#', 'spn', '|', '<s>', '</s>', '[unk]', '[pad]'}
        
        raw_actual_tokens = actual_phonemes.split()
        actual_tokens = [p.upper() for p in raw_actual_tokens if p.lower() not in ignore_tokens]
        
        # Calculate token-level edit distance
        distance = nltk.edit_distance(expected_tokens, actual_tokens)
        
        max_len = max(len(expected_tokens), len(actual_tokens))
        if max_len == 0:
            score = 100.0
        else:
            score = max(0.0, 100.0 - (distance / max_len) * 100.0)
            
        return {
            "expected": " ".join(expected_tokens),
            "actual": " ".join(actual_tokens),
            "score": round(score, 2),
            "distance": distance
        }
