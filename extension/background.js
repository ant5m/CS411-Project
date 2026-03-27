// Background Service Worker for Chrome Extension MV3
console.log('🔧 BACKGROUND WORKER STARTED');

const API_BASE_URL = 'http://localhost:4000';

// Listen for messages from injector/content
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('🎯 Background received message:', request.action, 'from', sender.url);
  
  if (request.action === 'recordEvent') {
    console.log('📥 Recording event:', request.event);
    recordEvent(request.event)
      .then((success) => {
        console.log('✅ Event recorded, responding:', { success });
        sendResponse({ success });
      })
      .catch((error) => {
        console.error('❌ Error recording event:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }
});

// Fetch authenticated user ID from backend
async function getAuthenticatedUserId() {
  try {
    // Try to get from extension storage cache
    const stored = await new Promise((resolve) => {
      chrome.storage.local.get('authenticatedUserId', (result) => {
        resolve(result.authenticatedUserId);
      });
    });

    if (stored) {
      return stored;
    }

    // If not cached, return device ID
    const response = await fetch(`${API_BASE_URL}/api/user/me`, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.userId) {
        chrome.storage.local.set({ authenticatedUserId: data.userId });
        return data.userId;
      }
    }
  } catch (e) {
    console.warn('Could not fetch authenticated user ID:', e.message);
  }

  // Fallback to device ID
  let id = await new Promise((resolve) => {
    chrome.storage.local.get('deviceId', (result) => {
      resolve(result.deviceId);
    });
  });

  if (!id) {
    id = 'device-' + Date.now();
    chrome.storage.local.set({ deviceId: id });
  }

  return id;
}

// Record event to API
async function recordEvent(eventData) {
  try {
    const userId = await getAuthenticatedUserId();
    const payload = {
      userId,
      ...eventData,
    };

    console.log('🌐 Sending to backend:', payload);
    
    const response = await fetch(`${API_BASE_URL}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('💾 Saved to backend:', data);
    
    // Update storage
    chrome.storage.local.get(['eventCount', 'totalTokens'], (storageData) => {
      const newCount = (storageData.eventCount || 0) + 1;
      const newTokens = (storageData.totalTokens || 0) + (eventData.estimatedTokens || 0);
      
      chrome.storage.local.set({
        eventCount: newCount,
        totalTokens: newTokens,
        lastEvent: new Date().toISOString(),
      });
      
      console.log('📊 Updated storage:', { eventCount: newCount, totalTokens: newTokens });
    });
    
    return true;
  } catch (e) {
    console.error('❌ Error in recordEvent:', e);
    throw e;
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('🔔 Extension installed');
  }
});
