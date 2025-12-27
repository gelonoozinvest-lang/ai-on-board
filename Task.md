--- START OF FILE ---
Full Technical Specification (ТЗ) for Multi‑Site AI Cabinet System

1. Overview
- Purpose: Provide a multi‑site AI onboarding and lead qualification system integrated with Zitadel, n8n, HubSpot CRM, and Supabase.
- Components: Cloudflare Pages SPA, Zitadel auth, n8n API, HubSpot CRM, Supabase DB, AI models.

2. Architecture
- Frontend: SPA hosted on Cloudflare Pages.
- Auth: Zitadel (OIDC).
- Backend/API: n8n via Cloudflare Tunnel.
- CRM: HubSpot (Contacts + Deals).
- DB: Supabase/PostgreSQL for chat history and site configuration.
- AI: OpenAI/Anthropic via n8n.

3. Multi‑Site Logic
- Each site has a unique site_id.
- Each site has its own AI script, branding, language, and HubSpot pipeline.
- site_id is passed from frontend to n8n.
- Chat history stored per user_id + site_id.

4. Frontend (Cloudflare Pages)
- Routes: /app/chat, /app/profile, /app/settings.
- Chat UI: message list, input box, AI typing indicator.
- Profile: name, email, logout.
- Settings: notifications placeholder.
- Zitadel login + callback + token storage.
- API calls to n8n with Authorization: Bearer <JWT>.

5. Zitadel Integration
- OIDC login flow.
- Tokens: access_token, id_token, refresh_token.
- Custom claim: site_id (optional).
- Logout: revoke tokens + redirect.

6. Supabase Database Schema
Table: sites
- site_id (string)
- domain (string)
- ai_script_id (string)
- ai_prompt (text)
- brand_name (string)
- language (string)
- hubspot_pipeline (string)
- hubspot_stage (string)
- created_at (timestamp)

Table: chat_messages
- id (uuid)
- user_id (string)
- site_id (string)
- role (user/ai)
- message (text)
- timestamp (timestamp)

Table: users (optional)
- user_id (string)
- email (string)
- first_seen (timestamp)
- last_seen (timestamp)

7. HubSpot Integration
Contact properties:
- ucloud_user_id
- ucloud_site_id
- ucloud_site_name
- ucloud_status (registered/engaged/qualified)
- ucloud_interest
- ucloud_first_message
- ucloud_last_message

Deal properties:
- ucloud_origin
- ucloud_site_id