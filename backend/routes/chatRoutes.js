/**
 * Chat Routes
 * 
 * BACKEND RESPONSIBILITY:
 * - Defines explicit HTTP REST endpoints.
 * - Maps incoming URLs and HTTP verbs (GET, POST) to controller handlers.
 */

const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

// POST /api/chat - Execute an LLM conversation turn
router.post('/chat', chatController.handleChat);

// GET /api/health - Check backend status, LLM keys, and Supabase availability
router.get('/health', chatController.getHealth);

// GET /api/models - List supported providers and models
router.get('/models', chatController.getModels);

// GET /api/config - Expose public, client-safe environment variables (e.g. Supabase anon key)
router.get('/config', chatController.getConfig);

// GET /api/supabase/status - Test connection to Supabase database
router.get('/supabase/status', chatController.getSupabaseStatus);

// GET /api/supabase/messages - Fetch persisted chat messages
router.get('/supabase/messages', chatController.getSupabaseMessages);

module.exports = router;
