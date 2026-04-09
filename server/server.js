import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3100;

// ==================== MIDDLEWARE ====================
app.use(helmet({
  contentSecurityPolicy: false, // Relaxed for WebGPU
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.',
});
app.use('/api/', limiter);

// ==================== ROUTES ====================
app.use('/api/auth', authRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    tools: 18,
  });
});

// Serve uploaded files for RAG
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==================== WEBGPU AI TOOLS ENDPOINTS ====================
// Note: Actual inference runs client-side via WebGPU.
// Server provides model metadata, session management, and RAG document storage.

// Get available AI tools catalog
app.get('/api/tools', (req, res) => {
  res.json(AI_TOOLS_CATALOG);
});

// Get tool details
app.get('/api/tools/:toolId', (req, res) => {
  const tool = AI_TOOLS_CATALOG.find(t => t.id === req.params.toolId);
  if (!tool) return res.status(404).json({ error: 'Tool not found' });
  res.json(tool);
});

// ==================== 18 AI TOOLS CATALOG ====================
const AI_TOOLS_CATALOG = [
  {
    id: 'moe-router',
    name: 'MoE Router',
    description: 'Mixture of Experts — intelligently routes your query to the best specialized model for the task',
    category: 'language',
    icon: '🧠',
    model: 'Mixtral-8x7B (quantized)',
    gpuMemory: '~4GB',
  },
  {
    id: 'multimodal-chat',
    name: 'Multimodal Chat',
    description: 'Chat with AI using text + images in a single conversation',
    category: 'language',
    icon: '💬',
    model: 'LLaVA-1.5 7B (quantized)',
    gpuMemory: '~4GB',
  },
  {
    id: 'rag-chat',
    name: 'RAG Knowledge Chat',
    description: 'Upload documents/folders and chat with your knowledge base using retrieval-augmented generation',
    category: 'language',
    icon: '📚',
    model: 'TinyLlama 1.1B + embeddings',
    gpuMemory: '~2GB',
  },
  {
    id: 'code-assistant',
    name: 'Code Assistant',
    description: 'AI pair programmer — write, review, debug, and explain code across 50+ languages',
    category: 'language',
    icon: '💻',
    model: 'CodeLlama 7B (quantized)',
    gpuMemory: '~4GB',
  },
  {
    id: 'style-transfer',
    name: 'Neural Style Transfer',
    description: 'Transform photos into any artistic style — Van Gogh, Picasso, anime, and custom styles',
    category: 'vision',
    icon: '🎨',
    model: 'FastStyleTransfer (ONNX)',
    gpuMemory: '~1GB',
  },
  {
    id: 'super-resolution',
    name: 'Super Resolution',
    description: 'Upscale images 2x–4x with AI-powered detail reconstruction',
    category: 'vision',
    icon: '🔍',
    model: 'Real-ESRGAN (quantized)',
    gpuMemory: '~2GB',
  },
  {
    id: 'image-inpainting',
    name: 'Image Inpainting',
    description: 'Remove objects, fill gaps, and reconstruct missing image regions with AI',
    category: 'vision',
    icon: '🖌️',
    model: 'LaMa (quantized)',
    gpuMemory: '~1.5GB',
  },
  {
    id: 'text-to-image',
    name: 'Text to Image',
    description: 'Generate images from text descriptions using distilled diffusion models',
    category: 'vision',
    icon: '🖼️',
    model: 'SD-Turbo (4-step, quantized)',
    gpuMemory: '~3GB',
  },
  {
    id: 'speech-to-text',
    name: 'Speech to Text',
    description: 'Transcribe audio in 100+ languages with real-time streaming support',
    category: 'audio',
    icon: '🎙️',
    model: 'Whisper tiny/base (quantized)',
    gpuMemory: '~500MB',
  },
  {
    id: 'text-to-speech',
    name: 'Text to Speech',
    description: 'Natural voice synthesis with multiple voice styles and emotions',
    category: 'audio',
    icon: '🔊',
    model: 'VITS / Piper (quantized)',
    gpuMemory: '~200MB',
  },
  {
    id: 'music-gen',
    name: 'Music Generator',
    description: 'Create music from text prompts — melodies, beats, full compositions',
    category: 'audio',
    icon: '🎵',
    model: 'MusicGen-small (quantized)',
    gpuMemory: '~2GB',
  },
  {
    id: 'sentiment-analyzer',
    name: 'Sentiment Analyzer',
    description: 'Analyze emotions, sentiment, and intent in text — real-time with visual dashboards',
    category: 'analysis',
    icon: '📊',
    model: 'DistilBERT (quantized)',
    gpuMemory: '~200MB',
  },
  {
    id: 'summarizer',
    name: 'Document Summarizer',
    description: 'Condense long articles, papers, and documents into concise summaries',
    category: 'analysis',
    icon: '📝',
    model: 'BART-CNN/DistilBART',
    gpuMemory: '~500MB',
  },
  {
    id: 'translator',
    name: 'Universal Translator',
    description: 'Translate text between 100+ languages with context-aware neural translation',
    category: 'language',
    icon: '🌐',
    model: 'M2M-100 / NLLB-200 (quantized)',
    gpuMemory: '~1.5GB',
  },
  {
    id: 'object-detection',
    name: 'Object Detection',
    description: 'Detect and classify objects in images with bounding boxes and confidence scores',
    category: 'vision',
    icon: '🎯',
    model: 'YOLOv8n (ONNX)',
    gpuMemory: '~500MB',
  },
  {
    id: 'background-removal',
    name: 'Background Remover',
    description: 'Instantly remove backgrounds from photos — perfect for product shots and portraits',
    category: 'vision',
    icon: '✂️',
    model: 'U²-Net / MODNet',
    gpuMemory: '~500MB',
  },
  {
    id: 'face-analyzer',
    name: 'Face Analyzer',
    description: 'Detect faces, estimate age, emotion, and generate anonymized avatars',
    category: 'vision',
    icon: '😊',
    model: 'RetinaFace + EmotionNet',
    gpuMemory: '~800MB',
  },
  {
    id: 'creative-writer',
    name: 'Creative Writer',
    description: 'AI writing companion for stories, poetry, scripts, and creative content',
    category: 'language',
    icon: '✍️',
    model: 'Mistral 7B (quantized)',
    gpuMemory: '~4GB',
  },
];

// ==================== STATIC FILES (Production) ====================
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  });
}

// ==================== START ====================
app.listen(PORT, () => {
  console.log(`🦞 WebGPU AI Studio Server running on port ${PORT}`);
  console.log(`📦 ${AI_TOOLS_CATALOG.length} AI tools available`);
  console.log(`🌐 Frontend: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
});
