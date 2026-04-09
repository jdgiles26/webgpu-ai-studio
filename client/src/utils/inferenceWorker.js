/**
 * ONNX Runtime WebGPU Inference Worker
 * 
 * Runs ONNX models in a Web Worker to keep the UI thread responsive.
 * Uses WebGPU execution provider for GPU-accelerated inference.
 * 
 * Communication protocol:
 * - Worker receives: { type: 'init', modelUrl, sessionOptions }
 * - Worker receives: { type: 'run', feeds, runOptions }
 * - Worker sends:     { type: 'ready' }
 * - Worker sends:     { type: 'result', data, metadata }
 * - Worker sends:     { type: 'error', message }
 * - Worker sends:     { type: 'progress', token, text } (streaming)
 */

import * as ort from 'onnxruntime-web';

// Configure ONNX Runtime to use WebGPU
ort.env.wasm.wasmPaths = '/node_modules/onnxruntime-web/dist/';

let inferenceSession = null;
let isStreaming = false;

// ==================== MESSAGE HANDLER ====================

self.onmessage = async (event) => {
  const message = event.data;
  
  try {
    switch (message.type) {
      case 'init':
        await initializeSession(message);
        break;
        
      case 'run':
        await runInference(message);
        break;
        
      case 'stream':
        await runStreamingInference(message);
        break;
        
      case 'stop':
        isStreaming = false;
        break;
        
      case 'dispose':
        await disposeSession();
        break;
        
      default:
        postMessage({ type: 'error', message: `Unknown message type: ${message.type}` });
    }
  } catch (error) {
    postMessage({
      type: 'error',
      message: error.message,
      stack: error.stack,
    });
  }
};

// ==================== SESSION MANAGEMENT ====================

async function initializeSession({ modelUrl, sessionOptions = {} }) {
  if (inferenceSession) {
    await inferenceSession.release();
    inferenceSession = null;
  }

  postMessage({ type: 'status', status: 'loading', message: 'Loading model...' });

  // Create session with WebGPU execution provider
  inferenceSession = await ort.InferenceSession.create(modelUrl, {
    executionProviders: ['webgpu'],
    preferredOutputLocation: { '': 'gpu-buffer' },
    enableMemPattern: true,
    enableCpuMemArena: true,
    ...sessionOptions,
  });

  postMessage({
    type: 'status',
    status: 'ready',
    message: 'Model loaded successfully',
    inputNames: inferenceSession.inputNames,
    outputNames: inferenceSession.outputNames,
  });
}

async function disposeSession() {
  if (inferenceSession) {
    await inferenceSession.release();
    inferenceSession = null;
  }
  isStreaming = false;
  postMessage({ type: 'status', status: 'disposed' });
}

// ==================== SINGLE INFERENCE ====================

async function runInference({ feeds, runOptions = {} }) {
  if (!inferenceSession) {
    throw new Error('No model loaded. Call init first.');
  }

  const startTime = performance.now();

  // Run inference
  const results = await inferenceSession.run(feeds, runOptions);

  const duration = performance.now() - startTime;

  // Process outputs
  const outputData = {};
  for (const [name, tensor] of Object.entries(results)) {
    outputData[name] = {
      data: Array.from(tensor.data),
      dims: tensor.dims,
      type: tensor.type,
    };
  }

  postMessage({
    type: 'result',
    data: outputData,
    metadata: {
      duration,
      outputNames: Object.keys(outputData),
    },
  });
}

// ==================== STREAMING INFERENCE ====================

async function runStreamingInference({ feeds, maxTokens = 256, temperature = 0.7, topK = 50 }) {
  if (!inferenceSession) {
    throw new Error('No model loaded. Call init first.');
  }

  isStreaming = true;

  // For autoregressive generation, we need to run inference token by token
  // This is a simplified implementation — production would use KV caching

  const inputIds = feeds.input_ids?.dims || [];
  const seqLen = inputIds[inputIds.length - 1];
  let currentInputIds = Array.from(feeds.input_ids.data);
  let attentionMask = feeds.attention_mask
    ? Array.from(feeds.attention_mask.data)
    : new Array(seqLen).fill(1n);

  const generatedTokens = [];
  const startTime = performance.now();

  for (let step = 0; step < maxTokens && isStreaming; step++) {
    // Create tensors for current step
    const currentFeeds = {
      input_ids: new ort.Tensor(
        'int64',
        new BigInt64Array(currentInputIds),
        [1, currentInputIds.length]
      ),
      attention_mask: new ort.Tensor(
        'int64',
        new BigInt64Array(attentionMask),
        [1, attentionMask.length]
      ),
    };

    // Run single step
    const results = await inferenceSession.run(currentFeeds);
    const logits = results.logits || results[Object.keys(results)[0]];
    
    // Get logits for last token
    const vocabSize = logits.dims[logits.dims.length - 1];
    const lastTokenOffset = (logits.dims[0] * logits.dims[1] - 1) * vocabSize;
    const lastLogits = [];
    for (let i = 0; i < vocabSize; i++) {
      lastLogits.push(logits.data[lastTokenOffset + i]);
    }

    // Sample next token
    const nextToken = sampleToken(lastLogits, { temperature, topK });
    
    // Check for EOS
    if (nextToken === 2 || nextToken === 50256) {
      break;
    }

    generatedTokens.push(nextToken);
    
    // Append to input for next step
    currentInputIds.push(nextToken);
    attentionMask.push(1n);

    // Send partial result (every 4 tokens to avoid flooding)
    if (step % 4 === 0 || step === maxTokens - 1) {
      const duration = performance.now() - startTime;
      postMessage({
        type: 'stream',
        tokens: [...generatedTokens],
        tokenCount: generatedTokens.length,
        tokensPerSecond: generatedTokens.length / (duration / 1000),
        step,
        maxTokens,
      });
    }
  }

  const duration = performance.now() - startTime;

  postMessage({
    type: 'stream-complete',
    tokens: generatedTokens,
    tokenCount: generatedTokens.length,
    duration,
    tokensPerSecond: generatedTokens.length / (duration / 1000),
  });
}

// ==================== SAMPLING ====================

function sampleToken(logits, { temperature = 0.7, topK = 50 }) {
  // Apply temperature
  const scaled = logits.map(l => l / temperature);
  
  // Find top-k
  const indexed = scaled.map((l, i) => ({ logit: l, index: i }));
  indexed.sort((a, b) => b.logit - a.logit);
  const topKLogits = indexed.slice(0, topK);
  
  // Softmax
  const maxLogit = topKLogits[0].logit;
  const exps = topKLogits.map(t => Math.exp(t.logit - maxLogit));
  const sumExp = exps.reduce((a, b) => a + b, 0);
  
  // Sample
  const rand = Math.random() * sumExp;
  let cumulative = 0;
  for (let i = 0; i < exps.length; i++) {
    cumulative += exps[i];
    if (rand <= cumulative) return topKLogits[i].index;
  }
  
  return topKLogits[topKLogits.length - 1].index;
}
