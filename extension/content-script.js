console.log('🚀 CONTENT SCRIPT LOADED');

// ============================================================
// UTILITIES
// ============================================================

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const SESSION_ID = generateUUID();
console.log('📍 Session:', SESSION_ID);

function getDeviceId() {
  let id = localStorage.getItem('tracker-device-id');
  if (!id) {
    id = 'device-' + Date.now();
    localStorage.setItem('tracker-device-id', id);
  }
  return id;
}

// ============================================================
// SEND TO BACKGROUND
// ============================================================

function recordEvent(eventData) {
  const payload = {
    userId: getDeviceId(),
    sessionId: SESSION_ID,
    timestamp: new Date().toISOString(),
    ...eventData,
  };

  console.log('💬 Event recorded:', payload);

  window.postMessage(
    {
      type: 'CHATGPT_TRACKER_EVENT',
      event: payload,
    },
    '*'
  );
}

// ============================================================
// FETCH INTERCEPTION
// ============================================================

const originalFetch = window.fetch;
window.fetch = function(...args) {
  const [resource] = args;
  const url = typeof resource === 'string' ? resource : resource?.url || '';
  const options = args[1];
  
  // Log ALL POST requests to backend-api for debugging
  if (url.includes('backend-api') && options?.method === 'POST') {
    console.log('🔍 FETCH INTERCEPTED:', url);
    console.log('📋 Body:', options.body ? options.body.substring(0, 200) : 'empty');
    
    try {
      const bodyStr = options.body;
      if (bodyStr && typeof bodyStr === 'string') {
        const body = JSON.parse(bodyStr);
        console.log('📦 Parsed body keys:', Object.keys(body));
        console.log('📦 Full body:', body);
        
        const messages = body?.messages;
        
        if (Array.isArray(messages) && messages.length > 0) {
          const lastMsg = messages[messages.length - 1];
          const content = lastMsg?.content;
          
          let text = '';
          // ChatGPT stores message text in content.parts array
          if (Array.isArray(content?.parts) && content.parts.length > 0) {
            text = content.parts.join(' ');
          } else if (typeof content === 'string') {
            text = content;
          } else if (Array.isArray(content) && content.length > 0) {
            text = content.map(c => c.text || '').join(' ');
          } else if (content?.text) {
            text = content.text;
          }
          
          if (text && text.trim()) {
            console.log(`✅ MESSAGE DETECTED: "${text.substring(0, 60)}..." (${text.length} chars)`);
            recordEvent({
              eventType: 'message_sent',
              messageCharCount: text.length,
              estimatedTokens: Math.ceil(text.length / 4),
            });
          } else {
            console.log('⚠️ Message array found but no text extracted');
          }
        } else {
          console.log('ℹ️ No messages array in body or empty');
        }
      } else {
        console.log('⚠️ Body is not a string or empty');
      }
    } catch (e) {
      console.warn('❌ Parse error:', e.message);
    }
  }

  return originalFetch.apply(this, args);
};

// ============================================================
// AUTH TOKEN LISTENER (from webpage)
// ============================================================

window.addEventListener('message', (event) => {
  // Only accept messages from the webpage itself
  if (event.source !== window) return;
  
  // Listen for auth token from frontend settings page
  if (event.data?.type === 'CHATGPT_TRACKER_AUTH') {
    console.log('🔐 AUTH TOKEN MESSAGE RECEIVED from webpage');
    console.log('👤 User ID:', event.data.userId);
    console.log('🔑 Token available:', !!event.data.token);
    
    // Forward to background worker
    chrome.runtime.sendMessage({
      action: 'setAuthToken',
      token: event.data.token,
      userId: event.data.userId,
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Background error:', chrome.runtime.lastError.message);
      } else {
        console.log('✅ Auth token forwarded to background worker');
      }
    });
  }
});

console.log('✅ Message tracker ready (fetch interception + auth listener)');

// Test function for manual debugging
window.testTracker = function(msg = 'Test message: Hello ChatGPT!') {
  console.log('🧪 TEST: Manually recording test event');
  recordEvent({
    eventType: 'message_sent',
    messageCharCount: msg.length,
    estimatedTokens: Math.ceil(msg.length / 4),
  });
};
