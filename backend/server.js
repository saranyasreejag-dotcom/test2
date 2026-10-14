/**
 * Backend Server Entrypoint
 * 
 * BACKEND RESPONSIBILITY:
 * - Bootstraps the HTTP server with Express.
 * - Enforces CORS policies and parses incoming JSON.
 * - Serves the API endpoints under /api.
 * - Serves the frontend static files for seamless single-command launch.
 * - Logs network activity to illustrate frontend-backend communication.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const chatRoutes = require('./routes/chatRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// 1. Middleware
app.use(cors({
  origin: '*', // Allow frontend requests from any origin (e.g. localhost, Live Server, file://)
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));

app.use(express.json({ limit: '1mb' }));

// 2. Request Logger (Visualizing Frontend -> Backend traffic in console)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const color = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
    console.log(
      `[\x1b[36mBACKEND\x1b[0m] ${req.method.padEnd(5)} ${req.originalUrl} -> ${color}${res.statusCode}\x1b[0m (${duration}ms)`
    );
  });
  next();
});

// 3. Mount Backend API Routes
app.use('/api', chatRoutes);

// 4. Serve Frontend Static Files
const frontendDir = path.join(__dirname, '..', 'frontend');
if (fs.existsSync(frontendDir)) {
  app.use(express.static(frontendDir));

  // Fallback to index.html for root path
  app.get('/', (req, res) => {
    res.sendFile(path.join(frontendDir, 'index.html'));
  });
}

// 5. 404 Handler for undefined API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    error: `API route '${req.originalUrl}' not found.`
  });
});

// 6. Global Error Handler
app.use((err, req, res, next) => {
  console.error('[\x1b[31mBACKEND UNHANDLED ERROR\x1b[0m]:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error occurred.'
  });
});

// 7. Start Listening
app.listen(PORT, () => {
  console.log(`
===========================================================
  🚀 FULL-STACK LLM CHATBOX BACKEND IS RUNNING!
===========================================================
  📡 Backend API URL : http://localhost:${PORT}/api
  🌐 Frontend App UI : http://localhost:${PORT}
  🩺 Health Check    : http://localhost:${PORT}/api/health
  🤖 Models Info     : http://localhost:${PORT}/api/models
===========================================================
  [ARCHITECTURE DIFFERENTIATION]
  • FRONTEND: Runs in user browser (HTML/CSS/JS)
  • BACKEND:  Runs on Node.js (Port ${PORT})
  • SECURITY: Backend protects API keys and communicates with LLMs
===========================================================
`);
});
