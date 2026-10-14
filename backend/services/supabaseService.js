/**
 * Supabase Database Service (Backend)
 * 
 * BACKEND RESPONSIBILITY:
 * - Initializes the Supabase client using administrative credentials (SERVICE_ROLE_KEY or ANON_KEY).
 * - Persists conversation threads and messages to Supabase PostgreSQL database.
 * - Enforces server-side data integrity and graceful offline fallbacks.
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || '';
// Prefer the privileged SERVICE_ROLE_KEY on backend, fallback to ANON_KEY
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

let supabase = null;

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    console.log('[\x1b[32mSUPABASE\x1b[0m] Initialized client with endpoint:', supabaseUrl);
  } catch (err) {
    console.error('[\x1b[31mSUPABASE ERROR\x1b[0m] Failed to initialize client:', err.message);
  }
} else {
  console.log('[\x1b[33mSUPABASE\x1b[0m] Credentials not provided in backend/.env (running in local/offline mode)');
}

/**
 * Check if Supabase client is configured
 */
function isConfigured() {
  return !!supabase;
}

/**
 * Test connectivity to Supabase
 */
async function testConnection() {
  if (!supabase) {
    return {
      connected: false,
      configured: false,
      message: 'Supabase credentials not configured in backend/.env'
    };
  }

  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('count', { count: 'exact', head: true });

    if (error) {
      return {
        connected: false,
        configured: true,
        message: `Supabase query error: ${error.message}. (Did you run supabase_schema.sql?)`,
        error: error
      };
    }

    return {
      connected: true,
      configured: true,
      message: 'Successfully connected to Supabase database!'
    };
  } catch (err) {
    return {
      connected: false,
      configured: true,
      message: `Connection failed: ${err.message}`
    };
  }
}

/**
 * Save or update a conversation session
 */
async function saveConversation({ id, title = 'New Conversation', provider, model }) {
  if (!supabase) return null;

  try {
    const record = {
      title,
      provider: provider || 'mock',
      model: model || 'mock-llm-v1',
      updated_at: new Date().toISOString()
    };
    if (id) record.id = id;

    const { data, error } = await supabase
      .from('conversations')
      .upsert(record)
      .select()
      .single();

    if (error) {
      console.warn('[\x1b[33mSUPABASE WARN\x1b[0m] Could not save conversation:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('[\x1b[33mSUPABASE WARN\x1b[0m] Exception in saveConversation:', err.message);
    return null;
  }
}

/**
 * Save an individual message to Supabase
 */
async function saveMessage({ conversationId, role, content, provider, model, latencyMs }) {
  if (!supabase) return null;

  try {
    const record = {
      role,
      content,
      provider: provider || null,
      model: model || null,
      latency_ms: latencyMs || null,
      created_at: new Date().toISOString()
    };
    if (conversationId) {
      record.conversation_id = conversationId;
    }

    const { data, error } = await supabase
      .from('messages')
      .insert([record])
      .select()
      .single();

    if (error) {
      console.warn('[\x1b[33mSUPABASE WARN\x1b[0m] Could not save message to Supabase:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('[\x1b[33mSUPABASE WARN\x1b[0m] Exception in saveMessage:', err.message);
    return null;
  }
}

/**
 * Fetch messages for a conversation
 */
async function getMessages(conversationId) {
  if (!supabase) return [];

  try {
    let query = supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (conversationId) {
      query = query.eq('conversation_id', conversationId);
    } else {
      query = query.limit(50);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('[\x1b[33mSUPABASE WARN\x1b[0m] Could not fetch messages:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn('[\x1b[33mSUPABASE WARN\x1b[0m] Exception in getMessages:', err.message);
    return [];
  }
}

/**
 * Get recent conversations list
 */
async function getRecentConversations(limit = 10) {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('[\x1b[33mSUPABASE WARN\x1b[0m] Could not fetch conversations:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn('[\x1b[33mSUPABASE WARN\x1b[0m] Exception in getRecentConversations:', err.message);
    return [];
  }
}

module.exports = {
  isConfigured,
  testConnection,
  saveConversation,
  saveMessage,
  getMessages,
  getRecentConversations
};
