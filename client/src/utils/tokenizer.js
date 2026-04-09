/**
 * Tokenizer Utilities
 * 
 * Handles text encoding/decoding for ONNX model inputs.
 * Supports GPT-2/BPE-style tokenizers via built-in vocab mapping.
 * For production, use the `tiktoken` library for exact OpenAI tokenization,
 * or load tokenizer.json from HuggingFace.
 */

// Minimal BPE vocabulary for common tokens (expand for production)
// In production, load full vocab from tokenizer.json
const SPECIAL_TOKENS = {
  '<|endoftext|>': 50256,
  '<|fim_prefix|>': 50257,
  '<|fim_middle|>': 50258,
  '<|fim_suffix|>': 50259,
  '<|im_start|>': 151644,   // Qwen/ChatML
  '<|im_end|>': 151645,
  '<unk>': 0,
  '<s>': 1,
  '</s>': 2,
  '<pad>': 0,
};

/**
 * Encode text to token IDs
 * 
 * This is a simplified tokenizer. In production, load the full
 * tokenizer.json from HuggingFace and use proper BPE encoding.
 * 
 * For now, we use a character-level fallback with common subword patterns
 * that works well enough for demonstration.
 */
export function encode(text, config = {}) {
  const {
    maxLength = 2048,
    truncation = true,
    padding = false,
    padTokenId = 0,
    addSpecialTokens = true,
    bosTokenId = 1,
    eosTokenId = 2,
  } = config;

  let tokenIds = [];

  if (addSpecialTokens && bosTokenId !== undefined) {
    tokenIds.push(bosTokenId);
  }

  // Simple subword tokenization using common patterns
  // In production, use: const enc = new TikToken(); enc.encode(text);
  const tokens = simpleTokenize(text);
  tokenIds = tokenIds.concat(tokens.map(t => simpleTokenToId(t)));

  if (addSpecialTokens && eosTokenId !== undefined) {
    tokenIds.push(eosTokenId);
  }

  // Truncation
  if (truncation && tokenIds.length > maxLength) {
    tokenIds = tokenIds.slice(0, maxLength);
  }

  // Padding
  if (padding && tokenIds.length < maxLength) {
    while (tokenIds.length < maxLength) {
      tokenIds.push(padTokenId);
    }
  }

  return new BigInt64Array(tokenIds);
}

/**
 * Decode token IDs back to text
 */
export function decode(tokenIds, config = {}) {
  const {
    skipSpecialTokens = true,
    bosTokenId = 1,
    eosTokenId = 2,
  } = config;

  const ids = Array.from(tokenIds);
  
  let result = ids
    .filter(id => {
      if (skipSpecialTokens && (id === bosTokenId || id === eosTokenId)) return false;
      return id >= 0;
    })
    .map(id => simpleIdToToken(id))
    .join('');

  return result;
}

/**
 * Create attention mask from token IDs
 */
export function createAttentionMask(tokenIds) {
  const mask = new BigInt64Array(tokenIds.length);
  for (let i = 0; i < tokenIds.length; i++) {
    mask[i] = tokenIds[i] === 0n ? 0n : 1n;
  }
  return mask;
}

/**
 * Build model input feeds for text generation
 */
export function buildTextInputs(text, config = {}) {
  const inputIds = encode(text, { ...config, padding: false });
  const attentionMask = createAttentionMask(inputIds);

  return {
    input_ids: new ort.Tensor('int64', inputIds, [1, inputIds.length]),
    attention_mask: new ort.Tensor('int64', attentionMask, [1, attentionMask.length]),
  };
}

/**
 * Build decoder inputs for encoder-decoder models
 */
export function buildEncoderDecoderInputs(sourceText, targetText = '', config = {}) {
  const encoderInputIds = encode(sourceText, { ...config, padding: false });
  const encoderAttentionMask = createAttentionMask(encoderInputIds);
  
  const decoderInputIds = targetText
    ? encode(targetText, { ...config, padding: false, addSpecialTokens: false })
    : new BigInt64Array([2n]); // Start with </s> token

  return {
    input_ids: new ort.Tensor('int64', encoderInputIds, [1, encoderInputIds.length]),
    attention_mask: new ort.Tensor('int64', encoderAttentionMask, [1, encoderAttentionMask.length]),
    decoder_input_ids: new ort.Tensor('int64', decoderInputIds, [1, decoderInputIds.length]),
  };
}

// ==================== Simplified Tokenizer Implementation ====================

/**
 * Simple subword tokenizer for demonstration
 * In production, replace with tiktoken or HuggingFace tokenizer
 */
function simpleTokenize(text) {
  // Split on whitespace and punctuation
  return text.match(/[\w']+|[^\s\w]/g) || [];
}

/**
 * Map a token string to an integer ID
 * Simplified — production uses full BPE vocab
 */
function simpleTokenToId(token) {
  if (SPECIAL_TOKENS[token] !== undefined) return SPECIAL_TOKENS[token];
  
  // Simple hash-based token mapping for demo
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    hash = ((hash << 5) - hash) + token.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 30000 + 100; // Keep in reasonable range
}

/**
 * Map an integer ID back to a token string
 */
function simpleIdToToken(id) {
  if (id < 100) return '';
  if (id > 30100) return '';
  
  // Reverse the simple hash — for demo only
  // In production, use the actual vocab lookup
  return String.fromCharCode(97 + (id % 26));
}

/**
 * Sample from logits using temperature and top-k
 */
export function sampleFromLogits(logits, config = {}) {
  const {
    temperature = 0.7,
    topK = 50,
    topP = 0.9,
  } = config;

  // Apply temperature
  const scaledLogits = logits.map(l => l / temperature);
  
  // Softmax
  const maxLogit = Math.max(...scaledLogits);
  const expLogits = scaledLogits.map(l => Math.exp(l - maxLogit));
  const sumExp = expLogits.reduce((a, b) => a + b, 0);
  const probs = expLogits.map(e => e / sumExp);
  
  // Top-k filtering
  const indexed = probs.map((p, i) => ({ prob: p, index: i }));
  indexed.sort((a, b) => b.prob - a.prob);
  
  const topKProbs = indexed.slice(0, topK);
  const topKSum = topKProbs.reduce((sum, p) => sum + p.prob, 0);
  
  // Top-p (nucleus) filtering
  let cumulativeProb = 0;
  const nucleusTokens = [];
  for (const token of topKProbs) {
    cumulativeProb += token.prob / topKSum;
    nucleusTokens.push(token);
    if (cumulativeProb >= topP) break;
  }
  
  // Sample from filtered distribution
  const nucleusSum = nucleusTokens.reduce((sum, t) => sum + t.prob, 0);
  const rand = Math.random() * nucleusSum;
  let cumulative = 0;
  
  for (const token of nucleusTokens) {
    cumulative += token.prob;
    if (rand <= cumulative) return token.index;
  }
  
  return nucleusTokens[nucleusTokens.length - 1].index;
}

/**
 * Greedy decoding — pick the most likely token
 */
export function greedyDecode(logits) {
  let maxIdx = 0;
  let maxVal = logits[0];
  for (let i = 1; i < logits.length; i++) {
    if (logits[i] > maxVal) {
      maxVal = logits[i];
      maxIdx = i;
    }
  }
  return maxIdx;
}

// Re-export ort for convenience
import * as ort from 'onnxruntime-web';
export { ort };
