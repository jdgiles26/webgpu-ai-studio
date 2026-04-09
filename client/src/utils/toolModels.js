export const TOOL_MODEL_MAP = {
  'moe-router': 'moe-router',
  'multimodal-chat': 'multimodal-chat',
  'rag-chat': 'moe-router',
  'code-assistant': 'code-assistant',
  'creative-writer': 'creative-writer',
  'translator': 'translator',
  'style-transfer': 'style-transfer',
  'super-resolution': 'super-resolution',
  'image-inpainting': 'image-inpainting',
  'text-to-image': 'text-to-image',
  'object-detection': 'object-detection',
  'background-removal': 'background-removal',
  'face-analyzer': 'face-analyzer',
  'speech-to-text': 'speech-to-text',
  'text-to-speech': 'text-to-speech',
  'music-gen': 'music-gen',
  'sentiment-analyzer': 'sentiment-analyzer',
  'summarizer': 'summarizer',
};

export const VISION_TOOL_IDS = new Set([
  'style-transfer',
  'super-resolution',
  'image-inpainting',
  'text-to-image',
  'object-detection',
  'background-removal',
  'face-analyzer',
  'multimodal-chat',
]);

export const AUDIO_TOOL_IDS = new Set([
  'speech-to-text',
  'text-to-speech',
  'music-gen',
]);

export function getModelIdForTool(toolId) {
  return TOOL_MODEL_MAP[toolId] || 'moe-router';
}

export function isVisionToolId(toolId) {
  return VISION_TOOL_IDS.has(toolId);
}

export function isAudioToolId(toolId) {
  return AUDIO_TOOL_IDS.has(toolId);
}
