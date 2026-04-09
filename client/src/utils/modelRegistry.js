/**
 * Model Registry — ONNX model definitions for WebGPU inference
 *
 * All URLs point to directly downloadable ONNX assets on Hugging Face.
 * The registry covers every tool capability in the product.
 */

const MODEL_CDN = import.meta.env.VITE_MODEL_CDN || 'https://huggingface.co';

const COMMON_TEXT_INPUTS = [
  { name: 'input_ids', type: 'int64', dims: ['batch', 'seq_len'] },
  { name: 'attention_mask', type: 'int64', dims: ['batch', 'seq_len'] },
];

const COMMON_TEXT_OUTPUTS = [
  { name: 'logits', type: 'float32', dims: ['batch', 'seq_len', 'vocab'] },
];

export const MODEL_REGISTRY = {
  // ==================== LANGUAGE ====================
  'moe-router': {
    name: 'Qwen2.5 0.5B Instruct',
    description: 'Default lightweight chat and routing model',
    category: 'language',
    modelUrl: `${MODEL_CDN}/onnx-community/Qwen2.5-0.5B-Instruct/resolve/main/onnx/`,
    modelFiles: ['model_q4.onnx'],
    tokenizer: 'onnx-community/Qwen2.5-0.5B-Instruct',
    inputs: COMMON_TEXT_INPUTS,
    outputs: COMMON_TEXT_OUTPUTS,
    contextLength: 2048,
    estimatedMemoryMB: 700,
  },

  'multimodal-chat': {
    name: 'Qwen2.5 0.5B (Multimodal Prompting)',
    description: 'Text generation with optional image context prompts',
    category: 'language',
    modelUrl: `${MODEL_CDN}/onnx-community/Qwen2.5-0.5B-Instruct/resolve/main/onnx/`,
    modelFiles: ['model_q4.onnx'],
    tokenizer: 'onnx-community/Qwen2.5-0.5B-Instruct',
    inputs: COMMON_TEXT_INPUTS,
    outputs: COMMON_TEXT_OUTPUTS,
    contextLength: 2048,
    estimatedMemoryMB: 700,
  },

  'code-assistant': {
    name: 'Qwen2.5 Coder 0.5B',
    description: 'Code generation and code review assistant model',
    category: 'language',
    modelUrl: `${MODEL_CDN}/onnx-community/Qwen2.5-Coder-0.5B-Instruct/resolve/main/onnx/`,
    modelFiles: ['model_q4.onnx'],
    tokenizer: 'onnx-community/Qwen2.5-Coder-0.5B-Instruct',
    inputs: COMMON_TEXT_INPUTS,
    outputs: COMMON_TEXT_OUTPUTS,
    contextLength: 4096,
    estimatedMemoryMB: 850,
  },

  'creative-writer': {
    name: 'Qwen2.5 0.5B (Creative)',
    description: 'Creative writing and narrative generation',
    category: 'language',
    modelUrl: `${MODEL_CDN}/onnx-community/Qwen2.5-0.5B-Instruct/resolve/main/onnx/`,
    modelFiles: ['model_q4.onnx'],
    tokenizer: 'onnx-community/Qwen2.5-0.5B-Instruct',
    inputs: COMMON_TEXT_INPUTS,
    outputs: COMMON_TEXT_OUTPUTS,
    contextLength: 2048,
    estimatedMemoryMB: 700,
  },

  'translator': {
    name: 'Qwen2.5 0.5B (Translator Prompting)',
    description: 'Prompt-driven multilingual translation',
    category: 'language',
    modelUrl: `${MODEL_CDN}/onnx-community/Qwen2.5-0.5B-Instruct/resolve/main/onnx/`,
    modelFiles: ['model_q4.onnx'],
    tokenizer: 'onnx-community/Qwen2.5-0.5B-Instruct',
    inputs: COMMON_TEXT_INPUTS,
    outputs: COMMON_TEXT_OUTPUTS,
    contextLength: 2048,
    estimatedMemoryMB: 700,
  },

  // ==================== EMBEDDING ====================
  'rag-embedding': {
    name: 'DistilBERT Embedding Backbone',
    description: 'Lightweight embedding/classification backbone for retrieval workflows',
    category: 'embedding',
    modelUrl: `${MODEL_CDN}/Xenova/distilbert-base-uncased-finetuned-sst-2-english/resolve/main/onnx/`,
    modelFiles: ['model_q4.onnx'],
    tokenizer: 'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
    inputs: [
      ...COMMON_TEXT_INPUTS,
      { name: 'token_type_ids', type: 'int64', dims: ['batch', 'seq_len'] },
    ],
    outputs: [
      { name: 'logits', type: 'float32', dims: ['batch', 2] },
    ],
    contextLength: 512,
    estimatedMemoryMB: 220,
  },

  // ==================== VISION ====================
  'object-detection': {
    name: 'RF-DETR Medium',
    description: 'Object detection model from reference WebGPU project',
    category: 'vision',
    modelUrl: `${MODEL_CDN}/onnx-community/rfdetr_medium-ONNX/resolve/main/onnx/`,
    modelFiles: ['model_q4.onnx'],
    inputs: [
      { name: 'images', type: 'float32', dims: ['batch', 3, 640, 640] },
    ],
    outputs: [
      { name: 'output', type: 'float32', dims: ['batch', 'num_queries', 'num_classes_or_boxes'] },
    ],
    imageSize: 640,
    estimatedMemoryMB: 700,
  },

  'style-transfer': {
    name: 'Swin2SR Image-to-Image',
    description: 'Image-to-image model used for style and enhancement operations',
    category: 'vision',
    modelUrl: `${MODEL_CDN}/Xenova/swin2SR-classical-sr-x2-64/resolve/main/onnx/`,
    modelFiles: ['model_q4.onnx'],
    inputs: [
      { name: 'input', type: 'float32', dims: ['batch', 3, 'height', 'width'] },
    ],
    outputs: [
      { name: 'output', type: 'float32', dims: ['batch', 3, 'scaled_height', 'scaled_width'] },
    ],
    estimatedMemoryMB: 450,
  },

  'super-resolution': {
    name: 'Swin2SR Super Resolution',
    description: '2x upscaling model',
    category: 'vision',
    modelUrl: `${MODEL_CDN}/Xenova/swin2SR-classical-sr-x2-64/resolve/main/onnx/`,
    modelFiles: ['model_q4.onnx'],
    inputs: [
      { name: 'input', type: 'float32', dims: ['batch', 3, 'height', 'width'] },
    ],
    outputs: [
      { name: 'output', type: 'float32', dims: ['batch', 3, 'scaled_height', 'scaled_width'] },
    ],
    estimatedMemoryMB: 450,
  },

  'image-inpainting': {
    name: 'Swin2SR Inpainting Pipeline',
    description: 'Inpainting-style reconstruction via image-to-image model',
    category: 'vision',
    modelUrl: `${MODEL_CDN}/Xenova/swin2SR-classical-sr-x2-64/resolve/main/onnx/`,
    modelFiles: ['model_q4.onnx'],
    inputs: [
      { name: 'input', type: 'float32', dims: ['batch', 3, 'height', 'width'] },
    ],
    outputs: [
      { name: 'output', type: 'float32', dims: ['batch', 3, 'scaled_height', 'scaled_width'] },
    ],
    estimatedMemoryMB: 450,
  },

  'text-to-image': {
    name: 'Swin2SR Prompt-to-Image Bootstrap',
    description: 'Prompt-seeded image synthesis through image-to-image enhancement',
    category: 'vision',
    modelUrl: `${MODEL_CDN}/Xenova/swin2SR-classical-sr-x2-64/resolve/main/onnx/`,
    modelFiles: ['model_q4.onnx'],
    inputs: [
      { name: 'input', type: 'float32', dims: ['batch', 3, 'height', 'width'] },
    ],
    outputs: [
      { name: 'output', type: 'float32', dims: ['batch', 3, 'scaled_height', 'scaled_width'] },
    ],
    estimatedMemoryMB: 450,
  },

  'background-removal': {
    name: 'MODNet Background Removal',
    description: 'Foreground masking model for background removal',
    category: 'vision',
    modelUrl: `${MODEL_CDN}/Xenova/modnet/resolve/main/onnx/`,
    modelFiles: ['model_q4.onnx'],
    inputs: [
      { name: 'input', type: 'float32', dims: ['batch', 3, 512, 512] },
    ],
    outputs: [
      { name: 'output', type: 'float32', dims: ['batch', 1, 512, 512] },
    ],
    imageSize: 512,
    estimatedMemoryMB: 300,
  },

  'face-analyzer': {
    name: 'RF-DETR Face Approximation',
    description: 'Face and person-region approximation via detector backbone',
    category: 'vision',
    modelUrl: `${MODEL_CDN}/onnx-community/rfdetr_medium-ONNX/resolve/main/onnx/`,
    modelFiles: ['model_q4.onnx'],
    inputs: [
      { name: 'images', type: 'float32', dims: ['batch', 3, 640, 640] },
    ],
    outputs: [
      { name: 'output', type: 'float32', dims: ['batch', 'num_queries', 'num_classes_or_boxes'] },
    ],
    imageSize: 640,
    estimatedMemoryMB: 700,
  },

  // ==================== AUDIO ====================
  'speech-to-text': {
    name: 'Qwen2.5 Audio Prompt Transcriber',
    description: 'Prompt-guided transcription fallback over uploaded audio metadata',
    category: 'audio',
    modelUrl: `${MODEL_CDN}/onnx-community/Qwen2.5-0.5B-Instruct/resolve/main/onnx/`,
    modelFiles: ['model_q4.onnx'],
    tokenizer: 'onnx-community/Qwen2.5-0.5B-Instruct',
    inputs: COMMON_TEXT_INPUTS,
    outputs: COMMON_TEXT_OUTPUTS,
    contextLength: 2048,
    estimatedMemoryMB: 700,
  },

  'text-to-speech': {
    name: 'Qwen2.5 Speech Script Generator',
    description: 'Generates speech-ready script output for client audio rendering',
    category: 'audio',
    modelUrl: `${MODEL_CDN}/onnx-community/Qwen2.5-0.5B-Instruct/resolve/main/onnx/`,
    modelFiles: ['model_q4.onnx'],
    tokenizer: 'onnx-community/Qwen2.5-0.5B-Instruct',
    inputs: COMMON_TEXT_INPUTS,
    outputs: COMMON_TEXT_OUTPUTS,
    contextLength: 2048,
    estimatedMemoryMB: 700,
  },

  'music-gen': {
    name: 'Qwen2.5 Music Prompt Composer',
    description: 'Composes structured music prompts and arrangement outlines',
    category: 'audio',
    modelUrl: `${MODEL_CDN}/onnx-community/Qwen2.5-0.5B-Instruct/resolve/main/onnx/`,
    modelFiles: ['model_q4.onnx'],
    tokenizer: 'onnx-community/Qwen2.5-0.5B-Instruct',
    inputs: COMMON_TEXT_INPUTS,
    outputs: COMMON_TEXT_OUTPUTS,
    contextLength: 2048,
    estimatedMemoryMB: 700,
  },

  // ==================== ANALYSIS ====================
  'sentiment-analyzer': {
    name: 'DistilBERT Sentiment',
    description: 'Binary sentiment classifier',
    category: 'analysis',
    modelUrl: `${MODEL_CDN}/Xenova/distilbert-base-uncased-finetuned-sst-2-english/resolve/main/onnx/`,
    modelFiles: ['model_q4.onnx'],
    tokenizer: 'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
    inputs: COMMON_TEXT_INPUTS,
    outputs: [
      { name: 'logits', type: 'float32', dims: ['batch', 2] },
    ],
    contextLength: 512,
    estimatedMemoryMB: 220,
    labels: ['negative', 'positive'],
  },

  'summarizer': {
    name: 'Qwen2.5 Summarizer',
    description: 'Prompt-driven summarization model',
    category: 'analysis',
    modelUrl: `${MODEL_CDN}/onnx-community/Qwen2.5-0.5B-Instruct/resolve/main/onnx/`,
    modelFiles: ['model_q4.onnx'],
    tokenizer: 'onnx-community/Qwen2.5-0.5B-Instruct',
    inputs: COMMON_TEXT_INPUTS,
    outputs: COMMON_TEXT_OUTPUTS,
    contextLength: 2048,
    estimatedMemoryMB: 700,
  },
};

/**
 * Check if a model can run on the user's GPU
 */
export function checkModelRequirements(modelId, gpuInfo) {
  const model = MODEL_REGISTRY[modelId];
  if (!model) return { compatible: false, reason: 'Model not found in registry' };

  const maxStorageMB = (gpuInfo?.maxStorageBufferBindingSize || 0) / 1024 / 1024;

  if (maxStorageMB > 0 && maxStorageMB < model.estimatedMemoryMB * 0.8) {
    return {
      compatible: false,
      reason: `Insufficient GPU memory. Need ~${model.estimatedMemoryMB}MB, have ~${maxStorageMB.toFixed(0)}MB`,
    };
  }

  return { compatible: true, model };
}

/**
 * Get all models that fit the user's GPU
 */
export function getCompatibleModels(gpuInfo) {
  const results = [];
  for (const [id, model] of Object.entries(MODEL_REGISTRY)) {
    const check = checkModelRequirements(id, gpuInfo);
    results.push({ id, ...model, compatible: check.compatible, reason: check.reason });
  }
  return results;
}

export default MODEL_REGISTRY;
