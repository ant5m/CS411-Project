// Background Service Worker for Chrome Extension MV3
console.log(' BACKGROUND WORKER STARTED');

const API_BASE_URL = 'http://localhost:4000';

// Listen for messages from injector/content
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log(' Background received message:', request.action, 'from', sender.url);
  
  if (request.action === 'recordEvent') {
    console.log(' Recording event:', request.event);
    recordEvent(request.event)
      .then((success) => {
        console.log(' Event recorded, responding:', { success });
        sendResponse({ success });
      })
      .catch((error) => {
        console.error(' Error recording event:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }

  if (request.action === 'setAuthToken') {
    const token = request.token;
    const userId = request.userId;
    console.log(' Background: Received auth token for user:', userId);
    console.log(' Background: Token length:', token ? token.length : 0);
    console.log(' Background: Token preview:', token ? token.substring(0, 20) + '...' : 'null');
    
    // Store token in chrome.storage.sync (persists across device restarts)
    chrome.storage.sync.set({ 
      authToken: token,
      authenticatedUserId: userId,
      tokenSetAt: new Date().toISOString(),
    }, () => {
      console.log(' Background: Auth token stored in sync storage for user:', userId);
      console.log(' Background: Now verifying storage read...');
      
      // Verify it was actually stored
      chrome.storage.sync.get(['authToken', 'authenticatedUserId'], (result) => {
        console.log(' Background: Verified storage contains:', {
          hasAuthToken: !!result.authToken,
          tokenLength: result.authToken ? result.authToken.length : 0,
          userId: result.authenticatedUserId,
          matches: result.authenticatedUserId === userId,
        });
      });
      
      sendResponse({ success: true, userId, message: 'Authentication successful' });
    });
    return true;
  }

  if (request.action === 'setUserId') {
    const userId = request.userId;
    console.log(' Setting authenticated user ID:', userId);
    chrome.storage.local.set({ 
      authenticatedUserId: userId,
      authenticatedUserSetAt: new Date().toISOString(),
    }, () => {
      console.log(' User ID stored:', userId);
      sendResponse({ success: true, userId, message: 'Authenticated user set successfully' });
    });
    return true;
  }
});

// Fetch authenticated user ID and token from storage
async function getAuthenticatedUserIdAndToken() {
  try {
    console.log(' getAuthenticatedUserIdAndToken: Starting retrieval...');
    
    // Try to get from sync storage first (persists across device restarts)
    const syncData = await new Promise((resolve) => {
      console.log(' getAuthenticatedUserIdAndToken: Calling chrome.storage.sync.get...');
      chrome.storage.sync.get(['authToken', 'authenticatedUserId'], (result) => {
        console.log(' getAuthenticatedUserIdAndToken: Sync storage result:', {
          hasAuthToken: !!result.authToken,
          tokenLength: result.authToken ? result.authToken.length : 0,
          userId: result.authenticatedUserId,
          keys: Object.keys(result),
        });
        resolve(result);
      });
    });

    if (syncData.authToken) {
      console.log(' Using JWT token from sync storage');
      return { 
        userId: syncData.authenticatedUserId,
        token: syncData.authToken,
        source: 'sync'
      };
    }

    console.log(' No auth token in sync storage, checking local...');
    
    // Fall back to local storage
    const localData = await new Promise((resolve) => {
      chrome.storage.local.get('authenticatedUserId', (result) => {
        console.log(' Local storage result:', result);
        resolve(result);
      });
    });

    if (localData.authenticatedUserId) {
      console.log(' Using userId from local storage');
      return { 
        userId: localData.authenticatedUserId,
        token: null,
        source: 'local'
      };
    }

    console.warn(' No authenticated user. Extension will track without auth.');
    console.log(' Debug info - Sync storage contents:');
    chrome.storage.sync.get(null, (allData) => {
      console.log(' All sync storage data:', allData);
    });
    
    return { userId: null, token: null, source: 'none' };
  } catch (e) {
    console.warn('Could not fetch auth data:', e.message);
    return { userId: null, token: null, source: 'none' };
  }
}

// ============================================================
// RECORD EVENT (LIVE ONLY - NO QUEUE)
// ============================================================

async function recordEvent(eventData) {
  try {
    console.log('🔴 recordEvent called with:', eventData);
    
    // Get authenticated user ID and token
    const { userId, token, source } = await getAuthenticatedUserIdAndToken();
    console.log('📋 Auth result:', { userId, hasToken: !!token, source });
    
    let finalUserId = userId;
    
    if (!finalUserId) {
      // Fall back to device ID
      finalUserId = await new Promise((resolve) => {
        chrome.storage.local.get('deviceId', (result) => {
          if (result.deviceId) {
            resolve(result.deviceId);
          } else {
            const deviceId = 'device-' + Math.random().toString(36).substr(2, 9);
            chrome.storage.local.set({ deviceId });
            resolve(deviceId);
          }
        });
      });
      console.log(' Using device ID (no auth):', finalUserId);
    } else {
      console.log(` Using ${source} auth (user ID):`, finalUserId);
    }

    const payload = {
      userId: finalUserId,
      ...eventData,
    };

    // Build headers with optional Authorization
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      console.log('🔐 Including JWT in request');
    }

    console.log('🌐 Sending event to backend:', {
      userId: finalUserId,
      eventType: eventData.eventType,
      messageCharCount: eventData.messageCharCount,
      estimatedTokens: eventData.estimatedTokens,
      hasToken: !!token,
    });
    
    const response = await fetch(`${API_BASE_URL}/api/events`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    console.log(' Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(` HTTP ${response.status}:`, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('Event saved to backend:', {
      eventId: data.event?.id,
      userId: data.event?.user_id,
      eventType: data.event?.event_type,
    });
    
    return true;
    
  } catch (err) {
    console.error('❌ Event failed:', err.message);
    return false;
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Extension installed');
  } else if (details.reason === 'update') {
    console.log('Extension updated');
  }
});

// Debug helper: Show which user is being tracked
async function checkCurrentUser() {
  const stored = await new Promise((resolve) => {
    chrome.storage.local.get(['authenticatedUserId', 'deviceId', 'authenticatedUserSetAt'], (result) => {
      resolve(result);
    });
  });
  
  console.log('CURRENT TRACKING USER:');
  console.log('  Authenticated User ID:', stored.authenticatedUserId || 'NOT SET');
  console.log('  Set At:', stored.authenticatedUserSetAt || '—');
  console.log('  Device ID (fallback):', stored.deviceId || 'NOT SET');
  console.log('  Using:', stored.authenticatedUserId ? 'AUTHENTICATED' : '⚠️ DEVICE ID FALLBACK');
}
