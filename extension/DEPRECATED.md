# Chrome Extension - DEPRECATED

This Chrome extension approach has been replaced with a **direct OpenAI API integration**.

## Why Deprecated?

- 🔌 Extension-based interception is fragile and relies on ChatGPT's unstable DOM/fetch hooks
- 🔐 Direct API integration is more reliable and secure
- 📊 Token usage is accurate from OpenAI's API response, not estimated

## New Flow

1. **User sets OpenAI API key** in Dashboard Settings
2. **Frontend calls** `/api/openai/chat/completions` (your backend)
3. **Backend:**
   - Gets user's saved API key from Supabase
   - Calls OpenAI with the API key
   - **Automatically tracks tokens** from OpenAI's response metadata
   - Stores the event in `public.events` table
   - Returns response to frontend
4. **Dashboard** shows real token usage from `/api/stats/daily`

## To Remove This Extension

- Delete the `extension/` folder from your repo
- Users will access the tracker via the web dashboard only

## Files to Keep

- ✅ `backend/` - API with `/api/openai/chat/completions` endpoint
- ✅ `frontend/` - Dashboard + Settings page for API key
- ❌ `extension/` - **No longer needed**
