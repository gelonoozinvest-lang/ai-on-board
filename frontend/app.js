// --- Configuration ---
const { ZITADEL_ISSUER, ZITADEL_CLIENT_ID, N8N_API_URL } = window.APP_CONFIG;

// --- App State ---
let authState = {
    isAuthenticated: false,
    accessToken: null,
    idToken: null,
    userInfo: null,
};
const siteId = getSiteId();
let userSettings = {
    theme: 'light',
    language: 'en'
};

// --- DOM Elements ---
const appRoot = document.getElementById('app-root');
const authButton = document.getElementById('authButton');

// --- Views ---
const views = {
    chat: `
        <h1>Chat for Site: ${siteId}</h1>
        <div class="chat-container">
            <div class="message-list" id="message-list">
                <p><em>AI:</em> Hello! How can I help you today?</p>
            </div>
            <div class="message-input" id="message-input-container">
                <input type="text" id="message-input" placeholder="Type your message...">
                <button id="send-button">Send</button>
            </div>
        </div>
    `,
    profile: () => `
        <h1>Profile</h1>
        <div>
            <p><strong>User ID (sub):</strong> ${authState.userInfo?.sub}</p>
            <p><strong>Name:</strong> ${authState.userInfo?.name || 'N/A'}</p>
            <p><strong>Email:</strong> ${authState.userInfo?.email || 'N/A'}</p>
            <pre style="background:#eee; padding:1rem; border-radius:5px; white-space:pre-wrap; word-break:break-all;">ID Token: ${authState.idToken ? JSON.stringify(parseJwt(authState.idToken), null, 2) : 'Not logged in'}</pre>
        </div>
    `,
    settings: `
        <h1>Settings</h1>
        <div class="settings-section">
            <h2>Appearance</h2>
            <div class="settings-row">
                <label for="theme-select">Theme</label>
                <select id="theme-select">
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                </select>
            </div>
        </div>
        <div class="settings-section">
            <h2>Language</h2>
            <div class="settings-row">
                <label for="language-select">Language</label>
                <select id="language-select">
                    <option value="en">English</option>
                    <option value="de">Deutsch</option>
                    <option value="ru">Русский</option>
                </select>
            </div>
        </div>
        <div class="settings-section">
            <h2>Data Management</h2>
            <div class="settings-row">
                <label>Clear Chat History</label>
                <button id="clear-history-btn" class="btn-danger">Clear</button>
            </div>
        </div>
    `,
    notFound: `
        <h1>Page Not Found</h1>
        <p>Sorry, we couldn't find the page you're looking for.</p>
        <p>You can return to the main page or connect with us on LinkedIn.</p>
        <a href="https://www.linkedin.com/company/u-cloud24/" target="_blank" rel="noopener noreferrer">Visit our LinkedIn Page</a>
    `
};

// --- Settings Logic ---
function applySettings() {
    // Apply theme
    document.body.classList.toggle('dark-mode', userSettings.theme === 'dark');

    // Update form elements on settings page if it's visible
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) themeSelect.value = userSettings.theme;

    const langSelect = document.getElementById('language-select');
    if (langSelect) langSelect.value = userSettings.language;
}

function loadSettings() {
    const storedSettings = localStorage.getItem('userSettings');
    if (storedSettings) {
        userSettings = JSON.parse(storedSettings);
    }
    applySettings();
}

function saveSettings() {
    localStorage.setItem('userSettings', JSON.stringify(userSettings));
    applySettings();
}

function handleThemeChange(event) {
    userSettings.theme = event.target.value;
    saveSettings();
}

function handleLanguageChange(event) {
    userSettings.language = event.target.value;
    saveSettings();
    // Here you might want to re-render parts of the UI with the new language
    alert(`Language changed to ${userSettings.language}. UI refresh would be needed.`);
}

function handleClearHistory() {
    if (confirm("Are you sure you want to delete your entire chat history? This action cannot be undone.")) {
        // In a real app, this would make an API call to the backend to delete records.
        // For now, we'll just clear the visual chat list.
        const messageList = document.getElementById('message-list');
        if (messageList) {
            messageList.innerHTML = '<p><em>AI:</em> Chat history cleared. How can I help you?</p>';
        }
        alert("Chat history cleared.");
    }
}

// --- Chat Logic ---
function handleSendMessage() {
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    if (!message) return;
    if (!authState.isAuthenticated) {
        alert('Please log in to start chatting.');
        return;
    }
    addMessage('user', message);
    input.value = '';
    showTypingIndicator();
    fetch(N8N_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authState.accessToken}`
        },
        body: JSON.stringify({ message: message, site_id: siteId, language: userSettings.language })
    })
    .then(response => {
        hideTypingIndicator();
        if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
        return response.json();
    })
    .then(data => {
        if (data && data.reply) addMessage('ai', data.reply);
        else throw new Error("Invalid response format from server.");
    })
    .catch(error => {
        hideTypingIndicator();
        console.error('There was a problem with the fetch operation:', error);
        addMessage('ai', `Sorry, I encountered an error: ${error.message}. Please try again later.`);
    });
}

// --- Helper functions (unchanged) ---
function addMessage(role, text) {
    const messageList = document.getElementById('message-list');
    const p = document.createElement('p');
    p.innerHTML = `<em>${role}:</em> ${text}`;
    messageList.appendChild(p);
    messageList.scrollTop = messageList.scrollHeight;
}
function showTypingIndicator() {
    const messageList = document.getElementById('message-list');
    if (document.getElementById('typing-indicator')) return;
    const typingP = document.createElement('p');
    typingP.id = 'typing-indicator';
    typingP.innerHTML = '<em>AI is typing...</em>';
    messageList.appendChild(typingP);
    messageList.scrollTop = messageList.scrollHeight;
}
function hideTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
}

// --- Auth Logic (PKCE - unchanged) ---
async function handleLogin() {
    const codeVerifier = generateRandomString(64);
    localStorage.setItem('code_verifier', codeVerifier);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const redirectUri = window.location.origin + window.location.pathname;
    const authUrl = `${ZITADEL_ISSUER}/oauth/v2/authorize?client_id=${ZITADEL_CLIENT_ID}&response_type=code&scope=openid+email+profile&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
    window.location.href = authUrl;
}
function handleLogout() {
    const redirectUri = window.location.origin + window.location.pathname;
    const logoutUrl = `${ZITADEL_ISSUER}/oidc/v1/end_session?id_token_hint=${authState.idToken}&post_logout_redirect_uri=${encodeURIComponent(redirectUri)}`;
    localStorage.removeItem('authState');
    localStorage.removeItem('code_verifier');
    authState = { isAuthenticated: false, accessToken: null, idToken: null, userInfo: null };
    window.location.href = logoutUrl;
}
async function handleAuthCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;
    const codeVerifier = localStorage.getItem('code_verifier');
    if (!codeVerifier) { console.error('Code verifier not found.'); return; }
    const redirectUri = window.location.origin + window.location.pathname;
    const tokenUrl = `${ZITADEL_ISSUER}/oauth/v2/token`;
    try {
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ grant_type: 'authorization_code', code: code, redirect_uri: redirectUri, client_id: ZITADEL_CLIENT_ID, code_verifier: codeVerifier })
        });
        if (!response.ok) { const error = await response.json(); throw new Error(error.error_description || 'Failed to fetch token'); }
        const tokens = await response.json();
        authState = { isAuthenticated: true, accessToken: tokens.access_token, idToken: tokens.id_token, userInfo: parseJwt(tokens.id_token) };
        localStorage.setItem('authState', JSON.stringify(authState));
        localStorage.removeItem('code_verifier');
        window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error) {
        console.error('Error exchanging code for token:', error);
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}
function loadAuthState() {
    const storedState = localStorage.getItem('authState');
    if (storedState) authState = JSON.parse(storedState);
}
function updateUI() {
    if (authState.isAuthenticated) {
        authButton.textContent = 'Logout';
        authButton.onclick = handleLogout;
    } else {
        authButton.textContent = 'Login';
        authButton.onclick = handleLogin;
    }
}
function parseJwt(token) { try { return JSON.parse(atob(token.split('.')[1])); } catch (e) { return null; } }
async function generateCodeChallenge(v) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)); return btoa(String.fromCharCode(...new Uint8Array(d))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''); }
function generateRandomString(l) { const p = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; let t = ''; for (let i = 0; i < l; i++) { t += p.charAt(Math.floor(Math.random() * p.length)); } return t; }

// --- Router ---
function getSiteId() {
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    if (parts.length > 1 && parts[0] !== 'localhost' && parts[0] !== 'www') return parts[0];
    return "default_site";
}
function router() {
    const path = window.location.hash.slice(1) || '/app/chat';
    let viewHtml;
    if (path === '/app/chat') viewHtml = views.chat;
    else if (path === '/app/profile') viewHtml = authState.isAuthenticated ? views.profile() : '<h1>Please log in to see your profile.</h1>';
    else if (path === '/app/settings') viewHtml = views.settings;
    else viewHtml = views.notFound;
    appRoot.innerHTML = viewHtml;

    // Re-bind events for the current view
    if (path === '/app/chat') {
        document.getElementById('send-button').addEventListener('click', handleSendMessage);
        document.getElementById('message-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSendMessage(); });
    } else if (path === '/app/settings') {
        document.getElementById('theme-select').addEventListener('change', handleThemeChange);
        document.getElementById('language-select').addEventListener('change', handleLanguageChange);
        document.getElementById('clear-history-btn').addEventListener('click', handleClearHistory);
        // Set initial values
        document.getElementById('theme-select').value = userSettings.theme;
        document.getElementById('language-select').value = userSettings.language;
    }
}

// --- App Initialization ---
async function init() {
    if (!ZITADEL_ISSUER || ZITADEL_ISSUER.includes('your-zitadel-issuer')) {
        appRoot.innerHTML = '<h1>Configuration Error</h1><p>Please configure Zitadel and N8N details in <code>frontend/config.js</code>.</p>';
        return;
    }
    loadSettings();
    await handleAuthCallback();
    loadAuthState();
    router();
    updateUI();
    window.addEventListener('hashchange', router);
    console.log(`App initialized for site: "${siteId}"`);
}

init();
