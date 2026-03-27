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

  console.log('💬 Recording (page context):', payload);

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
  const url = args[0]?.toString?.() || '';
  const options = args[1];

  // Log all requests for debugging
  if (url.includes('backend-api') || url.includes('conversation')) {
    console.log('🔍 Fetch:', url, options?.method);
    
    // Intercept conversation/response sends
    if (options?.method === 'POST' && url.includes('conversation')) {
      // Get the body
      try {
        const bodyStr = options.body;
        if (bodyStr) {
          const bodyObj = JSON.parse(bodyStr);
          const content = bodyObj?.messages?.[bodyObj.messages.length - 1]?.content;
          
          if (content) {
            let messageText = '';
            
            if (typeof content === 'string') {
              messageText = content;
            } else if (Array.isArray(content)) {
              messageText = content
                .map(c => c.text || '')
                .filter(Boolean)
                .join(' ');
            } else if (content.text) {
              messageText = content.text;
            }
            
            if (messageText.trim()) {
              console.log('💬 Message detected:', messageText.substring(0, 50));
              recordEvent({
                eventType: 'message_sent',
                messageCharCount: messageText.length,
                estimatedTokens: Math.ceil(messageText.length / 4),
              });
            }
          }
        }
      } catch (e) {
        console.error('Parse error:', e);
      }
    }
  }

  return originalFetch.apply(this, args);
};

// ============================================================
// DOM LISTENERS (FALLBACK)
// ============================================================

const INPUT_SELECTORS = [
  'textarea[data-id="main-input"]',
  'textarea[placeholder*="message"]',
  'textarea[id^="prompt-textarea"]',
  'textarea'
];

let lastCapturedSignature = '';

function signatureFor(text) {
  const trimmed = text.trim();
  return `${trimmed.length}:${trimmed.slice(0, 25)}`;
}

function captureFromTextarea(rawText) {
  const text = (rawText || '').trim();
  if (!text) return;

  const signature = signatureFor(text);
  if (signature === lastCapturedSignature) {
    return;
  }
  lastCapturedSignature = signature;
  setTimeout(() => {
    if (lastCapturedSignature === signature) {
      lastCapturedSignature = '';
    }
  }, 2000);

  console.log('✍️ Detected outgoing message via DOM:', text.substring(0, 50));
  recordEvent({
    eventType: 'message_sent',
    messageCharCount: text.length,
    estimatedTokens: Math.ceil(text.length / 4),
  });
}

function attachListenersToTextarea(textarea) {
  if (!textarea || textarea.dataset.trackerAttached === 'true') {
    return;
  }

  textarea.dataset.trackerAttached = 'true';
  console.log('🧩 Tracker attached to textarea');

  const handleSubmit = () => {
    setTimeout(() => captureFromTextarea(textarea.value), 10);
  };

  textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      handleSubmit();
    }
  });

  const form = textarea.closest('form');
  if (form) {
    form.addEventListener('submit', handleSubmit);
  }

  const sendButton = form?.querySelector('button[type="submit"], button[data-testid="send-button"]');
  if (sendButton) {
    sendButton.addEventListener('click', handleSubmit);
  }
}

function findTextarea() {
  for (const selector of INPUT_SELECTORS) {
    const el = document.querySelector(selector);
    if (el) return el;
  }
  return null;
}

function startTextareaObserver() {
  const attemptAttach = () => {
    const textarea = findTextarea();
    if (textarea) {
      attachListenersToTextarea(textarea);
    }
  };

  attemptAttach();

  const observer = new MutationObserver(() => {
    attemptAttach();
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// ============================================================
// READY STATE
// ============================================================

function initTracker() {
  startTextareaObserver();
  console.log('✅ Tracker initialized in page context.');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTracker);
} else {
  initTracker();
}

window.testTracker = function(msg = 'Hello, this is a test message for the tracker!') {
  console.log('🧪 TEST: Recording test event');
  recordEvent({
    eventType: 'message_sent',
    messageCharCount: msg.length,
    estimatedTokens: Math.ceil(msg.length / 4),
  });
};

console.log('✅ Ready. Test with: window.testTracker()');
