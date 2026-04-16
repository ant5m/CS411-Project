// Injector - runs in extension context and bridges to chrome API
console.log('INJECTOR LOADED - Extension is active');

// Listen for messages from the injected page script
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  
  console.log('Injector received postMessage:', event.data.type);
  
  if (event.data.type === 'CHATGPT_TRACKER_EVENT') {
    console.log('Event from content script:', event.data.event);
    
    // Forward to background worker
    chrome.runtime.sendMessage({
      action: 'recordEvent',
      event: event.data.event,
    }, (response) => {
      console.log('Background response:', response);
      if (!response?.success) {
        console.error('Background error:', response?.error);
      }
    });
  }
  
  // Handle authentication token from frontend
  if (event.data.type === 'CHATGPT_TRACKER_AUTH') {
    console.log('🔐 INJECTOR: AUTH TOKEN MESSAGE RECEIVED from webpage');
    console.log('👤 INJECTOR: User ID:', event.data.userId);
    console.log('🔑 INJECTOR: Token available:', !!event.data.token);
    console.log('🔑 INJECTOR: Token length:', event.data.token ? event.data.token.length : 0);
    console.log('🔑 INJECTOR: Token preview:', event.data.token ? event.data.token.substring(0, 20) + '...' : 'null');
    
    // Send acknowledgment back to the webpage
    window.postMessage({
      type: 'CHATGPT_TRACKER_AUTH_ACK',
      userId: event.data.userId,
    }, '*');
    console.log('📨 INJECTOR: Acknowledgment sent back to webpage');
    
    // Forward to background worker
    console.log('📤 INJECTOR: Forwarding to background worker...');
    chrome.runtime.sendMessage({
      action: 'setAuthToken',
      token: event.data.token,
      userId: event.data.userId,
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('❌ INJECTOR: Background error:', chrome.runtime.lastError.message);
      } else {
        console.log('✅ INJECTOR: Auth token forwarded to background worker');
        console.log('✅ INJECTOR: Response:', response);
      }
    });
  }
});

// Listen for storage changes and broadcast to page
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    console.log('📦 Storage changed in injector:', changes);
    // Broadcast to page
    window.postMessage({
      type: 'STORAGE_UPDATE',
      data: changes,
    }, '*');
  }
});

function broadcastInitialStorageSnapshot() {
  chrome.storage.local.get(['eventCount', 'totalTokens', 'lastEvent'], (data) => {
    window.postMessage({
      type: 'STORAGE_UPDATE',
      data: {
        eventCount: { newValue: data.eventCount || 0 },
        totalTokens: { newValue: data.totalTokens || 0 },
        lastEvent: { newValue: data.lastEvent || null },
      },
    }, '*');
  });
}

// Inject scripts
function injectScript(filename) {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL(filename);
  script.onload = () => {
    console.log(filename, 'injected');
    script.remove();
  };
  script.onerror = () => {
    console.error('Failed to inject', filename);
    script.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}

function injectStyles(filename) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL(filename);
  document.head.appendChild(link);
}

// Expose test function for debugging
window.testTracker = function() {
  console.log(' MANUAL TEST - Simulating event recording');
  chrome.runtime.sendMessage({
    action: 'recordEvent',
    event: {
      userId: 'test-user-' + Date.now(),
      eventType: 'message_sent',
      messageCharCount: 50,
      estimatedTokens: 12,
      sessionId: 'test-session',
      timestamp: new Date().toISOString(),
    }
  }, (response) => {
    console.log('🔄 Test complete. Response:', response);
  });
};

window.checkExtensionStorage = function() {
  chrome.storage.local.get(null, (data) => {
    console.log('📦 EXTENSION STORAGE:', data);
  });
};

// Run immediately
console.log('⏳ Starting injector...');

// Only inject scripts on ChatGPT pages, not on local web app
const isChatGPT = /chatgpt\.com|openai\.com/.test(window.location.hostname);
console.log('🌐 Current page:', window.location.hostname);
console.log('🤖 Is ChatGPT?', isChatGPT);

if (isChatGPT) {
  console.log('✅ ChatGPT detected - injecting message tracker');
  setTimeout(() => {
    // Disabled for now - causing React errors
    // injectStyles('widget.css');
  }, 0);
  setTimeout(() => {
    injectScript('content-script.js');
  }, 10);
  setTimeout(() => {
    // Disabled for now - causing React errors
    // injectScript('widget.js');
  }, 20);
  setTimeout(() => {
    broadcastInitialStorageSnapshot();
  }, 30);

  console.log('💡 Test commands: window.testTracker() or window.checkExtensionStorage()');
} else {
  console.log('ℹ️ Not ChatGPT - postMessage listener active for auth token relay');
}

