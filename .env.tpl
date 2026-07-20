# nozero environment template — resolve with: op inject -i .env.tpl -o .env.local
# Secrets live in 1Password vault `cospace.npt` (personal my.1password.eu),
# agnostic bare-title items, referenced as vault/ITEM/field.
# (The old `nopilot.nozero` / `aqua.npt` vaults are retired.)

# Data plane — Railway Postgres (`nozero` db; migrated 2026-07-18 off gily Supabase).
# In Railway, set DATABASE_URL as a reference to the Postgres service's DATABASE_URL
#   (Railway variable-reference syntax), pointed at the `nozero` db on the internal host.
# For LOCAL dev, use the Railway public proxy URL (fill from the Railway dashboard):
# DATABASE_URL=postgres://postgres:<pw>@<host>.proxy.rlwy.net:<port>/nozero

# Site URLs (override for local dev). Prod = https://zero.nopilot.co
SITE_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Session + Google OAuth (nopilot-zero web client; redirect <SITE_URL>/auth/callback)
NOZERO_SESSION_SECRET=op://cospace.npt/SESSION_SECRET/NOZERO_SESSION_SECRET
GOOGLE_CLIENT_ID=op://cospace.npt/GOOGLE_CLIENT_ID/GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=op://cospace.npt/GOOGLE_CLIENT_SECRET/GOOGLE_CLIENT_SECRET

# AI — 1min.ai is nozero's LLM provider (digest, summaries, meeting brief, chat agent)
NOZERO_ONEMINAI_API_KEY=op://cospace.npt/ONEMINAI_API_KEY/NOZERO_ONEMINAI_API_KEY
# NOZERO_ONEMIN_MODEL=gpt-4o-mini   # optional override (default: gpt-4o-mini)

# Soma (email threads, contacts, meeting context) — canonical: cospace.npt/SOMA_ACCESS
NOZERO_SOMA_ANANSI_URL=op://cospace.npt/SOMA_ACCESS/NOZERO_SOMA_ANANSI_URL
NOZERO_SOMA_ANANSI_SECRET_API_KEY=op://cospace.npt/SOMA_ACCESS/NOZERO_SOMA_ANANSI_SECRET_API_KEY
# NOZERO_SOMA_ACCOUNT / NOZERO_SOMA_ADMIN_USER also on SOMA_ACCESS if needed later

# Invite + reply email (MXroute SMTP API)
MXROUTE_SMTP_SERVER=op://cospace.npt/MXROUTE_SMTP_SERVER/MXROUTE_SMTP_SERVER
MXROUTE_SMTP_USERNAME=op://cospace.npt/MXROUTE_SMTP_USERNAME/MXROUTE_SMTP_USERNAME
MXROUTE_SMTP_PASSWORD=op://cospace.npt/MXROUTE_SMTP_PASSWORD/MXROUTE_SMTP_PASSWORD
MXROUTE_FROM_EMAIL=op://cospace.npt/MXROUTE_FROM_EMAIL/MXROUTE_FROM_EMAIL

# Flightdeck board (read) + Tower gateway (mutations / context)
GITHUB_TOKEN=op://cospace.npt/GITHUB_TOKEN/credential
FLIGHTDECK_PROJECT_OWNER=op://nopilot.tower/7gdzwf4jgjfpulxxkkmesjzvuy/FLIGHTDECK_PROJECT_OWNER
FLIGHTDECK_PROJECT_NUMBER=op://nopilot.tower/7gdzwf4jgjfpulxxkkmesjzvuy/FLIGHTDECK_PROJECT_NUMBER
NOZERO_TOWER_API_KEY=op://cospace.npt/NOZERO_TOWER_API_KEY/NOZERO_TOWER_API_KEY

# Krisp MCP (OAuth — per-user tokens stored in DB after connect)
KRISP_MCP_URL=op://cospace.npt/KRISP/KRISP_MCP_URL
KRISP_MCP_CLIENT_ID=op://cospace.npt/KRISP/KRISP_MCP_CLIENT_ID
KRISP_MCP_CLIENT_SECRET=op://cospace.npt/KRISP/KRISP_MCP_CLIENT_SECRET
KRISP_OAUTH_AUTHORIZE_URL=op://cospace.npt/KRISP/KRISP_OAUTH_AUTHORIZE_URL
KRISP_OAUTH_TOKEN_URL=op://cospace.npt/KRISP/KRISP_OAUTH_TOKEN_URL
KRISP_MCP_REDIRECT_URI=op://cospace.npt/KRISP/KRISP_MCP_REDIRECT_URI
# Local dev: register each dev port you use in the Krisp app (redirect follows the browser host):
# http://localhost:3000/api/accounts/krisp/callback
# http://localhost:3001/api/accounts/krisp/callback

# Krisp "Note generated" webhook receiver — POST /api/webhooks/krisp commits notes
# to context-ingest/incoming. Set to the signing secret / token Krisp sends (accepts
# an HMAC-SHA256 `sha256=` signature header OR a static Authorization bearer).
# Point Krisp's webhook at https://zero.nopilot.co/api/webhooks/krisp
KRISP_WEBHOOK_SECRET=op://cospace.npt/KRISP/KRISP_WEBHOOK_SECRET

# Ctx / gbrain MCP gateway — per-actor bearer tokens (Tower pattern)
# Service principal for nozero server: nopilot.agents item, field = nozero
# Agents (pierre, bertrand, …): same item, field = actor id — see AGENTS.md
NOZERO_CTX_GATEWAY_URL=op://cospace.npt/CTX_ACCESS/NOZERO_CTX_GATEWAY_URL
NOZERO_CTX_API_KEY=op://nopilot.agents/iju5zrdkpmqz7y3yqp37d7zc54/nozero

# Dev only — Postgres direct connection for migrations (not injected; run at runtime).
#   psql "$DATABASE_URL" -f migrations/….sql

# --- madrigal pipeline (npt-madrigal) — added 2026-06-21 ---
MADRIGAL_WEBHOOK_SECRET=op://cospace.npt/MADRIGAL_WEBHOOK_SECRET/MADRIGAL_WEBHOOK_SECRET
NOZERO_HERMES_API_URL=http://hermes-webui:8787
NOZERO_HERMES_WEBUI_PASSWORD=op://cospace.npt/HERMES_WEBUI_PASSWORD/NOZERO_HERMES_WEBUI_PASSWORD
# madrigal data home = gily (decision: npt/madrigal state on gily, not goak)
MADRIGAL_SUPABASE_URL=https://gilyyzjsasyhrwterjor.supabase.co
MADRIGAL_SUPABASE_SERVICE_ROLE_KEY=op://cospace.npt/SUPABASE_SERVICE_KEY/SUPABASE_SERVICE_ROLE_KEY
