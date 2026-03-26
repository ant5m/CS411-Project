# ChatGPT Usage Tracker Skeleton

This workspace now contains a working frontend and backend skeleton:

- `frontend`: Next.js dashboard
- `backend`: Node.js/Express API (Supabase-ready)

## Project Structure

```
CS411-Project/
	frontend/          # Next.js dashboard UI
	backend/           # Express API + Supabase client bootstrap
		src/
			index.js
			lib/supabase.js
		supabase/schema.sql
```

## 1) Backend Setup

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Backend runs at `http://localhost:4000`.

Health check:

```bash
curl http://localhost:4000/health
```

### Optional Supabase Wiring

In `backend/.env` set:

```bash
SUPABASE_URL=your-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Then run `backend/supabase/schema.sql` in Supabase SQL editor to create the `events` table.

Without Supabase credentials, the backend stores events in memory for local development.

## 2) Frontend Setup (Next.js)

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Frontend runs at `http://localhost:3000` and requests daily stats from the backend.

## Current API Endpoints

- `GET /health`
- `POST /api/events`
- `GET /api/stats/daily?userId=local-dev-user`

## Example Event Payload

```json
{
	"userId": "local-dev-user",
	"eventType": "message_sent",
	"messageCharCount": 120,
	"estimatedTokens": 30,
	"sessionId": "4f0df8f5-3127-4c8c-9b7b-2d26eef3f37a"
}
```