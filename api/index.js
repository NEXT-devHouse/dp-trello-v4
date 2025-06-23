// Trello ChatGPT Connector – Fully MCP-Compliant (Vercel-ready)

const express = require('express');
const axios   = require('axios');
const session = require('express-session');
const path    = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(session({ secret: 'trello-secret', resave: false, saveUninitialized: true }));

const API_BASE = 'https://api.trello.com/1';

// ── helpers ───────────────────────────────────────────────
const trelloRequest = async (method, p, token, data = {}) => {
  const url    = `${API_BASE}${p}`;
  const params = { key: process.env.TRELLO_KEY, token };
  const res    = await axios({ method, url, params, data });
  return res.data;
};

const requireAuth = (req, res, next) =>
  req.session.trello_token ? next() : res.status(401).send('Not authenticated. Visit /auth');

// ── OAuth flow ────────────────────────────────────────────
app.get('/auth', (req, res) => {
  const redirect = `${process.env.BASE_URL}/callback`;
  const url =
    `https://trello.com/1/authorize?expiration=never&name=ChatGPT+Connector` +
    `&scope=read,write&response_type=token&key=${process.env.TRELLO_KEY}` +
    `&return_url=${redirect}`;
  res.redirect(url);
});

app.get('/callback', (req, res) => {
  if (req.query.token) req.session.trello_token = req.query.token;
  res.send('✅ Trello linked. You can close this tab.');
});

// ── MCP endpoints ─────────────────────────────────────────
app.get('/mcp/boards', requireAuth, async (req, res) => {
  const boards = await trelloRequest('get', '/members/me/boards', req.session.trello_token);
  res.json({ boards });                        // <-- wrapped in object
});

app.get('/mcp/boards/:boardId/cards', requireAuth, async (req, res) => {
  const cards = await trelloRequest(
    'get',
    `/boards/${req.params.boardId}/cards`,
    req.session.trello_token
  );
  res.json({ cards });                         // <-- wrapped in object
});

// ── Discovery endpoints ──────────────────────────────────
app.get('/openapi.yaml', (req, res) => {
  res.type('yaml');
  res.sendFile(path.join(__dirname, 'openapi.yaml'));
});

const toolJson = req => ({
  name: 'trello',
  description: 'Interact with Trello boards, cards and lists',
  openapi: { url: `${req.protocol}://${req.get('host')}/openapi.yaml` }
});

app.get('/tools/list',  (req, res) => res.json([toolJson(req)]));
app.get('/tools/trello', (req, res) => res.json(toolJson(req)));

module.exports = app;  // Vercel handles the listener
