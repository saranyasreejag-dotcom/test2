# 🏛️ NexusLLM • Full-Stack AI Chatbox with Supabase

A full-stack AI Chat application architected with a **clear, enterprise-grade separation of concerns** between the **Frontend (Client)**, the **Backend (Server)**, and **Supabase (Database)**.

---

## 🧭 Architectural Differentiation: Frontend vs Backend vs Supabase

In modern AI-powered applications, **the frontend should NEVER communicate directly with LLM provider APIs (Gemini, OpenAI) or hold administrative database secrets**. Doing so exposes secret API keys to anyone inspecting the browser's developer tools or network traffic.

This project implements a secure, modular 4-tier architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                     1. FRONTEND LAYER                       │
│  Location: /frontend                                        │
│  Config: frontend/.env (Public client variables ONLY)       │
│  Role: UI, Markdown, Audio/Typing indicators, Supabase Anon │
└──────────────────────────────┬──────────────────────────────┘
                               │
                      HTTP REST: POST /api/chat
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                     2. BACKEND LAYER                        │
│  Location: /backend (Node.js, Express, Port 3001)           │
│  Config: backend/.env (Secret keys, service_role, LLM keys) │
│  Role: API Gateway, Secret Storage, LLM & DB Orchestrator   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
        Authorized HTTPS             Authorized DB Pool
       (Bearer / API Key)          (Service Role / Direct)
                 │                           │
┌────────────────▼─────────────┐   ┌─────────▼────────────────┐
│    3. EXTERNAL LLM CLOUD     │   │   4. SUPABASE DATABASE   │
│  • Google Gemini 1.5         │   │  • PostgreSQL DB Cloud   │
│  • OpenAI GPT-4o             │   │  • Row-Level Security    │
│  • Built-in Smart Simulator  │   │  • Chat History Threads  │
└──────────────────────────────┘   └──────────────────────────┘
```

---

## 🔐 Environment Variables (.env) Differentiation

### 🛡️ Backend Environment (`backend/.env`)
> **Private & Privileged**: Lives only on your server. Never transmitted to the client.

| Variable | Description | Example / Note |
| :--- | :--- | :--- |
| `PORT` | Local server port | `3001` |
| `GEMINI_API_KEY` | Google Gemini API Key | `AIzaSy...` (Private LLM credential) |
| `OPENAI_API_KEY` | OpenAI API Key | `sk-proj-...` (Private LLM credential) |
| `DEFAULT_PROVIDER` | Fallback model provider | `mock`, `gemini`, or `openai` |
| `SUPABASE_URL` | Supabase Project URL | `https://xyzcompany.supabase.co` |
| `SUPABASE_ANON_KEY` | Public Anon key for fallback | `eyJhbGciOi...` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Administrative Secret Key** | `eyJhbGciOi...` (Bypasses RLS, **BACKEND ONLY!**) |

### 💻 Frontend Environment (`frontend/.env`)
> **Public & Client-Safe**: Safe for client browsers. Governed by Supabase Row-Level Security (RLS).

| Variable | Description | Example / Note |
| :--- | :--- | :--- |
| `API_BASE_URL` | Backend server URL | `http://localhost:3001` |
| `SUPABASE_URL` | Public Supabase endpoint | `https://xyzcompany.supabase.co` |
| `SUPABASE_ANON_KEY` | Public Anonymous key | `eyJhbGciOi...` (Protected by RLS) |

---

## ⚡ Quick Start

### 1. Launch with One Click (Windows)
Double-click `start.bat` in File Explorer or run in PowerShell:
```powershell
.\start.bat
```
This automatically boots the Node.js backend and opens `http://localhost:3001` in your browser.

### 2. Manual Terminal Start
```powershell
# Ensure Node is in PATH
$env:Path = "C:\Program Files\nodejs;$env:Path"

# Start the application
npm start
```
Then visit: **`http://localhost:3001`**

---

## 🗄️ Setting Up Supabase Database

1. Sign in to your [Supabase Dashboard](https://supabase.com/dashboard) and create a new project.
2. Go to the **SQL Editor** tab on the left menu.
3. Open [`supabase_schema.sql`](file:///c:/Users/Dell-admin/Desktop/New%20folder/supabase_schema.sql) in this repository, copy the SQL, paste it into the Supabase SQL editor, and click **Run**.
4. Retrieve your API credentials from **Project Settings ➔ API**:
   - `Project URL`
   - `anon public` key
   - `service_role secret` key
5. Add the keys to [`backend/.env`](file:///c:/Users/Dell-admin/Desktop/New%20folder/backend/.env) and [`frontend/.env`](file:///c:/Users/Dell-admin/Desktop/New%20folder/frontend/.env):
   ```env
   # backend/.env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJI...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJI...
   ```
6. The chatbox will automatically detect Supabase and persist all conversations and messages!

---

## 📡 API Reference

- `POST /api/chat` — Dispatches message to LLM (Gemini, OpenAI, or Mock) and auto-saves to Supabase.
- `GET /api/config` — Returns client-safe public configuration (`supabaseUrl`, `supabaseAnonKey`, `defaultProvider`).
- `GET /api/health` — Checks status of server, LLM API keys, and Supabase database.
- `GET /api/supabase/status` — Tests connection to Supabase database.
- `GET /api/supabase/messages` — Retrieves saved messages from Supabase.
- `GET /api/models` — Returns supported AI models.

---

## 🔍 Live Architecture Inspector

Click the **🔍 Network Inspector** icon in the header while using the app to view:
- The exact raw JSON request sent from **Frontend ➔ Backend**.
- The exact raw JSON response returned from **Backend ➔ Frontend**.
- Breakdown of network latency vs LLM model inference time.
- Supabase persistence status tag.
