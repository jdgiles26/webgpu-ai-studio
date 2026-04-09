import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AI_TOOLS } from '../../utils/tools';
import { useWebGPU } from '../../hooks/useWebGPU';
import { getModelIdForTool } from '../../utils/toolModels';

export default function ChatInterface() {
  const { toolId } = useParams();
  const tool = AI_TOOLS.find(t => t.id === toolId);
  const modelId = getModelIdForTool(toolId);
  const { streamInference, loading, error, gpuInfo } = useWebGPU();
  
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [imageAttachment, setImageAttachment] = useState(null);
  const messagesEndRef = useRef(null);
  const abortRef = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = {
      role: 'user',
      content: input.trim(),
      image: imageAttachment,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setImageAttachment(null);

    // Add AI placeholder
    const aiIndex = messages.length + 1;
    setMessages(prev => [...prev, { role: 'ai', content: '', streaming: true, timestamp: Date.now() }]);

    try {
      let accumulated = '';
      const prompt = imageAttachment && tool.acceptsImages
        ? `[Image attached]\n${userMessage.content}`
        : userMessage.content;
      
      for await (const chunk of streamInference(
        modelId,
        { prompt, image: imageAttachment },
        {
          onProgress: (partialChunk) => {
            const partialText = partialChunk?.text || '';
            accumulated = partialText;
            setMessages(prev => prev.map((m, i) => (
              i === aiIndex ? { ...m, content: partialText } : m
            )));
          },
        },
      )) {
        if (chunk?.text) accumulated = chunk.text;
      }

      setMessages(prev => prev.map((m, i) => i === aiIndex ? { ...m, content: accumulated, streaming: false } : m));
    } catch (err) {
      setMessages(prev => prev.map((m, i) => i === aiIndex ? { ...m, content: `Error: ${err.message}`, streaming: false, error: true } : m));
    }
  }, [input, loading, toolId, streamInference, imageAttachment, messages.length]);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setImageAttachment(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

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

  return (
    <div className="flex flex-col h-[calc(100vh-1rem)]">
      {/* Chat header */}
      <div className="px-6 py-4 border-b border-dark-800 bg-dark-900/50 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{tool.icon}</span>
          <div>
            <h2 className="font-semibold">{tool.name}</h2>
            <p className="text-xs text-dark-500">{tool.description}</p>
          </div>
          {gpuInfo && (
            <div className="ml-auto text-xs text-dark-500">
              <span className="px-2 py-1 bg-dark-800 rounded">🟢 {gpuInfo.device}</span>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <span className="text-6xl mb-4 block">{tool.icon}</span>
              <h3 className="text-xl font-semibold mb-2">Start a conversation</h3>
              <p className="text-dark-400 text-sm">
                {tool.description}. This AI runs entirely in your browser via WebGPU — no data leaves your device.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-2 text-left">
                {getSuggestedPrompts(toolId).map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(prompt)}
                    className="text-left px-3 py-2 bg-dark-900 border border-dark-800 rounded-lg text-sm text-dark-400 hover:text-dark-200 hover:border-brand-500/30 transition-all"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`chat-message ${msg.role === 'user' ? 'chat-user' : 'chat-ai'} ${msg.error ? 'border-red-500/30' : ''}`}
          >
            {msg.image && (
              <img src={msg.image} alt="Attachment" className="max-w-xs rounded-lg mb-2" />
            )}
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {msg.content}
              {msg.streaming && <span className="inline-block w-2 h-4 bg-brand-400 ml-1 animate-pulse" />}
            </div>
          </div>
        ))}
        
        {error && (
          <div className="chat-message chat-ai border-red-500/30">
            <p className="text-sm text-red-400">⚠️ {error}</p>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-dark-800 bg-dark-900/50">
        <div className="flex gap-3 max-w-4xl mx-auto">
          {tool.acceptsImages && (
            <label className="btn-secondary px-3 flex items-center justify-center cursor-pointer">
              📷
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
          )}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={tool.chat ? 'Type your message...' : 'Enter your prompt...'}
            className="input-field flex-1"
            disabled={loading}
          />
          <button type="submit" className="btn-primary" disabled={loading || !input.trim()}>
            {loading ? '⏳' : '➤'}
          </button>
        </div>
        {imageAttachment && (
          <div className="mt-2 flex items-center gap-2 max-w-4xl mx-auto">
            <img src={imageAttachment} alt="Preview" className="w-16 h-16 rounded-lg object-cover border border-dark-700" />
            <button
              type="button"
              onClick={() => setImageAttachment(null)}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Remove
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

function getSuggestedPrompts(toolId) {
  const prompts = {
    'moe-router': ['Explain quantum computing', 'Write a haiku about AI', 'What causes aurora borealis?'],
    'multimodal-chat': ['Describe this image in detail', 'What mood does this convey?', 'Extract text from this image'],
    'code-assistant': ['Explain this code pattern', 'Optimize this function', 'Write a REST API endpoint'],
    'creative-writer': ['Write a sci-fi opening', 'Continue this story...', 'Write a poem about the ocean'],
    'translator': ['Translate to Spanish', 'Translate to Japanese', 'Translate to French'],
  };
  return prompts[toolId] || ['Hello!', 'Tell me more', 'How does this work?'];
}
