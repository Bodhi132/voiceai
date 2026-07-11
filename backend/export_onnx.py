import torch
from transformers import Wav2Vec2Processor, Wav2Vec2ForCTC
import json
import os
from onnxruntime.quantization import quantize_dynamic, QuantType

def export_model():
    model_id = "vitouphy/wav2vec2-xls-r-300m-phoneme"
    print(f"Loading {model_id} model and processor...")
    processor = Wav2Vec2Processor.from_pretrained(model_id)
    model = Wav2Vec2ForCTC.from_pretrained(model_id)

    # Set model to evaluation mode
    model.eval()

    # Create dummy input: batch_size=1, sequence_length=16000 (1 second of audio at 16kHz)
    dummy_input = torch.randn(1, 16000)

    print("Exporting model to temporary ONNX format (uncompressed)...")
    
    temp_model_path = "temp_model.onnx"
    quantized_model_path = "model.onnx"
    
    # Export the model
    torch.onnx.export(
        model, 
        dummy_input, 
        temp_model_path, 
        export_params=True,
        opset_version=18, 
        do_constant_folding=True,
        input_names=['input_values'], 
        output_names=['logits'],
        dynamic_axes={
            'input_values': {0: 'batch_size', 1: 'sequence_length'},
            'logits': {0: 'batch_size', 1: 'sequence_length'}
        }
    )
    print("Successfully exported to uncompressed ONNX!")
    
    print("Quantizing model (MatMul only) to INT8...")
    quantize_dynamic(
        temp_model_path,
        quantized_model_path,
        weight_type=QuantType.QUInt8,
        op_types_to_quantize=['MatMul']
    )
    print("Successfully quantized model!")
    
    # Clean up uncompressed models
    if os.path.exists(temp_model_path):
        os.remove(temp_model_path)

    # Extract vocabulary
    print("Extracting vocabulary...")
    vocab = processor.tokenizer.get_vocab()
    
    # Invert the vocabulary to map IDs to characters/phonemes
    inv_vocab = {v: k for k, v in vocab.items()}
    
    with open("vocab.json", "w", encoding="utf-8") as f:
        json.dump(inv_vocab, f, ensure_ascii=False, indent=2)
    
    print("Successfully extracted vocab.json!")

if __name__ == "__main__":
    export_model()
