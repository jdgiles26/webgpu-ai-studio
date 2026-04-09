# 🦞 WebGPU AI Studio

> **18 free AI inference tools running entirely in your browser.** No API keys. No cloud. No data leaves your device.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![WebGPU](https://img.shields.io/badge/WebGPU-Enabled-6366f1)](https://www.w3.org/TR/webgpu/)
[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-22-339933)](https://nodejs.org/)

## ✨ Features

### 🔐 Authentication & Access Control
- **Email-based registration** with admin approval workflow
- **SMTP notifications** — owner gets notified of every new registration
- **JWT-based sessions** with secure password hashing (bcrypt)
- **Role-based access** — admin panel for user management

### 🧠 18 AI Tools (All Browser-Based via WebGPU)

#### Language
| Tool | Description |
|------|-------------|
| 🧠 **MoE Router** | Mixture of Experts — routes queries to the best specialized model |
| 💬 **Multimodal Chat** | Chat with text + images in a single conversation |
| 📚 **RAG Knowledge Chat** | Upload docs/folders, chat with your knowledge base |
| 💻 **Code Assistant** | AI pair programmer for 50+ languages |
| ✍️ **Creative Writer** | Stories, poetry, scripts, creative content |
| 🌐 **Universal Translator** | 100+ language translation with context awareness |

#### Vision
| Tool | Description |
|------|-------------|
| 🎨 **Neural Style Transfer** | Transform photos into artistic styles |
| 🔍 **Super Resolution** | 2x–4x AI-powered image upscaling |
| 🖌️ **Image Inpainting** | Remove objects, fill gaps, reconstruct regions |
| 🖼️ **Text to Image** | Generate images from text descriptions |
| 🎯 **Object Detection** | YOLOv8-based detection with bounding boxes |
| ✂️ **Background Remover** | Instant background removal for any photo |
| 😊 **Face Analyzer** | Face detection, age/emotion estimation |

#### Audio
| Tool | Description |
|------|-------------|
| 🎙️ **Speech to Text** | 100+ language transcription (Whisper) |
| 🔊 **Text to Speech** | Natural voice synthesis with multiple voices |
| 🎵 **Music Generator** | Create music from text prompts |

#### Analysis
| Tool | Description |
|------|-------------|
| 📊 **Sentiment Analyzer** | Emotion/sentiment analysis with visual dashboards |
| 📝 **Document Summarizer** | Condense long texts into concise summaries |

## 🚀 Quick Start

### Prerequisites
- **Node.js 22+**
- **Chrome 113+** or **Edge 113+** (for WebGPU)
- An SMTP account (Gmail, SendGrid, etc.) for approval emails

### Installation

```bash
# Clone the repo
git clone https://github.com/your-org/webgpu-ai-studio.git
cd webgpu-ai-studio

# Install dependencies
npm install

# Initialize the database (creates admin user)
npm run setup

# Copy environment config
cp server/.env.example server/.env
# Edit server/.env with your SMTP settings
```

### Development

```bash
# Start both server and client
npm run dev

# Server:  http://localhost:3100
# Client:  http://localhost:5173
```

### Production

```bash
npm run build
npm start
```

## 📁 Project Structure

```
webgpu-ai-studio/
├── client/                          # React frontend (Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/                # Login, Register
│   │   │   ├── chat/                # ChatInterface
│   │   │   ├── inference/           # ToolPage (vision/audio tools)
│   │   │   ├── rag/                 # RAGInterface (document chat)
│   │   │   └── layout/              # Layout, Dashboard, AdminPanel
│   │   ├── hooks/
│   │   │   ├── useAuth.js           # Authentication context
│   │   │   └── useWebGPU.js         # WebGPU inference hook
│   │   ├── utils/
│   │   │   └── tools.js             # AI tools catalog
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css                # Tailwind styles
│   ├── index.html
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── server/                          # Express backend
│   ├── config/
│   │   ├── db.js                    # SQLite database
│   │   └── mail.js                  # SMTP email service
│   ├── middleware/
│   │   └── auth.js                  # JWT + role middleware
│   ├── routes/
│   │   └── auth.js                  # Auth endpoints
│   ├── scripts/
│   │   └── init-db.js               # DB initialization
│   ├── server.js                    # Express app + tools catalog
│   └── .env.example
│
├── package.json                     # Monorepo root
└── README.md
```

## 🔧 Configuration

### Environment Variables (`server/.env`)

```env
PORT=3100
JWT_SECRET=change-this-to-a-random-string
OWNER_EMAIL=you@example.com

# SMTP for approval emails
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

FRONTEND_URL=http://localhost:5173
AUTO_APPROVE=false
```

### Admin Account
The default admin is created on first run:
- **Email:** `admin@webgpu-ai.studio`
- **Password:** `admin123`
- ⚠️ **Change this immediately in production**

## 🏗️ Architecture

### How It Works

```
┌──────────────────────────────────────────────────────────┐
│                      Browser (Client)                     │
│  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌────────────┐ │
│  │  React  │  │ WebGPU   │  │ ONNX    │  │   File     │ │
│  │   UI    │  │ Runtime  │  │ Models  │  │  System    │ │
│  └────┬────┘  └────┬─────┘  └────┬────┘  └─────┬──────┘ │
│       │            │             │               │        │
│       └────────────┴─────────────┴───────────────┘        │
│                          │                                │
│                  All inference                             │
│                  happens locally                           │
└──────────────────────────┬────────────────────────────────┘
                           │ HTTPS (auth only)
┌──────────────────────────┴────────────────────────────────┐
│                      Server (Express)                      │
│  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌────────────┐ │
│  │  Auth   │  │   JWT    │  │  SQLite │  │    SMTP    │ │
│  │  Routes │  │  Middleware│ │   DB   │  │  Emails    │ │
│  └─────────┘  └──────────┘  └─────────┘  └────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Local-first inference** — All AI models run via WebGPU in the browser. The server handles only auth and metadata.
2. **SQLite** — Zero-config database, perfect for single-instance deployments.
3. **Monorepo** — Shared tooling, single install, easy deployment.
4. **Tailwind CSS** — Utility-first styling with dark theme optimized for AI tools.

## 🔒 Security

- Passwords hashed with **bcrypt** (cost factor 12)
- **JWT** with configurable expiration (default: 7 days)
- **Rate limiting** on all API endpoints (100 req / 15 min)
- **Helmet.js** security headers
- **CORS** configured for frontend origin only
- **Admin approval workflow** — no self-service access
- All inference data **stays in the browser**

## 📋 Roadmap

### Phase 1 (Current) ✅
- [x] Authentication with email approval
- [x] 18 AI tools UI framework
- [x] WebGPU detection and model loading
- [x] RAG document upload and chat
- [x] Admin panel for user management
- [x] Dark theme responsive UI

### Phase 2 (Next)
- [ ] Real ONNX model integration (onnxruntime-web/webgpu)
- [ ] Model download from CDN with progress
- [ ] Web Worker offloading for inference
- [ ] Chat history persistence
- [ ] Export conversations
- [ ] PWA support (offline mode)

### Phase 3
- [ ] Custom model fine-tuning interface
- [ ] Multi-GPU support
- [ ] Plugin system for custom tools
- [ ] Community model sharing
- [ ] Performance benchmarking dashboard

## 🛠️ Adding Real Models

To integrate actual ONNX models:

1. Install ONNX Runtime Web:
```bash
npm install onnxruntime-web --save
```

2. Update `useWebGPU.js`:
```javascript
import * as ort from 'onnxruntime-web/webgpu';

const session = await ort.InferenceSession.create(modelUrl, {
  executionProviders: ['webgpu'],
});
const results = await session.run(feeds);
```

3. Host models on CDN or serve from `/models/` directory.

Recommended quantized models (fit in ~4GB VRAM):
- **LLM**: Mistral-7B-Instruct-v0.3 (q4f16)
- **Vision**: CLIP ViT-B/32, YOLOv8n
- **Audio**: Whisper tiny/base
- **Embeddings**: all-MiniLM-L6-v2

## 📄 License

MIT — Free and open source. Use it, modify it, share it.

## 🙏 Credits

Built with:
- **React 19** + **Vite 6**
- **Tailwind CSS** for styling
- **Express** + **SQLite** for backend
- **WebGPU** for GPU-accelerated inference
- **ONNX Runtime Web** (when models are integrated)

---

<p align="center">
  <strong>🦞 WebGPU AI Studio</strong><br>
  <em>18 AI tools. Zero cloud. All browser.</em>
</p>
