import { useState, useCallback, useRef, useEffect } from 'react';
import * as ort from 'onnxruntime-web';
import { MODEL_REGISTRY, checkModelRequirements } from '../utils/modelRegistry';
import {
  cacheModelFile,
  getCachedModelFile,
  isModelCached,
  downloadModel,
  downloadModelFile,
  getModelBlobUrls,
} from '../utils/modelCache';
import {
  encode,
  decode,
  createAttentionMask,
  buildTextInputs,
  buildEncoderDecoderInputs,
  sampleFromLogits,
  greedyDecode,
} from '../utils/tokenizer';

/**
 * useWebGPU — Real ONNX Runtime WebGPU Inference Hook
 * 
 * Production-grade hook that:
 * 1. Detects WebGPU capability and GPU specs
 * 2. Downloads and caches ONNX models via IndexedDB
 * 3. Runs inference using WebGPU execution provider
 * 4. Supports autoregressive text generation with streaming
 * 5. Handles vision/audio preprocessing
 * 
 * Usage:
 *   const { loadModel, inference, streamInference, loading, error, gpuInfo } = useWebGPU();
 *   
 *   // Load a model
 *   await loadModel('sentiment-analyzer', { onProgress: (p) => console.log(p) });
 *   
 *   // Run inference
 *   const result = await inference({ prompt: 'I love this product!' });
 *   
 *   // Stream text generation
 *   for await (const chunk of streamInference({ prompt: 'Write a story...' })) {
 *     console.log(chunk.text);
 *   }
 */
export function useWebGPU() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [gpuInfo, setGpuInfo] = useState(null);
  const [loadedModels, setLoadedModels] = useState(new Map());
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [webgpuAvailable, setWebgpuAvailable] = useState(null);

  const sessionCache = useRef(new Map());
  const adapterRef = useRef(null);
  const deviceRef = useRef(null);
  const abortControllerRef = useRef(null);

  // ==================== WebGPU DETECTION ====================

  const detectWebGPU = useCallback(async () => {
    if (!navigator.gpu) {
      setWebgpuAvailable(false);
      throw new Error(
        'WebGPU is not supported. Use Chrome 113+ or Edge 113+ with hardware acceleration enabled.'
      );
    }

    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance',
    });

    if (!adapter) {
      setWebgpuAvailable(false);
      throw new Error(
        'No WebGPU adapter found. Check that your GPU drivers are installed and WebGPU is enabled in browser flags.'
      );
    }

    adapterRef.current = adapter;

    // Get adapter info (not all browsers expose full details)
    const info = {
      device: adapter.info?.device || 'Unknown GPU',
      architecture: adapter.info?.architecture || 'Unknown',
      vendor: adapter.info?.vendor || 'Unknown',
      backendType: adapter.info?.backendType || 'Unknown',
      maxBufferSize: adapter.limits?.maxBufferSize || 0,
      maxStorageBufferBindingSize: adapter.limits?.maxStorageBufferBindingSize || 0,
      maxComputeWorkgroupStorageSize: adapter.limits?.maxComputeWorkgroupStorageSize || 0,
    };

    setGpuInfo(info);
    setWebgpuAvailable(true);

    return { adapter, info };
  }, []);

  // ==================== MODEL MANAGEMENT ====================

  /**
   * Download and cache a model with progress tracking
   */
  const downloadModelWithProgress = useCallback(async (modelId, onProgress) => {
    const model = MODEL_REGISTRY[modelId];
    if (!model) throw new Error(`Model "${modelId}" not found in registry`);

    const { modelUrl, modelFiles } = model;

    setLoading(true);
    setError(null);

    try {
      await downloadModel(modelId, modelFiles, modelUrl, (progress) => {
        setDownloadProgress({
          modelId,
          fileName: progress.fileName,
          received: progress.received,
          total: progress.total,
          progress: progress.overallProgress || progress.progress,
          totalFiles: progress.totalFiles,
          currentFile: progress.fileIndex + 1,
          receivedMB: (progress.received / 1024 / 1024).toFixed(1),
          totalMB: (progress.total / 1024 / 1024).toFixed(1),
        });
        if (onProgress) onProgress(progress);
      });

      setDownloadProgress(null);
    } catch (err) {
      setError(`Download failed: ${err.message}`);
      setDownloadProgress(null);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Load an ONNX model into an inference session
   */
  const loadModel = useCallback(async (modelId, options = {}) => {
    const { onProgress, forceDownload = false, sessionOptions = {} } = options;

    const model = MODEL_REGISTRY[modelId];
    if (!model) throw new Error(`Model "${modelId}" not found in registry`);

    // Check GPU compatibility
    if (gpuInfo) {
      const check = checkModelRequirements(modelId, gpuInfo);
      if (!check.compatible) {
        throw new Error(`Model not compatible: ${check.reason}`);
      }
    }

    // Ensure WebGPU is available
    if (!adapterRef.current) {
      await detectWebGPU();
    }

    // Request GPU device
    if (!deviceRef.current) {
      deviceRef.current = await adapterRef.current.requestDevice({
        requiredLimits: {
          maxStorageBufferBindingSize: adapterRef.current.limits.maxStorageBufferBindingSize,
        },
      });
    }

    // Download model if not cached
    const cached = await isModelCached(modelId, model.modelFiles);
    if (!cached || forceDownload) {
      await downloadModelWithProgress(modelId, onProgress);
    }

    // Get Blob URLs for the cached model files
    const blobUrls = await getModelBlobUrls(modelId, model.modelFiles);
    const mainModelUrl = blobUrls[model.modelFiles[0]];

    setLoading(true);
    setError(null);

    try {
      // Create ONNX Runtime session with WebGPU
      const session = await ort.InferenceSession.create(mainModelUrl, {
        executionProviders: ['webgpu'],
        preferredOutputLocation: { '': 'gpu-buffer' },
        enableMemPattern: true,
        enableCpuMemArena: true,
        ...sessionOptions,
      });

      // Store session info
      const sessionInfo = {
        modelId,
        session,
        model,
        blobUrls,
        loadedAt: Date.now(),
        inputNames: session.inputNames,
        outputNames: session.outputNames,
      };

      sessionCache.current.set(modelId, sessionInfo);
      setLoadedModels(new Map(sessionCache.current));

      return sessionInfo;
    } catch (err) {
      setError(`Failed to load model: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [gpuInfo, detectWebGPU, downloadModelWithProgress]);

  /**
   * Unload a model and free GPU memory
   */
  const unloadModel = useCallback(async (modelId) => {
    const sessionInfo = sessionCache.current.get(modelId);
    if (sessionInfo) {
      await sessionInfo.session.release();
      
      // Revoke blob URLs
      for (const url of Object.values(sessionInfo.blobUrls)) {
        URL.revokeObjectURL(url);
      }
      
      sessionCache.current.delete(modelId);
      setLoadedModels(new Map(sessionCache.current));
    }
  }, []);

  // ==================== TEXT INFERENCE ====================

  /**
   * Run single-step inference (classification, embedding, etc.)
   */
  const inference = useCallback(async (modelId, input) => {
    let sessionInfo = sessionCache.current.get(modelId);
    if (!sessionInfo) {
      await loadModel(modelId);
      sessionInfo = sessionCache.current.get(modelId);
    }
    if (!sessionInfo) {
      throw new Error(`Failed to initialize model "${modelId}".`);
    }

    const { session, model } = sessionInfo;
    setLoading(true);
    setError(null);

    try {
      const feeds = buildFeedsForModel(modelId, input, model, session.inputNames);
      const startTime = performance.now();

      const results = await session.run(feeds);

      const duration = performance.now() - startTime;

      // Process outputs based on model type
      const output = processOutputForModel(modelId, results, input, model);

      return {
        ...output,
        metadata: {
          duration,
          modelId,
          inputTokens: feeds.input_ids?.dims?.[1] || feeds.attention_mask?.dims?.[1] || 0,
        },
      };
    } catch (err) {
      setError(`Inference failed: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadModel]);

  /**
   * Autoregressive text generation with streaming
   */
  const streamInference = useCallback(async function* (modelId, input, options = {}) {
    const {
      maxTokens = 256,
      temperature = 0.7,
      topK = 50,
      topP = 0.9,
      stopSequences = [],
      onProgress = null,
    } = options;

    let sessionInfo = sessionCache.current.get(modelId);
    if (!sessionInfo) {
      await loadModel(modelId);
      sessionInfo = sessionCache.current.get(modelId);
    }
    if (!sessionInfo) {
      throw new Error(`Failed to initialize model "${modelId}".`);
    }

    const { session, model } = sessionInfo;
    setLoading(true);
    setError(null);

    // Create abort controller for this generation
    abortControllerRef.current = new AbortController();

    try {
      // Encode input prompt
      const prompt = input.prompt || input;
      const inputIds = encode(prompt, { maxLength: model.contextLength || 2048, padding: false });
      const attentionMask = createAttentionMask(inputIds);

      let currentIds = Array.from(inputIds);
      let currentMask = Array.from(attentionMask);
      const generatedTokens = [];
      const startTime = performance.now();

      for (let step = 0; step < maxTokens; step++) {
        if (abortControllerRef.current.signal.aborted) {
          break;
        }

        // Create tensors
        const feeds = {
          input_ids: new ort.Tensor('int64', new BigInt64Array(currentIds), [1, currentIds.length]),
          attention_mask: new ort.Tensor('int64', new BigInt64Array(currentMask), [1, currentMask.length]),
        };

        // Run inference
        const results = await session.run(feeds);
        const logitsTensor = results.logits || results[Object.keys(results)[0]];
        if (!logitsTensor?.dims || logitsTensor.dims.length < 2) {
          break;
        }

        // Extract logits for the last position
        const dims = logitsTensor.dims;
        const vocabSize = dims[dims.length - 1];
        const lastPosOffset = (dims[0] * dims[1] - 1) * vocabSize;
        const logits = [];
        for (let i = 0; i < vocabSize; i++) {
          logits.push(logitsTensor.data[lastPosOffset + i]);
        }

        // Sample next token
        const nextToken = sampleFromLogits(logits, { temperature, topK, topP });
        
        // Check for EOS or stop sequences
        if (nextToken === 2 || nextToken === 50256 || nextToken === 151645) {
          break;
        }

        generatedTokens.push(nextToken);
        currentIds.push(nextToken);
        currentMask.push(1n);

        // Decode partial result
        const text = decode(new BigInt64Array(generatedTokens)).trim();

        // Check stop sequences
        if (stopSequences.some(seq => text.includes(seq))) {
          break;
        }

        // Yield chunk
        const elapsed = (performance.now() - startTime) / 1000;
        const chunk = {
          text,
          token: nextToken,
          tokens: [...generatedTokens],
          step: step + 1,
          maxTokens,
          tokensPerSecond: generatedTokens.length / elapsed,
          elapsed,
        };

        if (onProgress) onProgress(chunk);
        yield chunk;
      }

      // Final result
      const duration = performance.now() - startTime;
      const finalText = decode(new BigInt64Array(generatedTokens));

      yield {
        text: finalText,
        tokens: generatedTokens,
        tokenCount: generatedTokens.length,
        duration,
        tokensPerSecond: generatedTokens.length / (duration / 1000),
        done: true,
      };
    } catch (err) {
      setError(`Generation failed: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [loadModel]);

  /**
   * Stop ongoing generation
   */
  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  // ==================== VISION PIPELINES ====================

  /**
   * Preprocess an image for vision models
   */
  const preprocessImage = useCallback(async (imageSource, config = {}) => {
    const {
      targetSize = 224,
      mean = [0.485, 0.456, 0.406],
      std = [0.229, 0.224, 0.225],
    } = config;

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        
        // Center crop and resize
        const scale = Math.max(targetSize / img.width, targetSize / img.height);
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;
        const offsetX = (targetSize - scaledWidth) / 2;
        const offsetY = (targetSize - scaledHeight) / 2;
        
        ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
        
        const imageData = ctx.getImageData(0, 0, targetSize, targetSize);
        const pixels = new Float32Array(3 * targetSize * targetSize);
        
        // Convert RGB to CHW format and normalize
        for (let i = 0; i < targetSize * targetSize; i++) {
          const r = imageData.data[i * 4] / 255.0;
          const g = imageData.data[i * 4 + 1] / 255.0;
          const b = imageData.data[i * 4 + 2] / 255.0;
          
          pixels[i] = (r - mean[0]) / std[0];
          pixels[targetSize * targetSize + i] = (g - mean[1]) / std[1];
          pixels[2 * targetSize * targetSize + i] = (b - mean[2]) / std[2];
        }
        
        resolve(new ort.Tensor('float32', pixels, [1, 3, targetSize, targetSize]));
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      
      if (typeof imageSource === 'string') {
        img.src = imageSource;
      } else if (imageSource instanceof File || imageSource instanceof Blob) {
        img.src = URL.createObjectURL(imageSource);
      }
    });
  }, []);

  /**
   * Run vision model inference
   */
  const runVisionModel = useCallback(async (modelId, imageSource, input) => {
    let sessionInfo = sessionCache.current.get(modelId);
    if (!sessionInfo) {
      await loadModel(modelId);
      sessionInfo = sessionCache.current.get(modelId);
    }
    if (!sessionInfo) {
      throw new Error(`Failed to initialize model "${modelId}".`);
    }

    const { session, model } = sessionInfo;
    setLoading(true);
    setError(null);

    try {
      // Preprocess image
      const imageSize = model.imageSize || 224;
      const imageTensor = await preprocessImage(imageSource, { targetSize: imageSize });

      // Build feeds
      const feeds = {};
      for (const inputName of session.inputNames) {
        if (inputName === 'images' || inputName === 'input' || inputName === 'pixel_values') {
          feeds[inputName] = imageTensor;
        }
      }

      const startTime = performance.now();
      const results = await session.run(feeds);
      const duration = performance.now() - startTime;

      const output = processVisionOutput(modelId, results, model);

      return {
        ...output,
        metadata: { duration, modelId },
      };
    } catch (err) {
      setError(`Vision inference failed: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [preprocessImage, loadModel]);

  // ==================== AUDIO PIPELINES ====================

  /**
   * Preprocess audio for speech models
   */
  const preprocessAudio = useCallback(async (audioSource, config = {}) => {
    const {
      targetSampleRate = 16000,
      nMels = 80,
      nFft = 400,
      hopLength = 160,
    } = config;

    // Decode audio file
    const audioBuffer = await decodeAudioFile(audioSource, targetSampleRate);
    
    // Convert to mel spectrogram (simplified — production uses proper mel filterbank)
    const samples = audioBuffer.getChannelData(0);
    const melSpectrogram = computeMelSpectrogram(samples, targetSampleRate, { nMels, nFft, hopLength });
    
    return new ort.Tensor('float32', melSpectrogram, [1, nMels, Math.ceil(melSpectrogram.length / nMels)]);
  }, []);

  /**
   * Decode an audio file to AudioBuffer
   */
  async function decodeAudioFile(audioSource, targetSampleRate) {
    const audioContext = new AudioContext({ sampleRate: targetSampleRate });
    
    let arrayBuffer;
    if (audioSource instanceof File || audioSource instanceof Blob) {
      arrayBuffer = await audioSource.arrayBuffer();
    } else if (typeof audioSource === 'string') {
      const response = await fetch(audioSource);
      arrayBuffer = await response.arrayBuffer();
    } else {
      throw new Error('Unsupported audio source');
    }
    
    return await audioContext.decodeAudioData(arrayBuffer);
  }

  /**
   * Compute simplified mel spectrogram
   */
  function computeMelSpectrogram(samples, sampleRate, { nMels, nFft, hopLength }) {
    // Simplified implementation — production should use proper STFT + mel filterbank
    const melFeatures = new Float32Array(nMels * Math.ceil(samples.length / hopLength));
    
    // Window the signal and compute simple spectral features
    for (let i = 0; i < samples.length - nFft; i += hopLength) {
      const frameIndex = Math.floor(i / hopLength);
      
      // Simple energy-based features per mel band
      for (let band = 0; band < nMels; band++) {
        const centerFreq = 200 * Math.pow(10, band / 40); // Mel-scale frequencies
        const lowBin = Math.floor(centerFreq / (sampleRate / nFft) * 2);
        const highBin = Math.min(lowBin + 10, nFft / 2);
        
        let energy = 0;
        for (let j = lowBin; j < highBin && j < nFft / 2; j++) {
          const sample = samples[i + j] || 0;
          energy += sample * sample;
        }
        
        melFeatures[frameIndex * nMels + band] = Math.log1p(energy);
      }
    }
    
    return melFeatures;
  }

  // ==================== UTILITY ====================

  /**
   * Get status of all loaded models
   */
  const getLoadedModels = useCallback(() => {
    const models = [];
    for (const [id, info] of sessionCache.current) {
      models.push({
        modelId: id,
        inputNames: info.inputNames,
        outputNames: info.outputNames,
        loadedAt: info.loadedAt,
        modelName: info.model.name,
      });
    }
    return models;
  }, []);

  /**
   * Clear all sessions and free GPU memory
   */
  const disposeAll = useCallback(async () => {
    const modelIds = Array.from(sessionCache.current.keys());
    for (const id of modelIds) {
      await unloadModel(id);
    }
    sessionCache.current.clear();
    if (deviceRef.current) {
      deviceRef.current = null;
    }
    setLoadedModels(new Map());
  }, [unloadModel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      disposeAll();
    };
  }, [disposeAll]);

  return {
    // State
    loading,
    error,
    gpuInfo,
    webgpuAvailable,
    loadedModels,
    downloadProgress,
    
    // WebGPU
    detectWebGPU,
    
    // Model management
    loadModel,
    unloadModel,
    getLoadedModels,
    disposeAll,
    
    // Inference
    inference,
    streamInference,
    stopGeneration,
    
    // Vision
    runVisionModel,
    preprocessImage,
    
    // Audio
    preprocessAudio,
    
    // Utilities
    ort,
    encode,
    decode,
    buildTextInputs,
    buildEncoderDecoderInputs,
    MODEL_REGISTRY,
  };
}

// ==================== FEED BUILDERS ====================

function buildFeedsForModel(modelId, input, model, sessionInputNames = []) {
  const prompt = typeof input === 'string'
    ? input
    : (input?.prompt || input?.text || '');
  const maxLength = model.contextLength || 2048;
  const textInputs = buildTextInputs(prompt, { maxLength });
  const inputNames = Array.isArray(sessionInputNames) && sessionInputNames.length > 0
    ? sessionInputNames
    : ['input_ids', 'attention_mask'];

  // Fast path for common text models.
  if (
    inputNames.every((name) => name === 'input_ids' || name === 'attention_mask')
  ) {
    return textInputs;
  }

  const feeds = {};
  for (const name of inputNames) {
    if (name === 'input_ids') {
      feeds[name] = textInputs.input_ids;
      continue;
    }
    if (name === 'attention_mask') {
      feeds[name] = textInputs.attention_mask;
      continue;
    }
    if (name === 'token_type_ids') {
      feeds[name] = new ort.Tensor('int64', new BigInt64Array(textInputs.input_ids.data.length), [1, textInputs.input_ids.data.length]);
      continue;
    }
    if (name.includes('decoder_input_ids')) {
      feeds[name] = new ort.Tensor('int64', new BigInt64Array([1n]), [1, 1]);
      continue;
    }
    if (name.includes('input_features') && input?.audioTensor) {
      feeds[name] = input.audioTensor;
      continue;
    }
    if ((name === 'images' || name === 'pixel_values' || name === 'input') && input?.imageTensor) {
      feeds[name] = input.imageTensor;
      continue;
    }
  }

  if (Object.keys(feeds).length === 0) {
    return textInputs;
  }
  return feeds;
}

// ==================== OUTPUT PROCESSORS ====================

function argmaxTokenDecode(tensor) {
  const dims = tensor?.dims || [];
  if (!dims.length) return '';
  const vocabSize = dims[dims.length - 1];
  const tokenSteps = dims.length >= 2 ? dims[dims.length - 2] : 1;
  const data = tensor.data;
  const decoded = [];

  for (let step = 0; step < tokenSteps; step++) {
    const offset = step * vocabSize;
    let maxIdx = 0;
    let maxVal = data[offset] ?? Number.NEGATIVE_INFINITY;
    for (let j = 1; j < vocabSize; j++) {
      const value = data[offset + j];
      if (value > maxVal) {
        maxVal = value;
        maxIdx = j;
      }
    }
    if (maxIdx === 2 || maxIdx === 151645) break;
    decoded.push(BigInt(maxIdx));
  }

  const text = decode(new BigInt64Array(decoded)).trim();
  return text || 'No decodable text produced by model output.';
}

function safeSoftmax(scores) {
  if (!scores.length) return [];
  const max = Math.max(...scores);
  const exp = scores.map((v) => Math.exp(v - max));
  const sum = exp.reduce((a, b) => a + b, 0) || 1;
  return exp.map((v) => v / sum);
}

function processOutputForModel(modelId, results, input, model) {
  const outputName = Object.keys(results)[0];
  const tensor = results[outputName];
  const scores = tensor?.data ? Array.from(tensor.data) : [];

  switch (modelId) {
    case 'sentiment-analyzer': {
      const probs = safeSoftmax(scores.slice(0, 2));
      const negativeScore = probs[0] ?? 0;
      const positiveScore = probs[1] ?? 0;
      return {
        type: 'sentiment',
        label: positiveScore >= negativeScore ? 'positive' : 'negative',
        scores: {
          negative: negativeScore,
          positive: positiveScore,
        },
        confidence: Math.max(positiveScore, negativeScore),
      };
    }

    case 'summarizer':
    case 'translator':
    case 'speech-to-text': {
      return {
        type: 'text',
        data: argmaxTokenDecode(tensor),
      };
    }

    case 'text-to-speech':
    case 'music-gen': {
      const script = argmaxTokenDecode(tensor);
      return {
        type: 'audio',
        message: script,
      };
    }

    default: {
      if (tensor?.dims?.length >= 2 && tensor?.data) {
        return {
          type: 'text',
          data: argmaxTokenDecode(tensor),
        };
      }
      return {
        type: 'raw',
        outputName,
        dims: tensor?.dims || [],
        data: scores.slice(0, 200),
      };
    }
  }
}

function tensorToImageDataUrl(outputTensor) {
  const dims = outputTensor?.dims || [];
  if (dims.length < 4) return null;
  const channels = dims[1];
  const height = dims[2];
  const width = dims[3];
  if (!channels || !height || !width) return null;

  const data = outputTensor.data;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIdx = y * width + x;
      const imgIdx = pixelIdx * 4;
      const r = Math.max(0, Math.min(255, ((data[pixelIdx] + 1) / 2) * 255));
      const g = channels > 1
        ? Math.max(0, Math.min(255, ((data[height * width + pixelIdx] + 1) / 2) * 255))
        : r;
      const b = channels > 2
        ? Math.max(0, Math.min(255, ((data[2 * height * width + pixelIdx] + 1) / 2) * 255))
        : r;
      imageData.data[imgIdx] = r;
      imageData.data[imgIdx + 1] = g;
      imageData.data[imgIdx + 2] = b;
      imageData.data[imgIdx + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

function processVisionOutput(modelId, results, model) {
  const outputs = Object.entries(results);

  if (modelId === 'object-detection' || modelId === 'face-analyzer') {
    const detections = [];
    for (const [, tensor] of outputs) {
      const dims = tensor?.dims || [];
      if (dims.length === 2 && dims[1] >= 4) {
        const rowWidth = dims[1];
        const rows = Math.min(dims[0], 10);
        for (let i = 0; i < rows; i++) {
          const offset = i * rowWidth;
          const x1 = tensor.data[offset] || 0;
          const y1 = tensor.data[offset + 1] || 0;
          const x2 = tensor.data[offset + 2] || 0;
          const y2 = tensor.data[offset + 3] || 0;
          const confidence = Math.max(0, Math.min(1, tensor.data[offset + 4] || 0.5));
          detections.push({
            label: modelId === 'face-analyzer' ? 'face' : 'object',
            confidence,
            bbox: [x1, y1, Math.max(0, x2 - x1), Math.max(0, y2 - y1)],
          });
        }
      }
    }

    return {
      type: 'annotations',
      detections: detections.slice(0, 20),
    };
  }

  for (const [, tensor] of outputs) {
    const dataUrl = tensorToImageDataUrl(tensor);
    if (dataUrl) {
      return {
        type: 'image',
        data: dataUrl,
        width: tensor.dims[3],
        height: tensor.dims[2],
      };
    }
  }

  return {
    type: 'raw',
    outputName: outputs[0]?.[0] || 'unknown',
    dims: outputs[0]?.[1]?.dims || [],
  };
}
