// Floating stats widget
console.log('🎨 WIDGET SCRIPT LOADED');

const WIDGET_STATE = {
  eventCount: 0,
  totalTokens: 0,
  lastEvent: null,
};

function createTrackerWidget() {
  if (document.getElementById('chatgpt-tracker-widget')) return;

  console.log('🏗️ Creating widget...');
  const widget = document.createElement('div');
  widget.id = 'chatgpt-tracker-widget';
  widget.innerHTML = `
    <div class="tracker-header">
      <div class="tracker-title">📊 Tracker</div>
      <button class="tracker-toggle">−</button>
    </div>
    <div class="tracker-stat">
      <span class="tracker-label">Messages</span>
      <span class="tracker-value" id="widget-msg-count">0</span>
    </div>
    <div class="tracker-stat">
      <span class="tracker-label">Tokens</span>
      <span class="tracker-value" id="widget-token-count">0</span>
    </div>
    <div class="tracker-stat">
      <span class="tracker-label">Last Activity</span>
      <span class="tracker-value" id="widget-last-time">—</span>
    </div>
    <div class="tracker-status recording">Recording on ChatGPT</div>
  `;

  document.body.appendChild(widget);
  console.log('✅ Widget created');
  
  // Add toggle button listener
  const toggleBtn = widget.querySelector('.tracker-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      widget.classList.toggle('minimized');
      toggleBtn.textContent = widget.classList.contains('minimized') ? '+' : '−';
    });
  }

  updateWidgetDisplay();
}

function updateWidgetDisplay() {
  const msgEl = document.getElementById('widget-msg-count');
  const tokenEl = document.getElementById('widget-token-count');
  const timeEl = document.getElementById('widget-last-time');
  
  if (!msgEl) {
    console.log('⚠️ Widget elements not found');
    return;
  }

  msgEl.textContent = WIDGET_STATE.eventCount;
  tokenEl.textContent = WIDGET_STATE.totalTokens;
  
  if (WIDGET_STATE.lastEvent) {
    const time = new Date(WIDGET_STATE.lastEvent);
    const now = new Date();
    const diff = Math.floor((now - time) / 1000);
    
    let timeStr = '';
    if (diff < 60) {
      timeStr = 'now';
    } else if (diff < 3600) {
      timeStr = Math.floor(diff / 60) + 'm ago';
    } else {
      timeStr = Math.floor(diff / 3600) + 'h ago';
    }
    
    timeEl.textContent = timeStr;
  }
}

// Listen for storage updates
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  
  if (event.data.type === 'STORAGE_UPDATE') {
    console.log('📡 Widget received storage update:', event.data.data);
    const changes = event.data.data;
    
    if (changes.eventCount) {
      WIDGET_STATE.eventCount = changes.eventCount.newValue || 0;
      console.log('📈 Event count updated:', WIDGET_STATE.eventCount);
    }
    if (changes.totalTokens) {
      WIDGET_STATE.totalTokens = changes.totalTokens.newValue || 0;
    }
    if (changes.lastEvent) {
      WIDGET_STATE.lastEvent = changes.lastEvent.newValue || null;
    }
    
    updateWidgetDisplay();
  }
});

// Create widget when page is ready
function initWidget() {
  if (document.body) {
    createTrackerWidget();
  } else {
    setTimeout(initWidget, 100);
  }
}

initWidget();
console.log('✅ Widget ready');
