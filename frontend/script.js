// DOM Elements
const userButton = document.getElementById('userButton');
const dropdownMenu = document.getElementById('dropdownMenu');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const logoutBtn = document.getElementById('logoutBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const usernameElement = document.getElementById('username');
const authContainer = document.getElementById('authContainer');
const closeAuthBtn = document.getElementById('closeAuthBtn');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showLoginFormLink = document.getElementById('showLoginForm');
const showRegisterFormLink = document.getElementById('showRegisterForm');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const chatMessages = document.getElementById('chatMessages');
const notification = document.getElementById('notification');
const adminPanelBtn = document.getElementById('adminPanelBtn');

// New Architecture Elements
const sidebar = document.getElementById('sidebar');
const chatContainer = document.getElementById('chatContainer');
const newChatBtn = document.getElementById('newChatBtn');
const historyList = document.getElementById('historyList');

// SPA Routing Elements
const navLinks = document.querySelectorAll('.nav-link, .nav-link-btn, .start-chat-nav');
const pageViews = document.querySelectorAll('.page-view');

// Theme Toggle Elements
const themeToggleBtn = document.getElementById('themeToggleBtn');
const themeIcon = themeToggleBtn.querySelector('i');

// Auth and App State
let isAuthenticated = false;
let currentUser = null;
let currentSessionId = null;

// Check if user is already logged in on page load
document.addEventListener('DOMContentLoaded', checkAuthStatus);

// Event Listeners
userButton.addEventListener('click', toggleDropdown);
loginBtn.addEventListener('click', showLoginDialog);
registerBtn.addEventListener('click', showRegisterDialog);
logoutBtn.addEventListener('click', handleLogout);
clearHistoryBtn.addEventListener('click', handleClearHistory);
closeAuthBtn.addEventListener('click', closeAuthDialog);
showLoginFormLink.addEventListener('click', switchToLoginForm);
showRegisterFormLink.addEventListener('click', switchToRegisterForm);
loginForm.addEventListener('submit', handleLogin);
registerForm.addEventListener('submit', handleRegister);
messageForm.addEventListener('submit', sendMessage);
newChatBtn.addEventListener('click', startNewChat);
themeToggleBtn.addEventListener('click', toggleTheme);

// Theme Managment
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  if (savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeIcon.classList.replace('fa-moon', 'fa-sun');
  } else {
    document.documentElement.removeAttribute('data-theme');
    themeIcon.classList.replace('fa-sun', 'fa-moon');
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  if (currentTheme === 'dark') {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('theme', 'light');
    themeIcon.classList.replace('fa-sun', 'fa-moon');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
    themeIcon.classList.replace('fa-moon', 'fa-sun');
  }
}

// Initialize Theme
initTheme();

// Handle SPA Navigation
navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const targetId = link.getAttribute('data-target');
    navigateTo(targetId);
  });
});

function navigateTo(targetId) {
  // If trying to access chat but not logged in, prompt login
  if (targetId === 'view-chat' && !isAuthenticated) {
    showNotification('Please login to use the chat', 'info');
    showLoginDialog();
    return;
  }

  // Update active nav link styling
  navLinks.forEach(nav => {
    if (nav.classList.contains('nav-link')) {
      nav.classList.remove('active');
      if (nav.getAttribute('data-target') === targetId) {
        nav.classList.add('active');
      }
    }
  });

  // Switch views
  pageViews.forEach(view => view.classList.remove('active'));
  document.getElementById(targetId).classList.add('active');

  // Handle specific view logic
  if (targetId === 'view-chat') {
    if (chatMessages.innerHTML.trim() === '') {
      renderWelcomeMessage();
    }
  }
}

if (adminPanelBtn) {
  adminPanelBtn.addEventListener('click', () => {
    window.location.href = '/admin.html';
  });
}

function updateAuthState(auth, user) {
  isAuthenticated = auth;
  currentUser = user;
  
  if (auth && user) {
    usernameElement.textContent = user.username;
    loginBtn.style.display = 'none';
    registerBtn.style.display = 'none';
    logoutBtn.style.display = 'block';
    clearHistoryBtn.style.display = 'block';
    sidebar.classList.remove('hidden');
    messageInput.disabled = false;
    sendButton.disabled = false;
    
    // Show admin panel button if user is admin
    if (adminPanelBtn) {
      adminPanelBtn.style.display = user.isAdmin ? 'block' : 'none';
    }

    loadSidebarSessions();
  } else {
    usernameElement.textContent = 'Guest';
    loginBtn.style.display = 'block';
    registerBtn.style.display = 'block';
    logoutBtn.style.display = 'none';
    clearHistoryBtn.style.display = 'none';
    sidebar.classList.add('hidden');
    messageInput.disabled = true;
    sendButton.disabled = true;
    showLandingView();
    
    if (adminPanelBtn) {
      adminPanelBtn.style.display = 'none';
    }
  }
}

// Adjust textarea height as user types and check word limit
messageInput.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = (this.scrollHeight) + 'px';
  
  // Reset to default height if empty
  if (this.value === '') {
    this.style.height = 'auto';
  }

  // Check word count
  const wordCount = this.value.trim().split(/\s+/).length;
  if (wordCount > 100) {
    const words = this.value.trim().split(/\s+/).slice(0, 100).join(' ');
    this.value = words;
    showNotification('Message limited to 100 words', 'warning');
  }
});

// Handle enter key press
messageInput.addEventListener('keydown', function(e) {
  // Check if Enter was pressed without Shift key
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault(); // Prevent default newline
    messageForm.dispatchEvent(new Event('submit')); // Trigger form submission
  }
});

// Check if user is logged in
async function checkAuthStatus() {
  try {
    const response = await fetch('/api/users/me', {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        updateAuthState(true, data.data);
      } else {
        updateAuthState(false, null);
      }
    } else {
      updateAuthState(false, null);
    }
  } catch (error) {
    console.error('Auth status check failed:', error);
    updateAuthState(false, null);
  }
}

/* UI view toggles */
function showLandingView() {
  navigateTo('view-home');
  currentSessionId = null;
  updateSidebarActiveItem();
}

function showChatView() {
  navigateTo('view-chat');
  if (chatMessages.innerHTML.trim() === '') {
    renderWelcomeMessage();
  }
}

function renderWelcomeMessage() {
  chatMessages.innerHTML = `
    <div class="message bot-message">
      <div class="message-content">
        <p>Hi there! I'm MindfulChat, your supportive mental health companion. How are you feeling today?</p>
      </div>
      <div class="message-time">Now</div>
    </div>
  `;
}

function startNewChat() {
  if (!isAuthenticated) {
    showLoginDialog();
    return;
  }
  currentSessionId = null;
  chatMessages.innerHTML = '';
  showChatView();
  updateSidebarActiveItem();
}

async function loadSidebarSessions() {
  if (!isAuthenticated) return;
  
  try {
    const response = await fetch('/api/chat/sessions', {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const sessions = await response.json();
    historyList.innerHTML = '';

    if (sessions && sessions.length > 0) {
      sessions.forEach(session => {
        const btn = document.createElement('button');
        btn.className = 'history-item';
        btn.textContent = session.firstMessage || 'New Chat';
        btn.dataset.id = session._id;
        
        if (currentSessionId === session._id) {
          btn.classList.add('active');
        }

        btn.addEventListener('click', () => loadHistoricalChat(session._id));
        historyList.appendChild(btn);
      });
    } else {
      historyList.innerHTML = '<span style="color:var(--text-secondary);font-size:0.875rem;padding:0 1rem;">No history found.</span>';
    }
  } catch (error) {
    console.error('Failed to load sessions:', error);
  }
}

function updateSidebarActiveItem() {
  document.querySelectorAll('.history-item').forEach(item => {
    if (item.dataset.id === currentSessionId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

async function loadHistoricalChat(sessionId) {
  if (!isAuthenticated) return;
  
  currentSessionId = sessionId;
  updateSidebarActiveItem();
  
  try {
    const response = await fetch(`/api/chat/history?sessionId=${sessionId}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const data = await response.json();
    
    chatMessages.innerHTML = '';
    
    if (data.length > 0) {
      showChatView();
      data.forEach(chat => {
        addMessageToChat(chat.message, 'user', formatTimestamp(chat.timestamp));
        addMessageToChat(chat.response, 'bot', formatTimestamp(chat.timestamp), chat.needs_immediate_help, chat.sentiment);
      });
      scrollToBottom();
    } else {
      renderWelcomeMessage();
    }
  } catch (error) {
    console.error('Failed to load historical chat:', error);
  }
}

// Toggle user dropdown menu
function toggleDropdown() {
  dropdownMenu.classList.toggle('active');
}

// Show login dialog
function showLoginDialog() {
  authContainer.classList.remove('hidden');
  loginForm.classList.remove('hidden');
  registerForm.classList.add('hidden');
  dropdownMenu.classList.remove('active');
}

// Show register dialog
function showRegisterDialog() {
  authContainer.classList.remove('hidden');
  registerForm.classList.remove('hidden');
  loginForm.classList.add('hidden');
  dropdownMenu.classList.remove('active');
}

// Close auth dialog
function closeAuthDialog() {
  authContainer.classList.add('hidden');
}

// Switch to login form
function switchToLoginForm(e) {
  e.preventDefault();
  loginForm.classList.remove('hidden');
  registerForm.classList.add('hidden');
}

// Switch to register form
function switchToRegisterForm(e) {
  e.preventDefault();
  registerForm.classList.remove('hidden');
  loginForm.classList.add('hidden');
}

// Handle login form submission
async function handleLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  
  if (!email || !password) {
    showNotification('Please fill in all fields', 'error');
    return;
  }
  
  try {
    const response = await fetch('/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (data.success) {
      localStorage.setItem('token', data.token);
      await checkAuthStatus();
      closeAuthDialog();
      showNotification('Login successful!', 'success');
      loginForm.reset();
    } else {
      showNotification(data.error || 'Login failed', 'error');
    }
  } catch (error) {
    console.error('Login error:', error);
    showNotification('Login failed. Please try again later.', 'error');
  }
}

// Handle register form submission
async function handleRegister(e) {
  e.preventDefault();
  
  const username = document.getElementById('registerUsername').value;
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  
  if (!username || !email || !password || !confirmPassword) {
    showNotification('Please fill in all fields', 'error');
    return;
  }
  
  if (password !== confirmPassword) {
    showNotification('Passwords do not match', 'error');
    return;
  }
  
  if (password.length < 6) {
    showNotification('Password must be at least 6 characters', 'error');
    return;
  }
  
  try {
    const response = await fetch('/api/users/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    
    const data = await response.json();
    
    if (data.success) {
      localStorage.setItem('token', data.token);
      await checkAuthStatus();
      closeAuthDialog();
      showNotification('Registration successful!', 'success');
      registerForm.reset();
    } else {
      showNotification(data.error || 'Registration failed', 'error');
    }
  } catch (error) {
    console.error('Registration error:', error);
    showNotification('Registration failed. Please try again later.', 'error');
  }
}

// Handle logout
async function handleLogout() {
  try {
    await fetch('/api/users/logout', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    
    localStorage.removeItem('token');
    updateAuthState(false, null);
    showNotification('Logged out successfully', 'success');
    dropdownMenu.classList.remove('active');
    
  } catch (error) {
    console.error('Logout error:', error);
    showNotification('Logout failed. Please try again later.', 'error');
  }
}

// Handle clearing chat history
async function handleClearHistory() {
  if (!isAuthenticated) return;
  
  const confirmClear = confirm('Are you sure you want to clear your chat history? This action cannot be undone.');
  if (!confirmClear) return;
  
  try {
    const response = await fetch('/api/chat/history', {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    
    const data = await response.json();
    
    if (data.success) {
      showNotification('Chat history cleared successfully', 'success');
      currentSessionId = null;
      loadSidebarSessions();
      showLandingView();
      dropdownMenu.classList.remove('active');
    } else {
      showNotification(data.error || 'Failed to clear chat history', 'error');
    }
  } catch (error) {
    console.error('Clear history error:', error);
    showNotification('Failed to clear chat history. Please try again later.', 'error');
  }
}

// Send message to chatbot
async function sendMessage(e) {
  e.preventDefault();
  if (!isAuthenticated) {
      showLoginDialog();
      return;
  }
  
  const message = messageInput.value.trim();
  const wordCount = message.split(/\s+/).filter(Boolean).length;
  if (wordCount > 100) {
    showNotification('Message cannot exceed 100 words.', 'warning');
    return;
  }
  
  if (!message) return;
  
  // Clear input and reset height
  messageInput.value = '';
  messageInput.style.height = 'auto';
  
  // Need to show Chat view if we were on landing or first message
  showChatView();
  
  // Add user message to chat
  addMessageToChat(message, 'user');
  
  // Show loading indicator in bot message
  const loadingMessageId = 'loading-message-' + Date.now();
  addLoadingMessage(loadingMessageId);
  scrollToBottom();
  
  try {
    const payload = { message };
    if (currentSessionId) payload.sessionId = currentSessionId;

    const response = await fetch('/api/chat/message', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}` 
      },
      body: JSON.stringify(payload)
    });

    if (response.status === 401) {
      showNotification('Session expired. Please log in again.', 'error');
      localStorage.removeItem('token');
      updateAuthState(false, null);
      return;
    }
    
    const data = await response.json();

    document.getElementById(loadingMessageId)?.remove();
    
    // update current session ID if it was just created
    let isNewSession = false;
    if (!currentSessionId && data.sessionId) {
      currentSessionId = data.sessionId;
      isNewSession = true;
    }

    addMessageToChat(
      data && data.response,
      'bot',
      formatTimestamp(data && data.timestamp),
      data && data.needs_immediate_help,
      data && data.sentiment
    );
    
    scrollToBottom();

    if (isNewSession) {
      loadSidebarSessions();
    }

  } catch (error) {
    console.error('Send message error:', error);
    document.getElementById(loadingMessageId)?.remove();
    addMessageToChat('I\'m sorry, I\'m having trouble connecting right now. Please check your connection.', 'bot');
    scrollToBottom();
  }
}

// Add message to chat
function addMessageToChat(message, sender, timestamp = 'Now', flagged = false, sentiment = null) {
  const messageElement = document.createElement('div');
  messageElement.className = `message ${sender}-message`;

  if (flagged) {
    messageElement.classList.add('urgent');
  }

  let sentimentClass = '';
  if (sentiment === 'anxiety' || sentiment === 'depression' || sentiment === 'stress') {
    sentimentClass = sentiment;
  }

  if (sentimentClass) {
    messageElement.classList.add(sentimentClass);
  }

  // Show fallback if message is undefined/null
  const safeMessage = (typeof message === 'string' && message.trim().length > 0)
    ? message
    : 'Sorry, I could not process your message.';

  messageElement.innerHTML = `
    <div class="message-content">
      <p>${formatMessage(safeMessage)}</p>
    </div>
    <div class="message-time">${timestamp}</div>
  `;

  chatMessages.appendChild(messageElement);
}

// Add loading message
function addLoadingMessage(id) {
  const loadingElement = document.createElement('div');
  loadingElement.className = 'message bot-message';
  loadingElement.id = id;
  
  loadingElement.innerHTML = `
    <div class="message-content">
      <p><span class="loading-indicator"></span> Thinking...</p>
    </div>
    <div class="message-time">Now</div>
  `;
  
  chatMessages.appendChild(loadingElement);
}

// Format message text (convert URLs to links, etc.)
function formatMessage(text) {
  if (typeof text !== 'string') return '';
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, url => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
}

// Format timestamp
function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  if (diffDay === 0 && date.getDate() === now.getDate()) {
    return timeStr;
  }
  
  return date.toLocaleDateString() + ' ' + timeStr;
}

// Scroll chat to bottom
function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Show notification
function showNotification(message, type = 'success') {
  notification.textContent = message;
  notification.className = `notification ${type}`;
  notification.classList.remove('hidden');
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-in forwards';
    setTimeout(() => {
      notification.classList.add('hidden');
      notification.style.animation = '';
    }, 300);
  }, 5000);
}

function getToken() {
  return localStorage.getItem('token');
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
  if (!userButton.contains(e.target) && !dropdownMenu.contains(e.target)) {
    dropdownMenu.classList.remove('active');
  }
});