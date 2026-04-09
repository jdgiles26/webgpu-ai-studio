import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useWebGPU } from '../../hooks/useWebGPU';
import { AI_TOOLS, TOOL_CATEGORIES } from '../../utils/tools';
import { MODEL_REGISTRY } from '../../utils/modelRegistry';
import { getModelIdForTool } from '../../utils/toolModels';

export default function Dashboard() {
  const { gpuInfo, webgpuAvailable, detectWebGPU, loadModel, loading, downloadProgress, error } = useWebGPU();
  const [activeCategory, setActiveCategory] = useState('all');
  const [webgpuChecked, setWebgpuChecked] = useState(false);
  const [loadedToolIds, setLoadedToolIds] = useState(new Set());
  const [downloadingToolId, setDownloadingToolId] = useState(null);

  const filteredTools = activeCategory === 'all'
    ? AI_TOOLS
    : AI_TOOLS.filter(t => t.category === activeCategory);

  const handleCheckWebGPU = async () => {
    try {
      await detectWebGPU();
    } catch (e) {
      console.error('WebGPU check failed:', e);
    }
    setWebgpuChecked(true);
  };

  const handlePreloadModel = useCallback(async (toolId) => {
    const modelId = getModelIdForTool(toolId);
    if (!modelId || !MODEL_REGISTRY[modelId]) return;

    setDownloadingToolId(toolId);
    try {
      await loadModel(modelId, {
        onProgress: (progress) => {
          // Progress is handled via state in the hook
        },
      });
      setLoadedToolIds(prev => new Set([...prev, toolId]));
    } catch (err) {
      console.error(`Failed to preload ${toolId}:`, err);
    } finally {
      setDownloadingToolId(null);
    }
  }, [loadModel]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold gradient-text mb-2">
              AI Studio
            </h1>
            <p className="text-dark-400 text-lg">
              18 free AI tools running entirely in your browser via WebGPU + ONNX Runtime
            </p>
          </div>
          
          <button
            onClick={handleCheckWebGPU}
            className="btn-secondary text-sm"
          >
            {webgpuChecked
              ? (webgpuAvailable ? '✅ WebGPU Ready' : '❌ Not Available')
              : '🔍 Check WebGPU'}
          </button>
        </div>

        {gpuInfo && (
          <div className="mt-4 glass-panel p-4 text-sm">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-dark-500">GPU</span>
                <p className="font-medium">{gpuInfo.device}</p>
              </div>
              <div>
                <span className="text-dark-500">Architecture</span>
                <p className="font-medium">{gpuInfo.architecture}</p>
              </div>
              <div>
                <span className="text-dark-500">Max Buffer</span>
                <p className="font-medium">{(gpuInfo.maxBufferSize / 1024 / 1024 / 1024).toFixed(1)} GB</p>
              </div>
              <div>
                <span className="text-dark-500">Status</span>
                <p className="font-medium text-green-400">
                  {loadedToolIds.size > 0 ? `🟢 ${loadedToolIds.size} model${loadedToolIds.size > 1 ? 's' : ''} loaded` : 'Ready'}
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            ⚠️ {error}
          </div>
        )}

        {downloadProgress && (
          <div className="mt-4 glass-panel p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                📥 Downloading model: {downloadProgress.fileName}
              </span>
              <span className="text-sm text-dark-400">
                {downloadProgress.receivedMB} / {downloadProgress.totalMB} MB
              </span>
            </div>
            <div className="w-full h-2 bg-dark-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-500 to-purple-500 transition-all duration-300 rounded-full"
                style={{ width: `${(downloadProgress.progress || 0) * 100}%` }}
              />
            </div>
            <p className="text-xs text-dark-500 mt-1">
              File {downloadProgress.currentFile} of {downloadProgress.totalFiles}
            </p>
          </div>
        )}
      </div>

      {/* Category filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TOOL_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeCategory === cat.id
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/20'
                : 'bg-dark-900 text-dark-400 hover:text-dark-200 hover:bg-dark-800 border border-dark-800'
            }`}
          >
            {cat.icon} {cat.name}
          </button>
        ))}
      </div>

      {/* Tools grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTools.map((tool) => (
          <ToolCard
            key={tool.id}
            tool={tool}
            isLoaded={loadedToolIds.has(tool.id)}
            isDownloading={downloadingToolId === tool.id}
            onPreload={() => handlePreloadModel(tool.id)}
            isLoading={loading}
          />
        ))}
      </div>
    </div>
  );
}

function ToolCard({ tool, isLoaded, isDownloading, onPreload, isLoading }) {
  const isChat = tool.chat;
  const isRAG = tool.isRAG;
  const modelId = getModelIdForTool(tool.id);
  const model = modelId ? MODEL_REGISTRY[modelId] : null;
  
  const linkTo = isRAG
    ? '/rag'
    : isChat
      ? `/chat/${tool.id}`
      : `/tool/${tool.id}`;

  return (
    <div className="tool-card group relative">
      <Link to={linkTo} className="relative z-10 block">
        <div className="flex items-start justify-between mb-4">
          <span className="text-4xl">{tool.icon}</span>
          <span className="text-xs px-2 py-1 bg-dark-800 rounded-full text-dark-400 capitalize">
            {tool.category}
          </span>
        </div>
        
        <h3 className="text-lg font-semibold text-dark-100 mb-2 group-hover:text-brand-400 transition-colors">
          {tool.name}
        </h3>
        
        <p className="text-sm text-dark-400 leading-relaxed">
          {tool.description}
        </p>

        <div className="mt-4 flex items-center gap-2 text-xs text-dark-500 flex-wrap">
          {isChat && <span className="px-2 py-0.5 bg-dark-800 rounded">Chat</span>}
          {tool.acceptsImages && <span className="px-2 py-0.5 bg-dark-800 rounded">Images</span>}
          {tool.producesImageOutput && <span className="px-2 py-0.5 bg-dark-800 rounded">Generates Images</span>}
          {tool.acceptsAudioInput && <span className="px-2 py-0.5 bg-dark-800 rounded">Audio Input</span>}
          {tool.producesAudioOutput && <span className="px-2 py-0.5 bg-dark-800 rounded">Audio Output</span>}
          {model && (
            <span className="px-2 py-0.5 bg-dark-800 rounded">
              ~{(model.estimatedMemoryMB / 1024).toFixed(1)} GB VRAM
            </span>
          )}
        </div>
      </Link>

      {/* Preload button overlay */}
      <div className="absolute top-3 right-3 z-20">
        {isLoaded ? (
          <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/30">
            ✓ Loaded
          </span>
        ) : model ? (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPreload();
            }}
            disabled={isLoading || isDownloading}
            className="px-3 py-1.5 bg-brand-600/80 hover:bg-brand-500 text-white text-xs rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDownloading ? (
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                Loading...
              </span>
            ) : (
              '⚡ Load Model'
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}
