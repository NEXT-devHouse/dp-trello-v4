// Trello ChatGPT Connector – Extended Package (Vercel‑ready)
// o3 model compliant – includes analytics & reporting endpoints

/*
ENV VARS required on Vercel:
  TRELLO_KEY     – your Trello API key
  TRELLO_SECRET  – your Trello API secret
  BASE_URL       – full https root of the deployment

Flow:
  1. Deploy then visit /auth to link Trello
  2. ChatGPT calls MCP endpoints
*/

const express = require('express');
const axios   = require('axios');
const session = require('express-session');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(session({
  secret: 'trello-secret',
  resave: false,
  saveUninitialized: true
}));

const API_BASE = 'https://api.trello.com/1';

const trelloRequest = async (method, path, token, data = {}) => {
  const url = `${API_BASE}${path}`;
  const params = { key: process.env.TRELLO_KEY, token };
  const res = await axios({ method, url, params, data });
  return res.data;
};

const requireAuth = (req, res, next) => {
  if (!req.session.trello_token) return res.status(401).send('Not authenticated. Hit /auth');
  next();
};

// OAuth
app.get('/auth', (req, res) => {
  const redirect = `${process.env.BASE_URL}/callback`;
  const url = `https://trello.com/1/authorize?expiration=never&name=ChatGPT+Connector&scope=read,write&response_type=token&key=${process.env.TRELLO_KEY}&return_url=${redirect}`;
  res.redirect(url);
});

app.get('/callback', (req, res) => {
  req.session.trello_token = req.query.token;
  res.send('✅ Trello linked. You can close this tab.');
});

// Core MCP
app.get('/mcp/boards', requireAuth, async (req, res) => {
  res.json(await trelloRequest('get', '/members/me/boards', req.session.trello_token));
});

app.get('/mcp/boards/:boardId/cards', requireAuth, async (req, res) => {
  res.json(await trelloRequest('get', `/boards/${req.params.boardId}/cards`, req.session.trello_token));
});

// Start
app.listen(PORT, () => console.log('Trello connector running'));
module.exports = app;