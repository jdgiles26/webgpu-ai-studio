import { useState, useCallback, useRef } from 'react';
import { useWebGPU } from '../../hooks/useWebGPU';

export default function RAGInterface() {
  const { streamInference, loading, error } = useWebGPU();
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const messagesEndRef = useRef(null);

  const processFiles = (files) => {
    const newFiles = Array.from(files).map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
      content: null,
      status: 'pending',
    }));
    setUploadedFiles(prev => [...prev, ...newFiles]);

    // Read file contents
    newFiles.forEach((fileInfo, index) => {
      const file = files[index];
      const reader = new FileReader();
      
      if (file.type === 'text/plain' || file.type.includes('markdown') || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
        reader.onload = (e) => {
          setUploadedFiles(prev => prev.map((f, i) => i === prev.length - newFiles.length + index ? { ...f, content: e.target.result, status: 'loaded' } : f));
        };
        reader.readAsText(file);
      } else if (file.type === 'application/json') {
        reader.onload = (e) => {
          try {
            const json = JSON.parse(e.target.result);
            setUploadedFiles(prev => prev.map((f, i) => i === prev.length - newFiles.length + index ? { ...f, content: JSON.stringify(json, null, 2), status: 'loaded' } : f));
          } catch {
            setUploadedFiles(prev => prev.map((f, i) => i === prev.length - newFiles.length + index ? { ...f, status: 'error' } : f));
          }
        };
        reader.readAsText(file);
      } else if (file.type === 'text/csv') {
        reader.onload = (e) => {
          setUploadedFiles(prev => prev.map((f, i) => i === prev.length - newFiles.length + index ? { ...f, content: e.target.result, status: 'loaded' } : f));
        };
        reader.readAsText(file);
      } else {
        setUploadedFiles(prev => prev.map((f, i) => i === prev.length - newFiles.length + index ? { ...f, status: 'unsupported' } : f));
      }
    });
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) {
      processFiles(e.dataTransfer.files);
    }
  }, []);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => setDragActive(false);

  const handleFileUpload = (e) => {
    if (e.target.files?.length) {
      processFiles(e.target.files);
    }
  };

  const handleFolderUpload = (e) => {
    // For folder upload, we handle via webkitdirectory
    if (e.target.files?.length) {
      processFiles(e.target.files);
    }
  };

  const removeFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input.trim(), timestamp: Date.now() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');

    const aiIndex = messages.length + 1;
    setMessages(prev => [...prev, { role: 'ai', content: '', streaming: true, timestamp: Date.now() }]);

    try {
      const loadedDocs = uploadedFiles.filter(f => f.status === 'loaded' && f.content);
      if (loadedDocs.length === 0) {
        throw new Error('Upload at least one text document to run retrieval.');
      }

      const chunks = chunkDocuments(loadedDocs);
      const topChunks = getTopRelevantChunks(userMessage.content, chunks, 4);
      const contextBlock = topChunks
        .map((chunk, i) => `Source ${i + 1} (${chunk.fileName}):\n${chunk.text}`)
        .join('\n\n');
      const sourceNames = Array.from(new Set(topChunks.map(chunk => chunk.fileName)));

      const ragPrompt = [
        'You are answering based only on the provided source context.',
        'If the answer is not in the sources, say that directly.',
        '',
        'Context:',
        contextBlock || 'No matching context found.',
        '',
        `Question: ${userMessage.content}`,
        'Answer:',
      ].join('\n');

      let accumulated = '';
      for await (const chunk of streamInference('moe-router', { prompt: ragPrompt }, {
        maxTokens: 220,
        temperature: 0.4,
        onProgress: (partialChunk) => {
          const partialText = partialChunk?.text || '';
          accumulated = partialText;
          setMessages(prev => prev.map((m, idx) => (
            idx === aiIndex ? { ...m, content: partialText, documents: sourceNames } : m
          )));
        },
      })) {
        if (chunk?.text) accumulated = chunk.text;
      }

      setMessages(prev => prev.map((m, idx) => (
        idx === aiIndex
          ? { ...m, content: accumulated, streaming: false, documents: sourceNames }
          : m
      )));
    } catch (err) {
      setMessages(prev => prev.map((m, idx) => idx === aiIndex ? { ...m, content: `Error: ${err.message}`, streaming: false, error: true } : m));
    }
  };

  const loadedCount = uploadedFiles.filter(f => f.status === 'loaded').length;
  const totalSize = uploadedFiles.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="flex flex-col h-[calc(100vh-1rem)]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-dark-800 bg-dark-900/50 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📚</span>
            <div>
              <h2 className="font-semibold">RAG Knowledge Chat</h2>
              <p className="text-xs text-dark-500">
                {uploadedFiles.length} files uploaded · {loadedCount} processed · {(totalSize / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          {loadedCount > 0 && (
            <span className="px-3 py-1 bg-green-500/10 text-green-400 text-xs rounded-full">
              {loadedCount} document{loadedCount > 1 ? 's' : ''} indexed
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Documents */}
        <div className="w-72 border-r border-dark-800 bg-dark-900/30 flex flex-col">
          {/* Upload area */}
          <div className="p-4 border-b border-dark-800">
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`border-2 border-dashed rounded-xl p-4 text-center transition-all ${
                dragActive
                  ? 'border-brand-500 bg-brand-500/10'
                  : 'border-dark-700 hover:border-dark-600'
              }`}
            >
              <span className="text-2xl mb-2 block">📁</span>
              <p className="text-xs text-dark-400 mb-2">Drag & drop files here</p>
              <div className="flex gap-2 justify-center">
                <label className="px-3 py-1.5 bg-dark-800 hover:bg-dark-700 rounded-lg text-xs cursor-pointer transition-colors">
                  Upload Files
                  <input type="file" multiple onChange={handleFileUpload} className="hidden" accept=".txt,.md,.json,.csv,.js,.ts,.py,.html,.css" />
                </label>
                <label className="px-3 py-1.5 bg-dark-800 hover:bg-dark-700 rounded-lg text-xs cursor-pointer transition-colors">
                  Upload Folder
                  <input type="file" webkitdirectory="" directory="" multiple onChange={handleFolderUpload} className="hidden" />
                </label>
              </div>
            </div>
            <p className="text-xs text-dark-600 mt-2 text-center">TXT, MD, JSON, CSV, code files</p>
          </div>

          {/* File list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {uploadedFiles.length === 0 && (
              <div className="text-center py-8 text-dark-600 text-sm">
                <p>No documents uploaded yet</p>
                <p className="text-xs mt-1">Upload files to build your knowledge base</p>
              </div>
            )}
            {uploadedFiles.map((file, i) => (
              <div key={i} className="flex items-center gap-2 bg-dark-900/60 rounded-lg px-3 py-2 group">
                <span className="text-sm">
                  {file.status === 'loaded' ? '📄' : file.status === 'error' ? '❌' : file.status === 'unsupported' ? '⚠️' : '⏳'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{file.name}</p>
                  <p className="text-xs text-dark-600">
                    {file.status === 'loaded' ? `${(file.size / 1024).toFixed(1)} KB` : file.status}
                  </p>
                </div>
                <button
                  onClick={() => removeFile(i)}
                  className="opacity-0 group-hover:opacity-100 text-dark-600 hover:text-red-400 transition-all text-xs"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-md">
                  <span className="text-6xl mb-4 block">📚</span>
                  <h3 className="text-xl font-semibold mb-2">Chat with your documents</h3>
                  <p className="text-dark-400 text-sm mb-6">
                    Upload documents, folders, or code files, then ask questions. The AI will use your documents as context for intelligent answers.
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-left">
                    {['Summarize all uploaded documents', 'What are the key themes?', 'Find code patterns', 'Compare documents'].map((q, i) => (
                      <button
                        key={i}
                        onClick={() => setInput(q)}
                        className="text-left px-3 py-2 bg-dark-900 border border-dark-800 rounded-lg text-sm text-dark-400 hover:text-dark-200 hover:border-brand-500/30 transition-all"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

        {messages.map((msg, i) => (
              <div key={i} className={`chat-message ${msg.role === 'user' ? 'chat-user' : 'chat-ai'} ${msg.error ? 'border-red-500/30' : ''}`}>
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {msg.content}
              {msg.streaming && <span className="inline-block w-2 h-4 bg-brand-400 ml-1 animate-pulse" />}
            </div>
                {msg.documents && (
                  <div className="mt-2 text-xs text-dark-500">
                    Sources: {msg.documents.join(', ')}
                  </div>
                )}
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
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question about your documents..."
                className="input-field flex-1"
                disabled={loading}
              />
              <button type="submit" className="btn-primary" disabled={loading || !input.trim()}>
                {loading ? '⏳' : '➤'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function chunkDocuments(files, chunkSize = 1200) {
  const chunks = [];
  for (const file of files) {
    const normalized = String(file.content || '').replace(/\s+/g, ' ').trim();
    if (!normalized) continue;
    for (let start = 0; start < normalized.length; start += chunkSize) {
      chunks.push({
        fileName: file.name,
        text: normalized.slice(start, start + chunkSize),
      });
    }
  }
  return chunks;
}

function tokenize(text) {
  return (text.toLowerCase().match(/[a-z0-9_]{2,}/g) || []);
}

function getTopRelevantChunks(query, chunks, topK = 4) {
  const queryTerms = tokenize(query);
  if (!queryTerms.length) return chunks.slice(0, topK);

  const uniqueTerms = new Set(queryTerms);
  const scored = chunks.map((chunk) => {
    const chunkTerms = tokenize(chunk.text);
    const chunkSet = new Set(chunkTerms);
    let overlap = 0;
    uniqueTerms.forEach((term) => {
      if (chunkSet.has(term)) overlap += 1;
    });
    const score = overlap / Math.max(1, uniqueTerms.size);
    return { ...chunk, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
