# ChatGPT Usage Tracker - OpenAI API Integration

## New Architecture (Direct API)

The extension-based approach has been **deprecated** in favor of a direct OpenAI API integration.

### Why?

- ✅ **Accurate Token Tracking**: Get real token usage from OpenAI's API response
- ✅ **More Reliable**: No dependency on ChatGPT's DOM/fetch interception 
- ✅ **Better Privacy**: No extension permissions needed
- ✅ **Simpler Setup**: Just authenticate and go

## How It Works

```
User's Frontend
    ↓
POST /api/openai/chat/completions (with auth token & messages)
    ↓
Backend:
  1. Get user's OpenAI API key from Supabase
  2. Create OpenAI client with that key
  3. Call OpenAI API
  4. ✅ Track tokens from response metadata
  5. Store event in `public.events` table
  6. Return response to frontend
    ↓
Dashboard shows real token usage 📊
```

## Setup

### 1. Set Your OpenAI API Key

1. Open dashboard at `http://localhost:3000`
2. Go to **Settings**
3. Paste your OpenAI API key
4. Save

### 2. Use the Tracker

**Option A: Via Dashboard (Future)**
- Create an integrated chat interface in the frontend

**Option B: Programmatically**
```bash
curl -X POST http://localhost:4000/api/openai/chat/completions \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      { "role": "user", "content": "Hello!" }
    ],
    "model": "gpt-4"
  }'
```

### 3. View Stats

Go to **Dashboard** → See today's token usage and message count

## Endpoints

### `POST /api/openai/chat/completions`
Proxy for OpenAI chat completions with automatic token tracking.

**Headers:**
- `Authorization: Bearer <jwt-token>`

**Body:**
```json
{
  "messages": [
    { "role": "user", "content": "..." }
  ],
  "model": "gpt-4 (default)",
  "temperature": 0.7,
  "top_p": 1,
  "max_tokens": 1024
}
```

**Response:** OpenAI's completion response + event tracking

### `GET /api/stats/daily`
Get today's usage stats.

**Headers:**
- `Authorization: Bearer <jwt-token>`

**Response:**
```json
{
  "date": "2026-03-27",
  "messageCount": 5,
  "totalEstimatedTokens": 1250,
  "activeMinutes": 8,
  "productivityInsight": "...",
  "source": "supabase"
}
```

## Database Schema

Events are stored in `public.events`:

```sql
CREATE TABLE public.events (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL, -- 'openai_api_call'
  message_char_count INT,
  estimated_tokens INT,
  created_at TIMESTAMP,
  ...
)
```

## Migration from Extension

✋ The `extension/` folder is deprecated. To fully remove:

```bash
rm -rf extension/
```

All tracking is now done via the backend OpenAI proxy endpoint.
