# ChatGPT Usage Tracker - Browser Extension

Automatically track your ChatGPT usage and monitor message counts, tokens, and session activity. This extension seamlessly integrates with your personal dashboard to provide real-time insights into your ChatGPT usage patterns.

## Prerequisites

Before installing the extension, make sure you have:

1. **Node.js** (v16+) installed
2. **Chrome/Chromium** browser
3. **Backend running** at `http://localhost:4000`
   ```bash
   cd backend
   npm install
   npm start
   ```
4. **Frontend running** at `http://localhost:3000`
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
5. **Supabase project** configured with the events table (see [backend README](../README.md))

## Installation

### Step 1: Load the Extension in Chrome

1. **Open Chrome Extensions page:**

   - Navigate to `chrome://extensions/` in your address bar
   - Toggle on **"Developer mode"** (top-right corner)
2. **Load the unpacked extension:**

   - Click **"Load unpacked"**
   - Navigate to this project's `extension/` folder
   - Select and open the folder
   - The extension should now appear in your Chrome toolbar

### Step 2: Sign In to the Dashboard

1. **Open the dashboard:**

   - Go to `http://localhost:3000`
   - Click **"Sign in with Google"** or use your email/password
   - You'll be redirected to the dashboard
2. **Navigate to Settings:**

   - Click **"Settings"** button in the top-right
   - You should see **" Extension connected and tracking"** if the extension is enabled

### Step 3: Start Tracking

1. **Go to ChatGPT:**

   - Visit https://chatgpt.com
   - Write and send messages normally
2. **Watch the extension track:**

   - Click the extension icon in your Chrome toolbar
   - You'll see:
     - Auto-tracking on
     - Messages Tracked: `[count]`
     - Last Event: `[timestamp]`
3. **View your stats:**

   - Click **"Open Dashboard"** in the extension popup
   - Or go to `http://localhost:3000/dashboard`
   - Your stats update every second

## API Base URL

If you're running the backend on a different port, update the API URL in `background.js`:

```javascript
const API_BASE_URL = "http://localhost:4000"; // Change port if needed
```

After making changes, reload the extension at `chrome://extensions/`.

### CORS Configuration

The backend automatically allows requests from:

- `http://localhost:3000`
- `http://127.0.0.1:3000`
- `https://chat.openai.com` and ChatGPT domains

If you're accessing from a different origin, add it to `backend/.env`:

```env
ADDITIONAL_ALLOWED_ORIGINS=http://your-origin:3000
```

## Data Flow

```
ChatGPT Website
       ↓
   Content Script
       ↓
   Injector (Extension Bridge)
       ↓
  Background Worker
       ↓
  Backend API (localhost:4000)
       ↓
  Supabase Database
```

### Components

- **Content Script** (`content-script.js`)

  - Detects messages sent on ChatGPT
  - Calculates message length and token estimates
  - Sends events to the background worker
- **Injector** (`injector.js`)

  - Bridges between content script and background worker
  - Handles authentication token from the dashboard
  - Manages storage and state
- **Background Worker** (`background.js`)

  - Receives tracked events from the injector
  - Sends events to your backend API
  - Maintains extension state and storage
  - Tracks authentication tokens
- **Popup UI** (`popup.html` / `popup.js`)

  - Displays real-time tracking stats
  - Shows extension status
  - Quick link to open dashboard
