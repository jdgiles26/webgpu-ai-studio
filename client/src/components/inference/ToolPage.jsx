import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AI_TOOLS } from '../../utils/tools';
import { useWebGPU } from '../../hooks/useWebGPU';
import { getModelIdForTool, isAudioToolId, isVisionToolId } from '../../utils/toolModels';

export default function ToolPage() {
  const { toolId } = useParams();
  const tool = AI_TOOLS.find(t => t.id === toolId);
  const modelId = getModelIdForTool(toolId);
  const { inference, runVisionModel, loading, error, gpuInfo } = useWebGPU();
  
  const [input, setInput] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [result, setResult] = useState(null);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleAudioUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) setAudioFile(file);
  };

  const buildPromptImage = (prompt) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 512, 512);
    gradient.addColorStop(0, '#0f172a');
    gradient.addColorStop(1, '#1e293b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    const lines = (prompt || 'Generate an image').match(/.{1,36}/g) || ['Generate an image'];
    lines.slice(0, 8).forEach((line, i) => {
      ctx.fillText(line, 256, 120 + (i * 42));
    });
    return canvas.toDataURL('image/png');
  };

  const handleRun = useCallback(async () => {
    if (loading) return;
    setResult(null);

    try {
      let output;
      if (isVisionToolId(toolId)) {
        const imageSource = imageFile || (toolId === 'text-to-image' ? buildPromptImage(input) : null);
        if (!imageSource) throw new Error('This tool needs an image input.');
        output = await runVisionModel(modelId, imageSource, { prompt: input || '' });
      } else if (isAudioToolId(toolId)) {
        if (toolId === 'speech-to-text') {
          const prompt = input?.trim()
            || `Transcribe audio file "${audioFile?.name || 'uploaded-audio'}" with best effort.`;
          output = await inference(modelId, { prompt, audio: audioFile });
        } else if (toolId === 'music-gen') {
          output = await inference(modelId, { prompt: input || 'Generate instrumental music.' });
        } else {
          output = await inference(modelId, { prompt: input || 'Synthesize clear spoken audio.' });
        }
      } else {
        output = await inference(modelId, { prompt: input || '' });
      }
      setResult(output);
    } catch (err) {
      setResult({ error: err.message });
    }
  }, [toolId, modelId, input, imageFile, audioFile, inference, runVisionModel, loading]);

  if (!tool) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Tool Not Found</h2>
          <Link to="/" className="text-brand-400 hover:underline">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const isVisionTool = tool.acceptsImageInput || tool.producesImageOutput;
  const isAudioTool = tool.acceptsAudioInput || tool.producesAudioOutput;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link to="/" className="text-sm text-dark-500 hover:text-brand-400 transition-colors">
          ← Back to Dashboard
        </Link>
        <div className="flex items-center gap-4 mt-4">
          <span className="text-5xl">{tool.icon}</span>
          <div>
            <h1 className="text-3xl font-bold">{tool.name}</h1>
            <p className="text-dark-400 mt-1">{tool.description}</p>
            <div className="flex gap-2 mt-3">
              <span className="text-xs px-2 py-1 bg-dark-800 rounded-full text-dark-400 capitalize">{tool.category}</span>
              {gpuInfo && <span className="text-xs px-2 py-1 bg-green-500/10 text-green-400 rounded-full">🟢 {gpuInfo.device}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="glass-panel p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <span>📥</span> Input
          </h3>

          {/* Text input */}
          {(tool.acceptsTextInput || !tool.acceptsImageInput) && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-dark-300 mb-2">
                {toolId === 'text-to-image' ? 'Describe the image you want to generate' : 'Enter your input'}
              </label>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="input-field min-h-[120px] resize-y"
                placeholder={toolId === 'text-to-image' ? 'A futuristic city at sunset, cyberpunk style...' : toolId === 'text-to-speech' ? 'Type the text to synthesize...' : toolId === 'music-gen' ? 'Upbeat electronic music with a dreamy vibe...' : 'Enter your text here...'}
              />
            </div>
          )}

          {/* Image input */}
          {tool.acceptsImageInput && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-dark-300 mb-2">Upload Image</label>
              <div className="border-2 border-dashed border-dark-700 rounded-xl p-6 text-center hover:border-brand-500/30 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                />
                <label htmlFor="image-upload" className="cursor-pointer">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="max-h-48 mx-auto rounded-lg" />
                  ) : (
                    <>
                      <span className="text-3xl mb-2 block">📷</span>
                      <p className="text-sm text-dark-400">Click to upload or drag and drop</p>
                      <p className="text-xs text-dark-600 mt-1">PNG, JPG, WebP up to 10MB</p>
                    </>
                  )}
                </label>
              </div>
            </div>
          )}

          {/* Audio input */}
          {tool.acceptsAudioInput && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-dark-300 mb-2">Upload Audio</label>
              <div className="border-2 border-dashed border-dark-700 rounded-xl p-6 text-center hover:border-brand-500/30 transition-colors">
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioUpload}
                  className="hidden"
                  id="audio-upload"
                />
                <label htmlFor="audio-upload" className="cursor-pointer">
                  {audioFile ? (
                    <div>
                      <span className="text-2xl mb-2 block">🎵</span>
                      <p className="text-sm text-dark-300">{audioFile.name}</p>
                      <audio src={URL.createObjectURL(audioFile)} controls className="mt-2 max-w-full" />
                    </div>
                  ) : (
                    <>
                      <span className="text-3xl mb-2 block">🎙️</span>
                      <p className="text-sm text-dark-400">Click to upload audio file</p>
                      <p className="text-xs text-dark-600 mt-1">MP3, WAV, OGG up to 25MB</p>
                    </>
                  )}
                </label>
              </div>
            </div>
          )}

          {/* Run button */}
          <button
            onClick={handleRun}
            className="btn-primary w-full"
            disabled={loading || (!input.trim() && !imageFile && !audioFile)}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing with WebGPU...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                ⚡ Run Inference
              </span>
            )}
          </button>
        </div>

        {/* Output Panel */}
        <div className="glass-panel p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <span>📤</span> Output
          </h3>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              ⚠️ {error}
            </div>
          )}

          {!result && !loading && (
            <div className="flex items-center justify-center h-64 text-dark-600">
              <div className="text-center">
                <span className="text-4xl mb-3 block">{tool.icon}</span>
                <p className="text-sm">Results will appear here after inference</p>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-dark-400">Running WebGPU inference...</p>
              </div>
            </div>
          )}

          {result && !result.error && (
            <div className="space-y-4">
              {result.type === 'image' && (result.data || result.dataUrl) && (
                <div>
                  <img src={result.data || result.dataUrl} alt="Generated" className="w-full rounded-xl border border-dark-700" />
                  <p className="text-xs text-dark-500 mt-2 text-center">AI-generated output via WebGPU</p>
                </div>
              )}
              {result.type === 'text' && (
                <div className="prose prose-invert prose-sm max-w-none">
                  <div className="bg-dark-800/50 rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap">
                    {result.data || result.text}
                  </div>
                </div>
              )}
              {result.type === 'audio' && (
                <div className="text-center py-8">
                  <span className="text-4xl mb-3 block">🎵</span>
                  <p className="text-sm text-dark-300">{result.message}</p>
                  <p className="text-xs text-dark-600 mt-2">Audio playback available in production build</p>
                </div>
              )}
              {(result.type === 'annotations' || result.type === 'detections' || result.type === 'sentiment') && (
                <div>
                  {result.detections && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-dark-300">Detected Objects:</h4>
                      {result.detections.map((det, i) => (
                        <div key={i} className="flex items-center justify-between bg-dark-800/50 rounded-lg px-4 py-2">
                          <span className="text-sm font-medium capitalize">{det.label}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-dark-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-brand-500 rounded-full"
                                style={{ width: `${det.confidence * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-dark-500 w-10 text-right">{(det.confidence * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {result.faces && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-dark-300">Face Analysis:</h4>
                      {result.faces.map((face, i) => (
                        <div key={i} className="bg-dark-800/50 rounded-lg p-4 grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-dark-500 text-xs block">Age</span>
                            <span className="font-medium">~{face.age}</span>
                          </div>
                          <div>
                            <span className="text-dark-500 text-xs block">Emotion</span>
                            <span className="font-medium capitalize">{face.emotion}</span>
                          </div>
                          <div>
                            <span className="text-dark-500 text-xs block">Confidence</span>
                            <span className="font-medium">{(face.confidence * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {(result.type === 'sentiment' || result.sentiment) && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {(result.sentiment?.label || result.label) === 'positive' ? '😊' : (result.sentiment?.label || result.label) === 'negative' ? '😟' : '😐'}
                        </span>
                        <div>
                          <span className="text-sm font-medium capitalize">{result.sentiment?.label || result.label}</span>
                          <span className="text-xs text-dark-500 ml-2">{(((result.sentiment?.score || result.confidence || 0) * 100)).toFixed(0)}% confidence</span>
                        </div>
                      </div>
                      {(result.emotions || result.scores) && (
                        <div className="space-y-1">
                          {Object.entries(result.emotions || result.scores).sort((a, b) => b[1] - a[1]).map(([emotion, score]) => (
                            <div key={emotion} className="flex items-center gap-3 text-sm">
                              <span className="w-20 capitalize text-dark-400">{emotion}</span>
                              <div className="flex-1 h-2 bg-dark-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-brand-500 to-purple-500 rounded-full transition-all duration-500"
                                  style={{ width: `${score * 100}%` }}
                                />
                              </div>
                              <span className="text-xs text-dark-500 w-10 text-right">{(score * 100).toFixed(0)}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {result.type === 'raw' && (
                <div className="bg-dark-800/50 rounded-xl p-4 text-xs overflow-auto max-h-72 whitespace-pre-wrap">
                  {JSON.stringify(result, null, 2)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
