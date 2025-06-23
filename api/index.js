// Trello ChatGPT Connector – Fully MCP-Compliant Version (Vercel-ready)

/*
ENV VARS required on Vercel:
  TRELLO_KEY     – your Trello API key
  TRELLO_SECRET  – your Trello API secret (kept for future OAuth flow)
  BASE_URL       – full https root of the deployment (no trailing slash)

Flow:
  1. Deploy, then visit /auth once to link Trello
  2. ChatGPT consumes the MCP endpoints declared in openapi.yaml
*/

const express = require('express');
const axios   = require('axios');
const session = require('express-session');
const path    = require('path');
require('dotenv').config();

const app = express();

// ──────────────────────────────────────────────────────────
// Middleware
app.use(express.json());
app.use(session({
  secret: 'trello-secret',
  resave: false,
  saveUninitialized: true
}));

const API_BASE = 'https://api.trello.com/1';

// ──────────────────────────────────────────────────────────
// Helpers
const trelloRequest = async (method, path, token, data = {}) => {
  const url = `${API_BASE}${path}`;
  const params = { key: process.env.TRELLO_KEY, token };
  const res = await axios({ method, url, params, data });
  return res.data;
};

const requireAuth = (req, res, next) => {
  if (!req.session.trello_token) {
    return res.status(401).send('Not authenticated. Visit /auth to link Trello.');
  }
  next();
};

// ──────────────────────────────────────────────────────────
// OAuth (token-only, no secret)
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

// ──────────────────────────────────────────────────────────
// MCP Endpoints
app.get('/mcp/boards', requireAuth, async (req, res) => {
  const boards = await trelloRequest('get', '/members/me/boards', req.session.trello_token);
  res.json({ boards }); // Wrapping in object to comply with MCP expectation
});

app.get('/mcp/boards/:boardId/cards', requireAuth, async (req, res) => {
  const { boardId } = req.params;
  const cards = await trelloRequest('get', `/boards/${boardId}/cards`, req.session.trello_token);
  res.json({ cards }); // Wrapping in object to comply with MCP expectation
});

// ──────────────────────────────────────────────────────────
// Discovery Endpoints Required by MCP Spec
app.get('/openapi.yaml', (req, res) => {
  res.type('yaml');
  res.sendFile(path.join(__dirname, 'openapi.yaml'));
});

app.get('/tools/list', (req, res) => {
  const host = `${req.protocol}://${req.get('host')}`;
  res.json([
    {
      name: 'trello',
      description: 'Interact with Trello boards, cards and lists',
      openapi: { url: `${host}/openapi.yaml` }
    }
  ]);
});

app.get('/tools/trello', (req, res) => {
  const host = `${req.protocol}://${req.get('host')}`;
  res.json({
    name: 'trello',
    description: 'Interact with Trello boards, cards and lists',
    openapi: { url: `${host}/openapi.yaml` }
  });
});

// ──────────────────────────────────────────────────────────
// Export the Express app
module.exports = app;
