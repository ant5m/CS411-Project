console.log(' CONTENT SCRIPT LOADED');

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
console.log(' Session:', SESSION_ID);

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

function recordEvent(eventData, messageText) {
  // Simple send - deduplication done at DOM level
  
  const payload = {
    userId: getDeviceId(),
    sessionId: SESSION_ID,
    timestamp: new Date().toISOString(),
    ...eventData,
  };

  console.log('📤 Event sent:', { eventType: eventData.eventType, charCount: eventData.messageCharCount });

  window.postMessage(
    {
      type: 'CHATGPT_TRACKER_EVENT',
      event: payload,
    },
    '*'
  );
}

// ============================================================
// FETCH INTERCEPTION - DISABLED TO PREVENT CHATGPT ERRORS
// ============================================================
// Note: Fetch interception was causing "No resume URL" errors in ChatGPT
// Using DOM mutation observer approach instead

// ============================================================
// DOM MUTATION OBSERVER FOR MESSAGE TRACKING
// ============================================================

// Track processed DOM elements by reference (WeakSet survives attribute loss)
const processedElements = new WeakSet();
const recentMessages = []; // Track recent messages by text + timestamp
const DEDUP_WINDOW = 2000; // 2 second window for deduplication

function extractUserMessage(element) {
  // Look for user message text in ChatGPT's DOM structure
  try {
    let text = '';
    
    // Try to get text content from the element
    text = element.innerText || element.textContent;
    
    return text ? text.trim() : '';
  } catch (e) {
    console.warn('Error extracting message:', e.message);
    return '';
  }
}

function isDuplicate(text) {
  // Check if we've seen this exact text recently
  const now = Date.now();
  
  // Clean old entries
  for (let i = recentMessages.length - 1; i >= 0; i--) {
    if (now - recentMessages[i].timestamp > DEDUP_WINDOW) {
      recentMessages.splice(i, 1);
    }
  }
  
  // Check if text exists in recent messages
  const exists = recentMessages.some(m => m.text === text);
  
  if (!exists) {
    recentMessages.push({ text, timestamp: now });
  }
  
  return exists;
}

function monitorChatMessages() {
  // Watch for new message additions to the chat
  const chatContainer = document.querySelector('[data-testid="chatgpt-conversation"]') || 
                        document.querySelector('main') ||
                        document.body;
  
  if (!chatContainer) {
    console.log('⚠️ Chat container not found, retrying in 2 seconds...');
    setTimeout(monitorChatMessages, 2000);
    return;
  }

  console.log('✅ Chat container found, setting up mutation observer');

  const observer = new MutationObserver((mutations) => {
    try {
      mutations.forEach((mutation) => {
        // Look for added nodes (new messages)
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return; // Skip non-element nodes

          try {
            // Look for user message elements
            const messageElements = [];
            
            // Check if this is a user message
            if (node.getAttribute && node.getAttribute('data-message-author-role') === 'user') {
              messageElements.push(node);
            }
            
            // Look deeper for user messages
            if (node.querySelectorAll) {
              try {
                node.querySelectorAll('[data-message-author-role="user"]').forEach(el => {
                  if (!messageElements.includes(el)) {
                    messageElements.push(el);
                  }
                });
              } catch (e) {
                // Ignore query errors
              }
            }

            messageElements.forEach((msgElement) => {
              // Skip if we've already processed this exact element object
              if (processedElements.has(msgElement)) {
                return;
              }
              
              const text = extractUserMessage(msgElement);
              
              if (!text || text.length === 0) {
                return;
              }
              
              // Check if it's a duplicate by text content
              if (isDuplicate(text)) {
                console.log(`⏭️ Duplicate message (seen recently): "${text.substring(0, 40)}..."`);
                return;
              }
              
              // Mark this element object as processed
              processedElements.add(msgElement);
              
              console.log(`✅ NEW MESSAGE: "${text.substring(0, 60)}..." (${text.length} chars)`);
              recordEvent({
                eventType: 'message_sent',
                messageCharCount: text.length,
                estimatedTokens: Math.ceil(text.length / 4),
              }, text);
            });
          } catch (err) {
            console.error('Error processing node:', err);
          }
        });
      });
    } catch (err) {
      console.error('Error in mutation observer:', err);
    }
  });

  // Start observing
  observer.observe(chatContainer, {
    childList: true,
    subtree: true,  // Back to subtree: true to catch all messages
    attributes: false,
    characterData: false,
  });

  console.log('🔍 Mutation observer active - monitoring for new messages');
}

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

console.log('✅ Message tracker ready (DOM mutation observer + auth listener)');

// Start monitoring for messages
monitorChatMessages();

// Test function for manual debugging
window.testTracker = function(msg = 'Test message: Hello ChatGPT!') {
  console.log('🧪 TEST: Manually recording test event');
  recordEvent({
    eventType: 'message_sent',
    messageCharCount: msg.length,
    estimatedTokens: Math.ceil(msg.length / 4),
  }, msg);
};

// Diagnostic function to inspect DOM structure
window.diagnoseDOM = function() {
  console.log('🔍 ========== ChatGPT DOM DIAGNOSIS ==========');
  
  console.log('\n📍 Looking for conversation container:');
  const convContainer = document.querySelector('[data-testid="chatgpt-conversation"]');
  console.log('  [data-testid="chatgpt-conversation"]:', convContainer ? '✅ FOUND' : '❌ NOT FOUND');
  
  const mainEl = document.querySelector('main');
  console.log('  main:', mainEl ? '✅ FOUND' : '❌ NOT FOUND');
  
  console.log('\n📍 Looking for message elements:');
  const userMsgs = document.querySelectorAll('[data-message-author-role="user"]');
  console.log('  [data-message-author-role="user"]:', userMsgs.length, 'found');
  
  const allMsgIds = document.querySelectorAll('[data-message-id]');
  console.log('  [data-message-id]:', allMsgIds.length, 'found');
  
  const assistantMsgs = document.querySelectorAll('[data-message-author-role="assistant"]');
  console.log('  [data-message-author-role="assistant"]:', assistantMsgs.length, 'found');
  
  console.log('\n📍 Alternative selectors:');
  console.log('  [role="presentation"]:', document.querySelectorAll('[role="presentation"]').length, 'found');
  console.log('  [data-testid*="message"]:', document.querySelectorAll('[data-testid*="message"]').length, 'found');
  console.log('  article:', document.querySelectorAll('article').length, 'found');
  
  if (userMsgs.length > 0) {
    console.log('\n✅ Sample user message element:');
    const sample = userMsgs[0];
    console.log('  Class:', sample.className);
    console.log('  Data attributes:', Array.from(sample.attributes).filter(a => a.name.startsWith('data-')).map(a => a.name).join(', '));
    console.log('  Text content preview:', sample.textContent.substring(0, 100));
  }
  
  console.log('\n========== END DIAGNOSIS ==========');
};
