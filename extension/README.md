# ChatGPT Usage Tracker - Browser Extension

Chrome extension to automatically track your ChatGPT usage and monitor message counts, tokens, and session activity.

## Installation

### For Development (Chrome)

1. **Open Chrome Extensions page:**
   - Go to `chrome://extensions/`
   - Enable **"Developer mode"** (toggle at top-right)

2. **Load extension:**
   - Click **"Load unpacked"**
   - Select the `extension/` folder from this project
   - The extension should appear in your Chrome toolbar

3. **Configure the extension (API token REQUIRED):**
   - Click the extension icon in your toolbar
   - Paste your Supabase auth token (generate one by signing in at http://localhost:3000 and opening **Settings → API Token**)
   - Click **"Save"** — without a saved token the extension refuses to send events

4. **Start tracking:**
   - Go to https://chatgpt.com
   - Write and send messages normally
   - Extension automatically captures events and sends them to your backend

## How It Works

### Content Script (`content-script.js`)

- Runs on ChatGPT pages
- Detects when you send messages
- Captures message character count and estimated tokens
- Sends events to backend with your auth token

### Popup UI (`popup.html` / `popup.js`)

- Displays extension status
- Shows when last event was tracked
- Allows you to configure auth token
- Links to your dashboard

### Background Worker (`background.js`)

- Handles message passing between content script and extension
- Manages extension state and storage
- Provides status information to popup

## Usage

### Tracking Messages

> ⚠️ **No API token, no tracking.** Every event call includes your personal Supabase auth token so the backend can attribute usage to your account. If the token is missing or expired, the extension will show an error toast and skip the event.

1. Sign in at http://localhost:3000
2. Open **Settings → API Token** and copy the generated token (or rotate it if you’ve lost it)
3. Paste into extension popup and click **"Save"**
4. Open ChatGPT and send messages normally
5. Events appear on your dashboard in real-time

### Viewing Stats

- Click **"Open Dashboard"** in the extension popup
- Or visit http://localhost:3000/dashboard
- See daily message count, tokens used, and productivity insights

## API Integration

The extension sends events to: `POST http://localhost:4000/api/events`

Payload format:

```json
{
  "userId": "auth-token-or-user-id",
  "eventType": "message_sent",
  "messageCharCount": 150,
  "estimatedTokens": 38,
  "sessionId": "uuid-here",
  "timestamp": "2024-03-26T10:30:00Z"
}
```

## Features

✅ **Automatic tracking** - Detects messages on ChatGPT  
✅ **Token estimation** - Calculates estimated tokens (~4 chars per token)  
✅ **Session tracking** - Groups messages by session ID  
✅ **Auth integration** - Uses Supabase auth tokens  
✅ **Real-time sync** - Posts to backend immediately  
✅ **Status display** - Shows connection and tracking status

## Troubleshooting

### "Token not set" message

- Make sure you're signed in at http://localhost:3000
- Get your token from the settings page (not browser console)
- Paste the full token, not just a portion

### Events not being tracked

- Make sure you're on https://chatgpt.com (not other OpenAI domains)
- Check that backend is running on http://localhost:4000
- Open browser console (F12) to see if there are errors

### "Failed to record event"

- Backend may not be running - start with `npm run dev` in backend/
- Check if auth token is valid and not expired
- Verify Supabase users table exists (run SQL migrations)

## Files

```
extension/
├── manifest.json          # MV3 extension manifest
├── content-script.js      # Page content script (ChatGPT tracking)
├── background.js          # Service worker
├── popup.html             # Extension popup UI
├── popup.js               # Popup script
└── images/                # Icons (optional)
```

## Next Steps

- [ ] Add icon images (16x16, 48x48, 128x128)
- [ ] Add notification when tracking starts
- [ ] Add option to pause/resume tracking
- [ ] Support for Claude, Gemini, other AI chatbots
- [ ] Local data backup
- [ ] Detailed session histories
