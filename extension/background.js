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

// Record event to API
async function recordEvent(eventData) {
  try {
    console.log('🌐 Sending to backend:', eventData);
    
    const response = await fetch(`${API_BASE_URL}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData),
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
