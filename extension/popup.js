// Popup script for extension UI

// Load status on popup open
document.addEventListener('DOMContentLoaded', loadStatus);

async function loadStatus() {
  try {
    // Get tracking stats
    const data = await chrome.storage.local.get(['lastEvent', 'eventCount']);
    
    const lastEvent = data.lastEvent;
    const eventCount = data.eventCount || 0;

    // Update UI
    document.getElementById('eventCount').textContent = eventCount;
    document.getElementById('lastEvent').textContent = 
      lastEvent 
        ? new Date(lastEvent).toLocaleTimeString() 
        : '—';

  } catch (e) {
    console.error('Failed to load status:', e);
  }
}

function openDashboard() {
  chrome.tabs.create({ url: 'http://localhost:3000' }, (tab) => {
    if (chrome.runtime.lastError) {
      console.error('Error opening dashboard:', chrome.runtime.lastError);
      alert('Could not open dashboard. Make sure the frontend is running at http://localhost:3000');
    } else {
      console.log('Dashboard opened in tab:', tab.id);
    }
  });
}

// Refresh stats every 2 seconds
setInterval(loadStatus, 2000);
