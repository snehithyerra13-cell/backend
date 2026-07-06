// State Management
let jwtToken = localStorage.getItem('token') || null;
let userEmail = localStorage.getItem('email') || null;
let currentLinks = [];
let activeLinkId = null;

// Chart Instances
let timeChart = null;
let deviceBrowserChart = null;

// DOM Elements
const authStatusContainer = document.getElementById('auth-status-container');
const shortenForm = document.getElementById('shorten-form');
const originalUrlInput = document.getElementById('original-url');
const customAliasInput = document.getElementById('custom-alias');
const expiresAtInput = document.getElementById('expires-at');
const resultBox = document.getElementById('result-box');
const shortenedUrlInput = document.getElementById('shortened-url');
const resultExpiry = document.getElementById('result-expiry');
const copyBtn = document.getElementById('copy-btn');

// Dashboard Elements
const unauthorizedMessage = document.getElementById('unauthorized-message');
const authorizedDashboard = document.getElementById('authorized-dashboard');
const linksTableBody = document.getElementById('links-table-body');
const refreshLinksBtn = document.getElementById('refresh-links-btn');

// Analytics Inspector Elements
const selectedCodeLabel = document.getElementById('selected-code-label');
const analyticsLoader = document.getElementById('analytics-loader');
const analyticsDataContainer = document.getElementById('analytics-data-container');
const metricTotalClicks = document.getElementById('metric-total-clicks');
const metricTtl = document.getElementById('metric-ttl');
const countryList = document.getElementById('country-list');
const referrerList = document.getElementById('referrer-list');

// Auth Modal Elements
const showAuthModalBtn = document.getElementById('show-auth-modal-btn');
const authModal = document.getElementById('auth-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const authForm = document.getElementById('auth-form');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const modalTitle = document.getElementById('modal-title');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authToggleBtn = document.getElementById('auth-toggle-btn');
const authToggleMsg = document.getElementById('auth-toggle-msg');

let isRegisterMode = false;

// --- Initialize Page ---
document.addEventListener('DOMContentLoaded', () => {
  updateUserUI();
  
  if (showAuthModalBtn) {
    showAuthModalBtn.addEventListener('click', openAuthModal);
  }
  
  closeModalBtn.addEventListener('click', closeAuthModal);
  authToggleBtn.addEventListener('click', toggleAuthMode);
  authForm.addEventListener('submit', handleAuthSubmit);
  shortenForm.addEventListener('submit', handleShortenSubmit);
  copyBtn.addEventListener('click', copyShortenedUrl);
  refreshLinksBtn.addEventListener('click', fetchUserLinks);
});

// --- Auth Handling ---
function updateUserUI() {
  if (jwtToken && userEmail) {
    // Authenticated State
    authStatusContainer.innerHTML = `
      <div class="user-pill">
        <span><i class="fa-solid fa-user-circle"></i> ${userEmail}</span>
        <button id="logout-btn" class="btn btn-secondary btn-sm"><i class="fa-solid fa-sign-out-alt"></i> Logout</button>
      </div>
    `;
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    
    unauthorizedMessage.classList.add('hidden');
    authorizedDashboard.classList.remove('hidden');
    refreshLinksBtn.classList.remove('hidden');
    
    fetchUserLinks();
  } else {
    // Unauthenticated State
    authStatusContainer.innerHTML = `
      <button id="show-auth-modal-btn" class="btn btn-secondary">
        <i class="fa-solid fa-user-lock"></i> Login / Register
      </button>
    `;
    document.getElementById('show-auth-modal-btn').addEventListener('click', openAuthModal);
    
    unauthorizedMessage.classList.remove('hidden');
    authorizedDashboard.classList.add('hidden');
    refreshLinksBtn.classList.add('hidden');
    
    // Clear local state
    currentLinks = [];
    activeLinkId = null;
    linksTableBody.innerHTML = '';
    resetAnalyticsInspector();
  }
}

function openAuthModal() {
  authModal.classList.remove('hidden');
  isRegisterMode = false;
  setAuthModalUI();
}

function closeAuthModal() {
  authModal.classList.add('hidden');
  authForm.reset();
}

function toggleAuthMode() {
  isRegisterMode = !isRegisterMode;
  setAuthModalUI();
}

function setAuthModalUI() {
  if (isRegisterMode) {
    modalTitle.textContent = 'Create Account';
    authSubmitBtn.textContent = 'Register & Start';
    authToggleMsg.textContent = 'Already have an account?';
    authToggleBtn.textContent = 'Log In';
  } else {
    modalTitle.textContent = 'Welcome Back';
    authSubmitBtn.textContent = 'Log In';
    authToggleMsg.textContent = "New to Shortify?";
    authToggleBtn.textContent = 'Create Account';
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = authEmail.value;
  const password = authPassword.value;
  const endpoint = isRegisterMode ? '/api/auth/register' : '/api/auth/login';

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      alert(data.error || 'Authentication failed');
      return;
    }

    // Save token and email
    jwtToken = data.token;
    userEmail = data.user.email;
    localStorage.setItem('token', jwtToken);
    localStorage.setItem('email', userEmail);
    
    closeAuthModal();
    updateUserUI();
  } catch (error) {
    console.error('Auth error:', error);
    alert('Failed to contact auth servers. Please try again.');
  }
}

function handleLogout() {
  jwtToken = null;
  userEmail = null;
  localStorage.removeItem('token');
  localStorage.removeItem('email');
  updateUserUI();
}

// --- Shortening Handling ---
async function handleShortenSubmit(e) {
  e.preventDefault();
  
  const originalUrl = originalUrlInput.value;
  const customAlias = customAliasInput.value || null;
  const expiresAt = expiresAtInput.value || null;

  const headers = { 'Content-Type': 'application/json' };
  if (jwtToken) {
    headers['Authorization'] = `Bearer ${jwtToken}`;
  }

  try {
    const response = await fetch('/api/url/shorten', {
      method: 'POST',
      headers,
      body: JSON.stringify({ originalUrl, customAlias, expiresAt })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || 'Failed to shorten URL');
      return;
    }

    // Display Result
    shortenedUrlInput.value = data.shortenedUrl;
    
    if (data.expiresAt) {
      const date = new Date(data.expiresAt).toLocaleString();
      resultExpiry.textContent = `Link expires on: ${date}`;
    } else {
      resultExpiry.textContent = 'Link is permanent (no expiration).';
    }

    resultBox.classList.remove('hidden');
    shortenForm.reset();

    // Reload links table if logged in
    if (jwtToken) {
      fetchUserLinks();
    }
  } catch (error) {
    console.error('Shorten error:', error);
    alert('Something went wrong. Please check connection.');
  }
}

function copyShortenedUrl() {
  shortenedUrlInput.select();
  shortenedUrlInput.setSelectionRange(0, 99999);
  navigator.clipboard.writeText(shortenedUrlInput.value);
  
  const originalText = copyBtn.innerHTML;
  copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
  copyBtn.classList.remove('btn-cyan');
  copyBtn.style.background = '#10b981';
  copyBtn.style.color = '#fff';

  setTimeout(() => {
    copyBtn.innerHTML = originalText;
    copyBtn.classList.add('btn-cyan');
    copyBtn.style.background = '';
    copyBtn.style.color = '';
  }, 2000);
}

// --- Dashboard Tables & Links ---
async function fetchUserLinks() {
  if (!jwtToken) return;

  try {
    const response = await fetch('/api/url/my-links', {
      headers: { 'Authorization': `Bearer ${jwtToken}` }
    });
    
    if (response.status === 401) {
      handleLogout();
      return;
    }

    const data = await response.json();
    currentLinks = data;
    renderLinksTable();
  } catch (error) {
    console.error('Fetch links error:', error);
  }
}

function renderLinksTable() {
  linksTableBody.innerHTML = '';
  
  if (currentLinks.length === 0) {
    linksTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center muted" style="padding: 2rem;">
          You haven't shortened any links yet.
        </td>
      </tr>
    `;
    return;
  }

  currentLinks.forEach(link => {
    const row = document.createElement('tr');
    if (activeLinkId === link.id) {
      row.className = 'active';
    }
    
    // Formatting Expiry
    let expiryStr = 'Permanent';
    if (link.expiresAt) {
      const expiryDate = new Date(link.expiresAt);
      if (expiryDate.getTime() <= Date.now()) {
        expiryStr = '<span class="badge badge-secondary">Expired</span>';
      } else {
        expiryStr = expiryDate.toLocaleDateString();
      }
    }

    // Shortened destination URL text limit
    const displayDest = link.originalUrl.length > 35 
      ? link.originalUrl.substring(0, 35) + '...' 
      : link.originalUrl;

    row.innerHTML = `
      <td><a href="/${link.shortCode}" target="_blank" class="text-cyan">${link.shortCode}</a></td>
      <td title="${link.originalUrl}">${displayDest}</td>
      <td><span class="badge badge-success">${link.clickCount} clicks</span></td>
      <td>${expiryStr}</td>
      <td>
        <button class="btn btn-secondary btn-sm delete-link-btn" data-id="${link.id}">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;

    // Row Click loads analytics
    row.addEventListener('click', (e) => {
      // Don't trigger if they click the actual delete button or link
      if (e.target.closest('.delete-link-btn') || e.target.closest('a')) {
        return;
      }
      selectLink(link.id);
    });

    linksTableBody.appendChild(row);
  });

  // Attach delete events
  document.querySelectorAll('.delete-link-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (confirm('Are you sure you want to delete this link and its analytics?')) {
        await deleteLink(id);
      }
    });
  });
}

async function deleteLink(id) {
  try {
    const response = await fetch(`/api/url/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${jwtToken}` }
    });

    if (!response.ok) {
      alert('Failed to delete link');
      return;
    }

    if (activeLinkId === id) {
      resetAnalyticsInspector();
    }
    
    fetchUserLinks();
  } catch (error) {
    console.error('Delete link error:', error);
  }
}

// --- Analytics Loading & Render ---
function selectLink(id) {
  activeLinkId = id;
  
  // Highlight active row
  const rows = linksTableBody.querySelectorAll('tr');
  const index = currentLinks.findIndex(l => l.id === id);
  
  rows.forEach((r, idx) => {
    if (idx === index) r.className = 'active';
    else r.className = '';
  });

  const link = currentLinks[index];
  selectedCodeLabel.textContent = `/${link.shortCode}`;
  
  loadAnalyticsData(id);
}

async function loadAnalyticsData(id) {
  analyticsLoader.classList.remove('hidden');
  analyticsDataContainer.classList.add('hidden');

  try {
    const response = await fetch(`/api/analytics/${id}`, {
      headers: { 'Authorization': `Bearer ${jwtToken}` }
    });

    if (!response.ok) {
      throw new Error('Failed to load analytics');
    }

    const data = await response.json();
    renderAnalytics(data);
  } catch (error) {
    console.error(error);
    alert('Error retrieving analytics.');
  } finally {
    analyticsLoader.classList.add('hidden');
  }
}

function renderAnalytics(data) {
  analyticsDataContainer.classList.remove('hidden');
  
  // Update Metrics
  metricTotalClicks.textContent = data.summary.totalClicks;
  
  if (data.url.expiresAt) {
    const expTime = new Date(data.url.expiresAt).getTime();
    const remaining = expTime - Date.now();
    if (remaining <= 0) {
      metricTtl.textContent = 'Expired';
    } else {
      const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
      const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      metricTtl.textContent = days > 0 ? `${days}d ${hours}h` : `${hours}h left`;
    }
  } else {
    metricTtl.textContent = 'Never';
  }

  // Populate Lists
  populateList(countryList, data.analytics.countries);
  populateList(referrerList, data.analytics.referrers);

  // Render Charts
  renderCharts(data.analytics);
}

function populateList(element, items) {
  element.innerHTML = '';
  if (items.length === 0) {
    element.innerHTML = '<li class="muted">No data recorded yet</li>';
    return;
  }
  
  // Sort descending by value
  const sorted = [...items].sort((a, b) => b.value - a.value);
  
  sorted.forEach(item => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${item.name}</span>
      <span class="val">${item.value}</span>
    `;
    element.appendChild(li);
  });
}

function renderCharts(analytics) {
  // --- 1. Line Chart: Clicks Over Time ---
  const timeCtx = document.getElementById('clicks-time-chart').getContext('2d');
  
  if (timeChart) timeChart.destroy();
  
  const timeLabels = analytics.clicksOverTime.map(c => c.date);
  const timeValues = analytics.clicksOverTime.map(c => c.count);

  timeChart = new Chart(timeCtx, {
    type: 'line',
    data: {
      labels: timeLabels.length > 0 ? timeLabels : ['No Data'],
      datasets: [{
        label: 'Redirect Clicks',
        data: timeValues.length > 0 ? timeValues : [0],
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        borderWidth: 2,
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af', font: { size: 10 } } },
        y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af', font: { size: 10 } }, beginAtZero: true }
      }
    }
  });

  // --- 2. Doughnut Chart: Devices & Browsers ---
  const deviceCtx = document.getElementById('device-browser-chart').getContext('2d');
  
  if (deviceBrowserChart) deviceBrowserChart.destroy();

  const deviceLabels = analytics.devices.map(d => d.name);
  const deviceValues = analytics.devices.map(d => d.value);

  deviceBrowserChart = new Chart(deviceCtx, {
    type: 'doughnut',
    data: {
      labels: deviceLabels.length > 0 ? deviceLabels : ['No Data'],
      datasets: [{
        data: deviceValues.length > 0 ? deviceValues : [1],
        backgroundColor: ['#ec4899', '#8b5cf6', '#06b6d4', '#eab308'],
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)'
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#9ca3af', font: { size: 10 } }
        }
      }
    }
  });
}

function resetAnalyticsInspector() {
  selectedCodeLabel.textContent = 'Select a link from the table to load analytics';
  analyticsDataContainer.classList.add('hidden');
  if (timeChart) timeChart.destroy();
  if (deviceBrowserChart) deviceBrowserChart.destroy();
}
