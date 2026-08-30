import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { agentLoop } from './agent/loop.js';
import * as cache from './cache.js';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS — allow Firebase Hosting origin + localhost dev
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) {
      cb(null, true);
    } else {
      // For prototype: allow all origins (tighten for production)
      cb(null, true);
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json({ limit: '2mb' }));

// ─── Health check ─────────────────────────────────────────
app.get('/health', (_, res) => {
  res.json({
    status: 'ok',
    deals_board: process.env.MONDAY_DEALS_BOARD_ID,
    wo_board: process.env.MONDAY_WORK_ORDERS_BOARD_ID,
    timestamp: new Date().toISOString(),
  });
});

// ─── Chat endpoint ─────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  // Validate roles
  const validRoles = new Set(['user', 'assistant']);
  const invalid = messages.find(m => !validRoles.has(m.role));
  if (invalid) {
    return res.status(400).json({ error: `Invalid message role: ${invalid.role}` });
  }

  try {
    const result = await agentLoop(messages);
    res.json(result);
  } catch (err) {
    console.error('[chat error]', err);
    res.status(500).json({
      error: 'Agent encountered an error',
      details: err.message,
    });
  }
});

// ─── Cache bust endpoint (admin) ──────────────────────────
app.post('/api/cache/clear', (_, res) => {
  cache.clear();
  res.json({ status: 'cache cleared' });
});

app.listen(PORT, () => {
  console.log(`✅ Skylark BI Backend running on port ${PORT}`);
  console.log(`   Deals Board ID:      ${process.env.MONDAY_DEALS_BOARD_ID}`);
  console.log(`   Work Orders Board ID: ${process.env.MONDAY_WORK_ORDERS_BOARD_ID}`);
});
