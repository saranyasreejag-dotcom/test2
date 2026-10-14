/**
 * LLM Service
 * 
 * BACKEND RESPONSIBILITY:
 * - Securely orchestrates communication with external AI providers.
 * - Hides API credentials from the public-facing frontend.
 * - Formats client conversation history into provider-specific schemas.
 * - Implements fallbacks and friendly error handling.
 */

// Native fetch is available in Node.js 18+

/**
 * Call Google Gemini API
 */
async function callGemini({ prompt, history = [], apiKey, model = 'gemini-1.5-flash', systemPrompt }) {
  if (!apiKey) {
    throw new Error('Google Gemini API Key is missing. Please provide it in backend/.env or in the Settings panel.');
  }

  // Format history for Gemini API: { role: 'user' | 'model', parts: [{ text }] }
  const contents = [];

  // Add past conversation turns
  for (const msg of history) {
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    });
  }

  // Add the current user prompt
  contents.push({
    role: 'user',
    parts: [{ text: prompt }]
  });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048
    }
  };

  if (systemPrompt && systemPrompt.trim()) {
    requestBody.systemInstruction = {
      parts: [{ text: systemPrompt.trim() }]
    };
  }

  const startTime = Date.now();
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  const latencyMs = Date.now() - startTime;

  if (!response.ok) {
    let errDetail = 'Unknown Gemini API error';
    try {
      const errJson = await response.json();
      errDetail = errJson.error?.message || JSON.stringify(errJson);
    } catch {
      errDetail = await response.text();
    }
    throw new Error(`Gemini API Error (${response.status}): ${errDetail}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const replyText = candidate?.content?.parts?.map(p => p.text).join('') || 'No response generated.';

  return {
    reply: replyText,
    provider: 'gemini',
    model,
    latencyMs,
    usage: data.usageMetadata || null
  };
}

/**
 * Call OpenAI API
 */
async function callOpenAI({ prompt, history = [], apiKey, model = 'gpt-4o-mini', systemPrompt }) {
  if (!apiKey) {
    throw new Error('OpenAI API Key is missing. Please provide it in backend/.env or in the Settings panel.');
  }

  const messages = [];

  if (systemPrompt && systemPrompt.trim()) {
    messages.push({ role: 'system', content: systemPrompt.trim() });
  } else {
    messages.push({ role: 'system', content: 'You are a helpful, knowledgeable AI assistant.' });
  }

  for (const msg of history) {
    messages.push({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    });
  }

  messages.push({ role: 'user', content: prompt });

  const startTime = Date.now();
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7
    })
  });

  const latencyMs = Date.now() - startTime;

  if (!response.ok) {
    let errDetail = 'Unknown OpenAI error';
    try {
      const errJson = await response.json();
      errDetail = errJson.error?.message || JSON.stringify(errJson);
    } catch {
      errDetail = await response.text();
    }
    throw new Error(`OpenAI API Error (${response.status}): ${errDetail}`);
  }

  const data = await response.json();
  const replyText = data.choices?.[0]?.message?.content || 'No response generated.';

  return {
    reply: replyText,
    provider: 'openai',
    model,
    latencyMs,
    usage: data.usage || null
  };
}

/**
 * Smart Simulated Mock LLM for zero-config immediate demonstrations
 */
async function callMockLLM({ prompt, history = [], model = 'mock-llm-v1' }) {
  // Simulate network latency (400 - 800ms)
  const delay = Math.floor(Math.random() * 400) + 400;
  await new Promise(resolve => setTimeout(resolve, delay));

  const lower = prompt.toLowerCase();
  let reply = '';

  if (lower.includes('difference') || lower.includes('frontend') || lower.includes('backend') || lower.includes('differentiation')) {
    reply = `### 🌐 Clear Differentiation: Frontend vs Backend

In this application, notice how cleanly the responsibilities are split:

| Layer | Technology | Primary Responsibilities |
| :--- | :--- | :--- |
| **Frontend** | HTML5, Vanilla CSS, Client JS | UI rendering, user interaction, message history display, capturing input, sending HTTP requests to \`/api/chat\`. Never exposes secret keys! |
| **Backend** | Node.js, Express, REST API | Business logic, secure API key storage (\`.env\`), LLM provider communication (Gemini/OpenAI), rate limiting, payload sanitization. |
| **External LLM** | Cloud AI (Gemini / OpenAI) | Receives vetted request from backend, processes prompt, returns raw tokens. |

> **Key Rule of Architecture**: The browser **never** calls the LLM provider directly with your secret API key. The backend acts as a secure reverse proxy and controller!`;
  } else if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
    reply = `Hello! 👋 I am your AI assistant running through your **Node.js Express backend**.

Your chat application architecture is functioning properly:
1. **Frontend** captures your message and sends a \`POST /api/chat\` request.
2. **Backend** processes and formats the payload, then coordinates with the LLM engine.
3. **Response** is delivered back as structured JSON and styled dynamically on the client!

How can I help you today? You can test out coding questions, ask for explanations, or plug in a live **Gemini** or **OpenAI** API key in the Settings tab!`;
  } else if (lower.includes('code') || lower.includes('javascript') || lower.includes('python')) {
    reply = `Here is an example demonstrating how clean and modular backend routes are structured in Node.js:

\`\`\`javascript
// backend/routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

// Clean REST API endpoint for chat completions
router.post('/chat', chatController.handleChat);
router.get('/health', chatController.getHealth);

module.exports = router;
\`\`\`

And on the client side, the frontend simply executes:
\`\`\`javascript
// frontend/app.js
const response = await fetch('http://localhost:3001/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: userMessage })
});
const data = await response.json();
\`\`\`

Notice the clean separation: the client has zero knowledge of API secrets!`;
  } else {
    reply = `You asked: **"${prompt}"**

This response was generated by the **Mock Simulation LLM** running locally on your Node.js backend. 

### Why you're seeing this:
- The system is currently in **Demo / Mock Mode** so you can test the entire full-stack chat experience without needing an API key right away!
- To connect to **Google Gemini** or **OpenAI**:
  1. Click the **⚙️ Settings** icon in the top header.
  2. Select your provider and paste your API key (or put it in \`backend/.env\`).
  3. Send any prompt to receive live AI completions from the cloud!

*Latency recorded: ${delay}ms via Node.js Express backend.*`;
  }

  return {
    reply,
    provider: 'mock',
    model,
    latencyMs: delay,
    usage: { promptTokens: prompt.length / 4, completionTokens: reply.length / 4 }
  };
}

/**
 * Main dispatcher for LLM requests
 */
async function generateChatResponse({ prompt, history = [], provider = 'auto', model, apiKey, systemPrompt }) {
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('A valid prompt string is required.');
  }

  // Determine provider if auto
  let selectedProvider = provider;
  if (!selectedProvider || selectedProvider === 'auto') {
    if (apiKey || process.env.GEMINI_API_KEY) {
      selectedProvider = 'gemini';
    } else if (process.env.OPENAI_API_KEY) {
      selectedProvider = 'openai';
    } else {
      selectedProvider = 'mock';
    }
  }

  const effectiveGeminiKey = apiKey || process.env.GEMINI_API_KEY;
  const effectiveOpenAIKey = apiKey || process.env.OPENAI_API_KEY;

  switch (selectedProvider.toLowerCase()) {
    case 'gemini': {
      const targetModel = model || 'gemini-1.5-flash';
      // If no key provided, fallback to mock with warning or throw
      if (!effectiveGeminiKey) {
        throw new Error('Gemini API key not found. Please provide an API key in backend/.env or the Settings panel.');
      }
      return await callGemini({
        prompt,
        history,
        apiKey: effectiveGeminiKey,
        model: targetModel,
        systemPrompt
      });
    }

    case 'openai': {
      const targetModel = model || 'gpt-4o-mini';
      if (!effectiveOpenAIKey) {
        throw new Error('OpenAI API key not found. Please provide an API key in backend/.env or the Settings panel.');
      }
      return await callOpenAI({
        prompt,
        history,
        apiKey: effectiveOpenAIKey,
        model: targetModel,
        systemPrompt
      });
    }

    case 'mock':
    default:
      return await callMockLLM({
        prompt,
        history,
        model: model || 'mock-llm-v1'
      });
  }
}

module.exports = {
  generateChatResponse,
  callGemini,
  callOpenAI,
  callMockLLM
};
