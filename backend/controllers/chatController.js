/**
 * Chat Controller
 * 
 * BACKEND RESPONSIBILITY:
 * - Validates incoming client requests.
 * - Enforces business rules and data boundaries.
 * - Handles errors gracefully without crashing the server.
 * - Formats consistent HTTP JSON responses.
 * - Coordinates persistence with Supabase.
 */

const llmService = require('../services/llmService');
const supabaseService = require('../services/supabaseService');

/**
 * Handle POST /api/chat
 */
async function handleChat(req, res) {
  const startTime = Date.now();
  try {
    const { prompt, history, provider, model, apiKey, systemPrompt, conversationId } = req.body;

    // 1. Validation
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error: "prompt" field is required and must be a non-empty string.'
      });
    }

    // Optional header-based API key (x-api-key)
    const effectiveKey = apiKey || req.headers['x-api-key'] || null;

    // Optional Supabase: save user prompt asynchronously
    let activeConversationId = conversationId;
    if (supabaseService.isConfigured()) {
      if (!activeConversationId) {
        const titleSnippet = prompt.trim().substring(0, 40);
        const conv = await supabaseService.saveConversation({
          title: titleSnippet,
          provider: provider || 'mock',
          model: model || 'mock-llm-v1'
        });
        if (conv?.id) activeConversationId = conv.id;
      }

      await supabaseService.saveMessage({
        conversationId: activeConversationId,
        role: 'user',
        content: prompt.trim(),
        provider: provider || 'mock',
        model: model || 'mock-llm-v1'
      });
    }

    // 2. Delegate to LLM Service
    const result = await llmService.generateChatResponse({
      prompt: prompt.trim(),
      history: Array.isArray(history) ? history : [],
      provider,
      model,
      apiKey: effectiveKey,
      systemPrompt
    });

    const totalDurationMs = Date.now() - startTime;

    // Optional Supabase: save assistant reply
    if (supabaseService.isConfigured() && activeConversationId) {
      await supabaseService.saveMessage({
        conversationId: activeConversationId,
        role: 'assistant',
        content: result.reply,
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs
      });
    }

    // 3. Return clean, predictable JSON response
    return res.status(200).json({
      success: true,
      reply: result.reply,
      meta: {
        provider: result.provider,
        model: result.model,
        llmLatencyMs: result.latencyMs,
        totalDurationMs,
        usage: result.usage,
        conversationId: activeConversationId || null,
        supabaseSaved: supabaseService.isConfigured(),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[\x1b[31mBACKEND ERROR in handleChat\x1b[0m]:', error.message);
    const totalDurationMs = Date.now() - startTime;

    // Friendly error classification
    let statusCode = 500;
    if (error.message.includes('missing') || error.message.includes('not found') || error.message.includes('Validation')) {
      statusCode = 400;
    } else if (error.message.includes('API Error (401)') || error.message.includes('403')) {
      statusCode = 401;
    }

    return res.status(statusCode).json({
      success: false,
      error: error.message,
      meta: {
        totalDurationMs,
        timestamp: new Date().toISOString()
      }
    });
  }
}

/**
 * Handle GET /api/config
 * Returns client-safe public configuration (e.g. Supabase URL and Anon Key).
 * Sensitive keys like SERVICE_ROLE_KEY or LLM API keys are NEVER returned!
 */
function getConfig(req, res) {
  return res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    supabaseConfigured: supabaseService.isConfigured(),
    defaultProvider: process.env.DEFAULT_PROVIDER || 'mock'
  });
}

/**
 * Handle GET /api/supabase/status
 */
async function getSupabaseStatus(req, res) {
  const status = await supabaseService.testConnection();
  return res.status(200).json(status);
}

/**
 * Handle GET /api/supabase/messages
 */
async function getSupabaseMessages(req, res) {
  const conversationId = req.query.conversationId;
  const messages = await supabaseService.getMessages(conversationId);
  return res.status(200).json({
    success: true,
    count: messages.length,
    messages
  });
}

/**
 * Handle GET /api/health
 */
function getHealth(req, res) {
  return res.status(200).json({
    status: 'online',
    uptimeSeconds: Math.floor(process.uptime()),
    configuredProviders: {
      geminiConfigured: !!process.env.GEMINI_API_KEY,
      openAiConfigured: !!process.env.OPENAI_API_KEY,
      mockEnabled: true
    },
    supabase: {
      configured: supabaseService.isConfigured(),
      hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasAnonKey: !!process.env.SUPABASE_ANON_KEY
    },
    version: '1.1.0',
    timestamp: new Date().toISOString()
  });
}

/**
 * Handle GET /api/models
 */
function getModels(req, res) {
  return res.status(200).json({
    providers: [
      {
        id: 'gemini',
        name: 'Google Gemini',
        requiresKey: true,
        hasEnvKey: !!process.env.GEMINI_API_KEY,
        models: [
          { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Fast & Recommended)', default: true },
          { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Deep Reasoning)' },
          { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Experimental)' }
        ]
      },
      {
        id: 'openai',
        name: 'OpenAI',
        requiresKey: true,
        hasEnvKey: !!process.env.OPENAI_API_KEY,
        models: [
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fast & Cheap)', default: true },
          { id: 'gpt-4o', name: 'GPT-4o (Flagship Model)' },
          { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo (Legacy)' }
        ]
      },
      {
        id: 'mock',
        name: 'Smart Simulation / Demo',
        requiresKey: false,
        hasEnvKey: true,
        models: [
          { id: 'mock-llm-v1', name: 'Simulated LLM (No API Key Required)', default: true }
        ]
      }
    ]
  });
}

module.exports = {
  handleChat,
  getConfig,
  getSupabaseStatus,
  getSupabaseMessages,
  getHealth,
  getModels
};
