// Trello ChatGPT Connector – Extended Package (Vercel‑ready)
// o3 model compliant – includes analytics & reporting endpoints

/*
ENV VARS required on Vercel:
  TRELLO_KEY     – your Trello API key
  TRELLO_SECRET  – your Trello API secret (unused in token flow but kept for future)
  BASE_URL       – full https root of the deployment (set after first deploy)

Flow:
  1. Deploy then visit /auth to link Trello (single user)
  2. ChatGPT calls MCP endpoints below via OpenAPI schema
*/

const express = require('express');
const axios   = require('axios');
const session = require('express-session');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(session({
  secret: 'trello-secret',
  resave: false,
  saveUninitialized: true
}));

const API_BASE = 'https://api.trello.com/1';

// Helper for Trello calls
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

// OAuth start
app.get('/auth', (req, res) => {
  const redirect = `${process.env.BASE_URL}/callback`;
  const url = \`https://trello.com/1/authorize?expiration=never&name=ChatGPT+Connector&scope=read,write&response_type=token&key=\${process.env.TRELLO_KEY}&return_url=\${redirect}\`;
  res.redirect(url);
});

// OAuth callback
app.get('/callback', (req, res) => {
  const { token } = req.query;
  req.session.trello_token = token;
  res.send('✅ Trello linked. You can close this tab.');
});

// Core endpoints
app.get('/mcp/boards', requireAuth, async (req, res) => {
  const boards = await trelloRequest('get', '/members/me/boards', req.session.trello_token);
  res.json(boards);
});

app.get('/mcp/boards/:boardId/lists', requireAuth, async (req, res) => {
  const lists = await trelloRequest('get', \`/boards/\${req.params.boardId}/lists\`, req.session.trello_token);
  res.json(lists);
});

app.get('/mcp/boards/:boardId/cards', requireAuth, async (req, res) => {
  const cards = await trelloRequest('get', \`/boards/\${req.params.boardId}/cards\`, req.session.trello_token);
  res.json(cards);
});

// Create card
app.post('/mcp/boards/:boardId/lists/:listId/cards', requireAuth, async (req, res) => {
  const { name, desc = '' } = req.body;
  const card = await trelloRequest('post', '/cards', req.session.trello_token, {
    idList: req.params.listId,
    name,
    desc
  });
  res.json(card);
});

// Move card
app.post('/mcp/cards/:cardId/move', requireAuth, async (req, res) => {
  const { listId } = req.body;
  const card = await trelloRequest('put', \`/cards/\${req.params.cardId}\`, req.session.trello_token, {
    idList: listId
  });
  res.json(card);
});

// Assign member
app.post('/mcp/cards/:cardId/assign', requireAuth, async (req, res) => {
  const { memberId } = req.body;
  const card = await trelloRequest('post', \`/cards/\${req.params.cardId}/idMembers\`, req.session.trello_token, {
    value: memberId
  });
  res.json(card);
});

// Analytics endpoints
app.get('/mcp/boards/:boardId/summary', requireAuth, async (req, res) => {
  const token = req.session.trello_token;
  const [lists, cards] = await Promise.all([
    trelloRequest('get', \`/boards/\${req.params.boardId}/lists\`, token),
    trelloRequest('get', \`/boards/\${req.params.boardId}/cards\`, token)
  ]);
  const summary = lists.map(l => {
    const listCards = cards.filter(c => c.idList === l.id);
    return {
      listId: l.id,
      listName: l.name,
      openCards: listCards.filter(c => !c.closed).length,
      closedCards: listCards.filter(c => c.closed).length
    };
  });
  res.json(summary);
});

app.get('/mcp/boards/:boardId/due', requireAuth, async (req, res) => {
  const token = req.session.trello_token;
  const cards = await trelloRequest('get', \`/boards/\${req.params.boardId}/cards\`, token);
  const now = new Date();
  const soon = new Date();
  soon.setDate(now.getDate() + 7);
  const dueSoon = [], overdue = [];
  cards.forEach(c => {
    if (c.due) {
      const dueDate = new Date(c.due);
      if (dueDate < now) overdue.push(c);
      else if (dueDate <= soon) dueSoon.push(c);
    }
  });
  res.json({ dueSoon, overdue });
});

app.get('/mcp/boards/:boardId/assignments', requireAuth, async (req, res) => {
  const token = req.session.trello_token;
  const cards = await trelloRequest('get', \`/boards/\${req.params.boardId}/cards\`, token);
  const workload = {};
  cards.forEach(c => {
    c.idMembers.forEach(m => {
      workload[m] = (workload[m] || 0) + 1;
    });
  });
  res.json(workload);
});

app.listen(PORT, () => console.log(\`Trello connector running on \${PORT}\`));
module.exports = app;
