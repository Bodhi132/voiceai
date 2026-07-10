import nltk

# Standard mapping from IPA (Wav2Vec2) to ARPABET
ipa_to_arpabet = {
    # 2-character IPA symbols
    'aɪ': 'AY',
    'aʊ': 'AW',
    'eɪ': 'EY',
    'oʊ': 'OW',
    'ɔɪ': 'OY',
    'tʃ': 'CH',
    'dʒ': 'JH',
    # 1-character IPA symbols
    'ɑ': 'AA',
    'æ': 'AE',
    'ʌ': 'AH',
    'ə': 'AH',
    'ɔ': 'AO',
    'b': 'B',
    'd': 'D',
    'ð': 'DH',
    'ɛ': 'EH',
    'ɝ': 'ER',
    'ɚ': 'ER',
    'f': 'F',
    'g': 'G',
    'h': 'HH',
    'ɪ': 'IH',
    'i': 'IY',
    'k': 'K',
    'l': 'L',
    'm': 'M',
    'n': 'N',
    'ŋ': 'NG',
    'p': 'P',
    'r': 'R',
    's': 'S',
    'ʃ': 'SH',
    't': 'T',
    'θ': 'TH',
    'ʊ': 'UH',
    'u': 'UW',
    'v': 'V',
    'w': 'W',
    'j': 'Y',
    'z': 'Z',
    'ʒ': 'ZH'
}

class ScoringService:
    def convert_ipa_to_arpabet(self, ipa_str: str) -> list[str]:
        """
        Parses a continuous IPA string into a list of ARPABET phonemes.
        """
        # Clean up spaces
        ipa_str = ipa_str.replace(" ", "")
        arpabet_tokens = []
        i = 0
        n = len(ipa_str)
        while i < n:
            # Check 2-character matches first
            if i + 1 < n and ipa_str[i:i+2] in ipa_to_arpabet:
                arpabet_tokens.append(ipa_to_arpabet[ipa_str[i:i+2]])
                i += 2
            elif ipa_str[i] in ipa_to_arpabet:
                arpabet_tokens.append(ipa_to_arpabet[ipa_str[i]])
                i += 1
            else:
                # Skip unrecognized symbols to prevent crashes
                i += 1
        return arpabet_tokens

    def calculate_word_score(self, expected_arpabet: str, actual_ipa: str) -> dict:
        """
        Compares expected ARPABET vs actual IPA phonemes at the word level.
        Returns expected, actual, score, and distance.
        """
        expected_tokens = expected_arpabet.split()
        actual_tokens = self.convert_ipa_to_arpabet(actual_ipa)
        
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
