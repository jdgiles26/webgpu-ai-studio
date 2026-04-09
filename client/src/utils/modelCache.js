/**
 * Model Cache — Download, store, and serve ONNX models
 * 
 * Uses IndexedDB for persistent model storage across sessions.
 * Models are downloaded once and cached locally.
 * Supports progress tracking and resumable downloads.
 */

const DB_NAME = 'WebGPU_AI_Studio_Models';
const DB_VERSION = 1;
const STORE_NAME = 'models';

let dbPromise = null;

/**
 * Open the IndexedDB database
 */
function openDB() {
  if (dbPromise) return dbPromise;
  
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('modelId', 'modelId', { unique: false });
        store.createIndex('lastUsed', 'lastUsed', { unique: false });
      }
    };
  });
  
  return dbPromise;
}

/**
 * Save a model file to the cache
 */
export async function cacheModelFile(modelId, fileName, arrayBuffer, metadata = {}) {
  const db = await openDB();
  const id = `${modelId}/${fileName}`;
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    store.put({
      id,
      modelId,
      fileName,
      data: arrayBuffer,
      size: arrayBuffer.byteLength,
      lastUsed: Date.now(),
      ...metadata,
    });
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get a cached model file
 */
export async function getCachedModelFile(modelId, fileName) {
  const db = await openDB();
  const id = `${modelId}/${fileName}`;
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Check if all model files are cached
 */
export async function isModelCached(modelId, fileNames) {
  for (const fileName of fileNames) {
    const cached = await getCachedModelFile(modelId, fileName);
    if (!cached) return false;
  }
  return true;
}

/**
 * Download and cache a model file with progress reporting
 */
export async function downloadModelFile(url, modelId, fileName, onProgress) {
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to download ${fileName}: ${response.status} ${response.statusText}`);
  }
  
  const contentLength = parseInt(response.headers.get('content-length') || '0');
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  
  while (true) {
    const { done, value } = await reader.read();
    
    if (done) break;
    
    chunks.push(value);
    received += value.length;
    
    if (onProgress && contentLength > 0) {
      onProgress({
        fileName,
        received,
        total: contentLength,
        progress: received / contentLength,
      });
    }
  }
  
  // Combine chunks into ArrayBuffer
  const arrayBuffer = new ArrayBuffer(received);
  const view = new Uint8Array(arrayBuffer);
  let offset = 0;
  for (const chunk of chunks) {
    view.set(chunk, offset);
    offset += chunk.length;
  }
  
  // Cache it
  await cacheModelFile(modelId, fileName, arrayBuffer);
  
  return arrayBuffer;
}

/**
 * Download and cache an entire model
 */
export async function downloadModel(modelId, modelFiles, modelUrl, onProgress) {
  const results = {};
  
  for (let i = 0; i < modelFiles.length; i++) {
    const fileName = modelFiles[i];
    const url = `${modelUrl}${fileName}`;
    
    results[fileName] = await downloadModelFile(url, modelId, fileName, (progress) => {
      if (onProgress) {
        onProgress({
          ...progress,
          fileIndex: i,
          totalFiles: modelFiles.length,
          overallProgress: (i + progress.progress) / modelFiles.length,
        });
      }
    });
  }
  
  return results;
}

/**
 * Get a model as Blob URLs for ONNX Runtime
 */
export async function getModelBlobUrls(modelId, fileNames) {
  const urls = {};
  
  for (const fileName of fileNames) {
    const cached = await getCachedModelFile(modelId, fileName);
    if (!cached) throw new Error(`Model file not cached: ${fileName}`);
    
    const blob = new Blob([cached.data], { type: 'application/octet-stream' });
    urls[fileName] = URL.createObjectURL(blob);
  }
  
  return urls;
}

/**
 * Get total cached model size
 */
export async function getCacheSize() {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
      const totalSize = request.result.reduce((sum, model) => sum + model.size, 0);
      resolve({
        totalSize,
        totalSizeMB: (totalSize / 1024 / 1024).toFixed(1),
        fileCount: request.result.length,
      });
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear cached models
 */
export async function clearCache(modelId = null) {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    if (modelId) {
      const index = store.index('modelId');
      const request = index.openCursor(IDBKeyRange.only(modelId));
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } else {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    }
  });
}

/**
 * Get list of cached models
 */
export async function listCachedModels() {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
      // Group by modelId
      const models = {};
      for (const item of request.result) {
        if (!models[item.modelId]) {
          models[item.modelId] = { modelId: item.modelId, files: [], totalSize: 0 };
        }
        models[item.modelId].files.push(item.fileName);
        models[item.modelId].totalSize += item.size;
        models[item.modelId].lastUsed = Math.max(
          models[item.modelId].lastUsed || 0,
          item.lastUsed
        );
      }
      resolve(Object.values(models).map(m => ({
        ...m,
        totalSizeMB: (m.totalSize / 1024 / 1024).toFixed(1),
      })));
    };
    request.onerror = () => reject(request.error);
  });
}
