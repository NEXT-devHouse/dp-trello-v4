# Trello ChatGPT Connector – Extended Package

## Features
* OAuth flow (/auth, /callback)
* Core actions: list boards/lists/cards, create card, move card, assign member
* Analytics: board summary, due soon/overdue, workload per member
* Vercel-ready (serverless)

## Deploy Steps
1. Upload to Vercel as new project.
2. Add env vars:
   * TRELLO_KEY
   * TRELLO_SECRET
   * BASE_URL (set after first deploy)
3. Redeploy.
4. Visit /auth to link Trello.
5. In ChatGPT connector UI, set MCP Server URL to your Vercel URL.
