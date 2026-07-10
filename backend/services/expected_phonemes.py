import nltk
from nltk.corpus import cmudict
from g2p_en import G2p
import re

class ExpectedPhonemeService:
    def __init__(self):
        # Initialize the G2P (Grapheme-to-Phoneme) model
        self.g2p = G2p()
        # Initialize CMUDict for dictionary word lookup
        try:
            self.cmu_dict = cmudict.dict()
        except LookupError:
            nltk.download('cmudict')
            self.cmu_dict = cmudict.dict()

    def get_word_phonemes(self, word: str) -> tuple[str, str]:
        """
        Determines whether a word is likely an English dictionary word or a proper noun.
        Returns (phonemes_str, classification).
        """
        try:
            # Strip punctuation for dictionary lookup
            cleaned_word = re.sub(r"[^a-zA-Z']", "", word).lower()
            
            if not cleaned_word:
                return "", "dictionary_word"

            if cleaned_word in self.cmu_dict:
                # Dictionary word: Retrieve standard pronunciation
                raw_phonemes = self.cmu_dict[cleaned_word][0]
                # Strip lexical stress digits (e.g., 'AH0' -> 'AH', 'EY1' -> 'EY')
                clean_phonemes = [re.sub(r"\d", "", p) for p in raw_phonemes]
                return " ".join(clean_phonemes), "dictionary_word"
            else:
                # Proper noun / OOV: Use G2P-en to predict phonemes
                raw_phonemes = self.g2p(cleaned_word)
                clean_phonemes = []
                for p in raw_phonemes:
                    p_clean = re.sub(r"\d", "", p).strip()
                    # Filter out non-alphabetic elements (like punctuation tokens)
                    if p_clean and p_clean.isalnum():
                        clean_phonemes.append(p_clean)
                return " ".join(clean_phonemes), "proper_noun"
        except Exception as e:
            print(f"Error during expected phoneme extraction for '{word}': {e}")
            return "", "proper_noun"
