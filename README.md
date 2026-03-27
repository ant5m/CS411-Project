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
# Use one of these server-side keys:
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_SECRET_KEY=your-secret-key
```

Then run `backend/supabase/schema.sql` in Supabase SQL editor to create the `events` table.

Quick steps to get these values:

1. In Supabase, create a new project.
2. Open `Project Settings -> API`.
3. Copy `Project URL` into `SUPABASE_URL`.
4. From `Publishable and secret API keys`, copy `Secret key` into `SUPABASE_SECRET_KEY`.
5. (Optional legacy path) From `Legacy anon, service_role API keys`, copy `service_role` into `SUPABASE_SERVICE_ROLE_KEY`.
6. Open `SQL Editor`, paste `backend/supabase/schema.sql`, and run it.
7. Restart backend.

Verify connection:

```bash
curl http://localhost:4000/api/supabase/status
```

Expected success response:

```json
{
	"configured": true,
	"reachable": true,
	"table": "public.events"
}
```

Without Supabase credentials, the backend stores events in memory for local development.

## 2) Frontend Setup (Next.js)

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Frontend runs at `http://localhost:3000` and requests daily stats from the backend.

## 3) Authentication Setup

### Database Schema

Run both SQL scripts in Supabase SQL Editor to set up user management:

1. `backend/supabase/schema.sql` (events table)
2. `backend/supabase/users_schema.sql` (users table for API keys)

### Enable Supabase Auth

In Supabase project:

1. Go to `Authentication -> Providers`
2. Enable `Email` provider
3. Configure email settings if needed

### Google OAuth Setup (Optional - BU-Restricted)

To enable "Sign in with Google" (restricted to @bu.edu emails):

1. **Get Google OAuth Credentials:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new OAuth 2.0 application
   - Set redirect URI to: `https://your-project.supabase.co/auth/v1/callback`
   - Copy Client ID and Client Secret

2. **Add to Supabase:**
   - Go to `Authentication -> Providers -> Google`
   - Enable the provider
   - Paste Client ID and Client Secret
   - Save

3. **Domain Restriction:**
   - Only users with @bu.edu email addresses can sign in/sign up
   - This is enforced on the frontend via `/auth/callback` page
   - If a user tries to sign in with a non-@bu.edu email, they're automatically signed out with an error message
   - The sign-up form also validates and disables submission for non-@bu.edu emails

### User Registration Flow

- Users can sign up via:
  - **Google OAuth** (requires @bu.edu email) at `/sign-in` or `/sign-up`
  - **Email/Password** (requires @bu.edu email)
- Users sign in at `/sign-in`
- After auth, users access dashboard at `/dashboard`
- Users can manage their OpenAI API key at `/settings`
- API keys are encrypted and stored per-user in Supabase

### API Endpoints (Auth Required)

- `GET /api/user/api-key` - Fetch user's masked API key
- `POST /api/user/api-key` - Save user's OpenAI API key
- `GET /api/stats/daily` - Get stats for authenticated user

## 4) Browser Extension Setup

The extension automatically tracks ChatGPT usage (messages, tokens, session duration).

### Install Extension (Chrome)

1. Go to `chrome://extensions/`
2. Enable **"Developer mode"** (top-right toggle)
3. Click **"Load unpacked"**
4. Select the `extension/` folder
5. Extension appears in your toolbar

### Configure Extension (API token is mandatory)

> ⚠️ Tracking is blocked until the extension knows who you are. Generate a Supabase auth token from the dashboard and save it in the popup — anonymous traffic is discarded.

1. Click the extension icon
2. Sign in at http://localhost:3000 and open **Settings → API Token**
3. Copy the token and paste it into the extension popup
4. Click **"Save"** (you’ll get a confirmation toast when the token is stored)

### Start Tracking

- Go to https://chatgpt.com
- Send messages normally
- Extension captures each message and posts to `POST /api/events`
- View stats on dashboard at `http://localhost:3000/dashboard`

### What Gets Tracked

- ✅ Message character count
- ✅ Estimated tokens (characters ÷ 4)
- ✅ Session ID (groups messages by conversation)
- ✅ Timestamp
- ✅ User ID (from auth token)

See [extension/README.md](extension/README.md) for detailed extension documentation.

## Current API Endpoints

- `GET /health`
- `GET /api/supabase/status`
- `POST /api/events` - Record tracked event
- `GET /api/stats/daily` (auth required) - Get daily stats
- `GET /api/user/api-key` (auth required) - Get user's masked API key
- `POST /api/user/api-key` (auth required) - Save user's OpenAI API key

## Example Event Payload

```json
{
	"userId": "user-id-from-auth",
	"eventType": "message_sent",
	"messageCharCount": 120,
	"estimatedTokens": 30,
	"sessionId": "4f0df8f5-3127-4c8c-9b7b-2d26eef3f37a"
}
```