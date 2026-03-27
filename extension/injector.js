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
    this.remove();
  };
  script.onerror = () => {
    console.error('Failed to inject', filename);
    this.remove();
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
  console.log('🧪 MANUAL TEST - Simulating event recording');
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
console.log('⏳ Starting injection...');
setTimeout(() => {
  injectStyles('widget.css');
}, 0);
setTimeout(() => {
  injectScript('content-script.js');
}, 10);
setTimeout(() => {
  injectScript('widget.js');
}, 20);
setTimeout(() => {
  broadcastInitialStorageSnapshot();
}, 30);

console.log('💡 Test commands: window.testTracker() or window.checkExtensionStorage()');

