// Popup script for extension UI
const API_BASE_URL = 'http://localhost:4000'

// Load status on popup open
document.addEventListener('DOMContentLoaded', () => {
  loadStatus()
  checkConnection()
  
  // Set up button listeners
  const dashboardBtn = document.getElementById('dashboardBtn')
  if (dashboardBtn) {
    dashboardBtn.addEventListener('click', openDashboard)
  }

  const settingsBtn = document.getElementById('settingsBtn')
  if (settingsBtn) {
    settingsBtn.addEventListener('click', openSettings)
  }
})

async function loadStatus() {
  try {
    // Check if authenticated first
    const authData = await chrome.storage.sync.get(['authToken', 'authenticatedUserId'])
    const isAuthenticated = !!authData.authToken && !!authData.authenticatedUserId

    // Update UI based on authentication status
    const authStatusEl = document.getElementById('authStatus')
    if (authStatusEl) {
      authStatusEl.textContent = isAuthenticated ? '✓ Authenticated' : '✗ Not signed in'
      authStatusEl.style.color = isAuthenticated ? '#0ea56a' : '#94a3b8'
    }

  } catch (e) {
    console.error('Failed to load status:', e)
  }
}

async function checkConnection() {
  try {
    // Check if backend is reachable with a timeout
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000) // 3 second timeout
    
    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        mode: 'cors',
        signal: controller.signal,
      })
      clearTimeout(timeout)
      var isBackendOk = response.ok
    } catch (fetchErr) {
      clearTimeout(timeout)
      // Timeout or CORS error - treat as backend unavailable
      console.warn('Health check failed:', fetchErr.message)
      var isBackendOk = false
    }

    // Check if authenticated
    const authData = await chrome.storage.sync.get(['authToken', 'authenticatedUserId'])
    const isAuthenticated = !!authData.authToken && !!authData.authenticatedUserId

    // Update connection status UI
    const statusElement = document.getElementById('connectionStatus')
    const textElement = document.getElementById('connectionText')

    if (isBackendOk && isAuthenticated) {
      statusElement.className = 'connection-status connected'
      textElement.textContent = ' Connected & Authenticated'
    } else if (isBackendOk) {
      statusElement.className = 'connection-status connected'
      textElement.textContent = ' Connected but not authenticated'
    } else {
      statusElement.className = 'connection-status disconnected'
      textElement.textContent = ' Backend not reachable'
    }

    console.log('Connection check:', {
      backendOk: isBackendOk,
      authenticated: isAuthenticated,
    })
  } catch (e) {
    console.error('Connection check failed:', e)
    const statusElement = document.getElementById('connectionStatus')
    const textElement = document.getElementById('connectionText')
    statusElement.className = 'connection-status disconnected'
    textElement.textContent = ' Backend not reachable'
  }
}

function openDashboard() {
  const dashboardUrl = 'http://localhost:3000/dashboard'
  console.log('Opening dashboard:', dashboardUrl)
  
  chrome.tabs.create({ url: dashboardUrl }, (tab) => {
    if (chrome.runtime.lastError) {
      console.error('Error opening dashboard:', chrome.runtime.lastError)
      alert('Could not open dashboard. Make sure it\'s running at ' + dashboardUrl)
    } else {
      console.log('Dashboard opened in tab:', tab.id)
    }
  })
}

function openSettings() {
  const settingsUrl = 'http://localhost:3000/settings'
  console.log('Opening settings:', settingsUrl)
  
  chrome.tabs.create({ url: settingsUrl }, (tab) => {
    if (chrome.runtime.lastError) {
      console.error('Error opening settings:', chrome.runtime.lastError)
      alert('Could not open settings. Make sure it\'s running at ' + settingsUrl)
    } else {
      console.log('Settings opened in tab:', tab.id)
    }
  })
}

// Refresh stats every 2 seconds
setInterval(() => {
  loadStatus()
}, 2000)

// Also add listener if DOM is already loaded (shouldn't happen but just in case)
const dashboardBtn = document.getElementById('dashboardBtn')
if (dashboardBtn) {
  dashboardBtn.addEventListener('click', openDashboard)
}

const settingsBtn = document.getElementById('settingsBtn')
if (settingsBtn) {
  settingsBtn.addEventListener('click', openSettings)
}
