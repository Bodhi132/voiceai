import numpy as np
import onnxruntime as ort
import json
import os
import itertools

class PhonemeService:
    def __init__(self):
        print("Loading lightweight ONNX Phoneme model (bypassing PyTorch overhead!)...")
        current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        
        model_path = os.path.join(current_dir, "model.onnx")
        vocab_path = os.path.join(current_dir, "vocab.json")
        
        # Load vocab
        with open(vocab_path, "r", encoding="utf-8") as f:
            vocab_raw = json.load(f)
            self.vocab = {int(k): v for k, v in vocab_raw.items()}
            
        # Optimize for minimum memory footprint!
        options = ort.SessionOptions()
        options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        options.intra_op_num_threads = 1
        options.inter_op_num_threads = 1
        options.enable_mem_pattern = False
        options.enable_cpu_mem_arena = False
        
        self.session = ort.InferenceSession(
            model_path, 
            sess_options=options,
            providers=["CPUExecutionProvider"]
        )
        print("ONNX Phoneme model loaded successfully!")

    def get_phonemes(self, audio_data: np.ndarray, sample_rate: int = 16000) -> str:
        """
        Extracts phonemes from the given audio data using pure ONNX Runtime and Numpy.
        """
        try:
            # Ensure the audio is a 1D float32 array
            if audio_data.ndim > 1:
                audio_data = audio_data.mean(axis=1)  # Convert to mono if stereo
            
            # Custom Preprocessing (equivalent to Wav2Vec2Processor)
            audio_data = audio_data.astype(np.float32)
            mean = np.mean(audio_data)
            var = np.var(audio_data)
            normalized_audio = (audio_data - mean) / np.sqrt(var + 1e-7)
            
            # Reshape to [batch_size, sequence_length]
            input_values = np.expand_dims(normalized_audio, axis=0)
            
            # Run ONNX inference
            input_name = self.session.get_inputs()[0].name
            outputs = self.session.run(None, {input_name: input_values})
            logits = outputs[0]
            
            # Decode CTC Logits
            predicted_ids = np.argmax(logits, axis=-1)[0]
            
            # Group consecutive duplicates and filter blanks
            phonemes = []
            for token_id, group in itertools.groupby(predicted_ids):
                token = self.vocab.get(token_id, "")
                if token not in ["", "[PAD]", "<s>", "</s>", "|", "<pad>"]:
                    phonemes.append(token)
                    
            transcription = " ".join(phonemes).strip()
            return transcription
        except Exception as e:
            print(f"Error during ONNX phoneme extraction: {e}")
            return ""
