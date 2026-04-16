// Popup script for extension UI

// Load status on popup open
document.addEventListener('DOMContentLoaded', () => {
  loadStatus();
  
  // Set up dashboard button listener
  const dashboardBtn = document.getElementById('dashboardBtn');
  if (dashboardBtn) {
    dashboardBtn.addEventListener('click', openDashboard);
  }
});

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
  const dashboardUrl = 'http://localhost:3000/dashboard';
  console.log('Opening dashboard:', dashboardUrl);
  
  chrome.tabs.create({ url: dashboardUrl }, (tab) => {
    if (chrome.runtime.lastError) {
      console.error('Error opening dashboard:', chrome.runtime.lastError);
      alert('Could not open dashboard. Make sure it\'s running at ' + dashboardUrl);
    } else {
      console.log('Dashboard opened in tab:', tab.id);
    }
  });
}

// Refresh stats every 2 seconds
setInterval(loadStatus, 2000);

// Also add listener if DOM is already loaded (shouldn't happen but just in case)
const dashboardBtn = document.getElementById('dashboardBtn');
if (dashboardBtn) {
  dashboardBtn.addEventListener('click', openDashboard);
}
