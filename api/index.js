// Trello ChatGPT Connector – Extended Package (Vercel-ready)
// o3 model compliant – includes analytics & reporting endpoints

/*
ENV VARS required on Vercel:
  TRELLO_KEY     – your Trello API key
  TRELLO_SECRET  – your Trello API secret (kept for future OAuth-1 flow)
  BASE_URL       – full https root of the deployment (no trailing slash)

Flow:
  1. Deploy, then visit /auth once to link Trello for this deployment
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
app.use(
  session({
    secret: 'trello-secret',
    resave: false,
    saveUninitialized: true
  })
);

const API_BASE = 'https://api.trello.com/1';

// ──────────────────────────────────────────────────────────
// Helpers
const trelloRequest = async (method, p, token, data = {}) => {
  const url    = `${API_BASE}${p}`;
  const params = { key: process.env.TRELLO_KEY, token };
  const res    = await axios({ method, url, params, data });
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
// MCP endpoints
app.get('/mcp/boards', requireAuth, async (req, res) => {
  res.json(await trelloRequest('get', '/members/me/boards', req.session.trello_token));
});

app.get('/mcp/boards/:boardId/cards', requireAuth, async (req, res) => {
  const { boardId } = req.params;
  res.json(await trelloRequest('get', `/boards/${boardId}/cards`, req.session.trello_token));
});

// ──────────────────────────────────────────────────────────
// Discovery endpoints required by MCP spec

// Serve the OpenAPI spec so ChatGPT can download it
app.get('/openapi.yaml', (req, res) => {
  res.type('yaml');
  res.sendFile(path.join(__dirname, 'openapi.yaml'));
});

// List available tools for this connector
app.get('/tools/list', (req, res) => {
  res.json([
    {
      name: 'trello',
      description: 'Interact with Trello boards, cards and lists',
      openapi: {
        url: `${process.env.BASE_URL}/openapi.yaml`
      }
    }
  ]);
});

// Single-tool metadata (ChatGPT calls this during connector save)
app.get('/tools/trello', (req, res) => {
  res.json({
    name: 'trello',
    description: 'Interact with Trello boards, cards and lists',
    openapi: { url: `${process.env.BASE_URL}/openapi.yaml` }
  });
});

// ──────────────────────────────────────────────────────────
// Export the Express app (Vercel serverless runtime handles the listener)
module.exports = app;
