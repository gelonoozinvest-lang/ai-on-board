// --- Configuration ---
const { ZITADEL_ISSUER, ZITADEL_CLIENT_ID } = window.APP_CONFIG;

// --- App State ---
let authState = {
    isAuthenticated: false,
    accessToken: null,
    idToken: null,
    userInfo: null,
};
const siteId = getSiteId();

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
        <p>Placeholder for user settings (e.g., notifications).</p>
    `,
    notFound: `
        <h1>404 - Page Not Found</h1>
        <p>The page you are looking for does not exist.</p>
    `
};

// --- Multi-Site Logic ---
function getSiteId() {
    // Determines site_id from the hostname (e.g., "site1.example.com" -> "site1").
    // To test locally, you can edit your hosts file (e.g., /etc/hosts on Linux/macOS or
    // C:\\Windows\\System32\\drivers\\etc\\hosts on Windows) to map hostnames to 127.0.0.1:
    // 127.0.0.1 site1.localhost
    // 127.0.0.1 site2.localhost
    const hostname = window.location.hostname;
    const parts = hostname.split('.');

    if (parts.length > 1 && parts[0] !== 'localhost' && parts[0] !== 'www') {
        return parts[0];
    }
    // Fallback for local development (e.g., http://localhost:8000)
    return "default_site";
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

    // This is where you would make an API call to the n8n backend.
    // The call would include the message, siteId, and the user's access token.
    console.log('Simulating API call with:', {
        userId: authState.userInfo.sub, // The unique user ID from the token
        siteId: siteId,
        message: message
    });

    // Simulate AI response
    showTypingIndicator();
    setTimeout(() => {
        hideTypingIndicator();
        addMessage('ai', `This is a simulated response to "${message}". The real AI is not connected yet.`);
    }, 1500);
}

function addMessage(role, text) {
    const messageList = document.getElementById('message-list');
    const p = document.createElement('p');
    p.innerHTML = `<em>${role}:</em> ${text}`;
    messageList.appendChild(p);
    messageList.scrollTop = messageList.scrollHeight;
}

function showTypingIndicator() {
    const messageList = document.getElementById('message-list');
    const typingP = document.createElement('p');
    typingP.id = 'typing-indicator';
    typingP.innerHTML = '<em>AI is typing...</em>';
    messageList.appendChild(typingP);
    messageList.scrollTop = messageList.scrollHeight;
}

function hideTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

// --- Auth Logic (OIDC) ---
function handleLogin() {
    const redirectUri = window.location.origin + window.location.pathname;
    const authUrl = `${ZITADEL_ISSUER}/oauth/v2/authorize?` +
        `client_id=${ZITADEL_CLIENT_ID}` +
        `&response_type=token+id_token` +
        `&scope=openid+email+profile` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.location.href = authUrl;
}

function handleLogout() {
    const redirectUri = window.location.origin + window.location.pathname;
    const logoutUrl = `${ZITADEL_ISSUER}/oidc/v1/end_session?` +
        `id_token_hint=${authState.idToken}` +
        `&post_logout_redirect_uri=${encodeURIComponent(redirectUri)}`;
    localStorage.removeItem('authState');
    authState = { isAuthenticated: false, accessToken: null, idToken: null, userInfo: null };
    window.location.href = logoutUrl;
}

function handleAuthCallback() {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = params.get('access_token');
    const idToken = params.get('id_token');
    if (accessToken && idToken) {
        authState = {
            isAuthenticated: true,
            accessToken,
            idToken,
            userInfo: parseJwt(idToken)
        };
        localStorage.setItem('authState', JSON.stringify(authState));
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

function loadAuthState() {
    const storedState = localStorage.getItem('authState');
    if (storedState) {
        authState = JSON.parse(storedState);
    }
}

function updateUI() {
    if (authState.isAuthenticated) {
        authButton.textContent = 'Logout';
        authButton.onclick = handleLogout;
        document.getElementById('message-input-container')?.classList.remove('disabled');
    } else {
        authButton.textContent = 'Login';
        authButton.onclick = handleLogin;
        document.getElementById('message-input-container')?.classList.add('disabled');
    }
}

function parseJwt(token) {
    try {
        return JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
        return null;
    }
}

// --- Router ---
function router() {
    const path = window.location.hash.slice(1) || '/app/chat';
    let viewHtml;

    if (path === '/app/chat') {
        viewHtml = views.chat;
    } else if (path === '/app/profile') {
        viewHtml = authState.isAuthenticated ? views.profile() : '<h1>Please log in to see your profile.</h1>';
    } else if (path === '/app/settings') {
        viewHtml = views.settings;
    } else {
        viewHtml = views.notFound;
    }
    appRoot.innerHTML = viewHtml;

    // Re-bind chat events if chat view is rendered
    if (path === '/app/chat') {
        document.getElementById('send-button').addEventListener('click', handleSendMessage);
        document.getElementById('message-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSendMessage();
        });
    }
}

// --- App Initialization ---
function init() {
    if (!ZITADEL_ISSUER || ZITADEL_ISSUER.includes('your-zitadel-issuer')) {
        appRoot.innerHTML = '<h1>Configuration Error</h1><p>Please configure Zitadel details in <code>frontend/config.js</code>.</p>';
        return;
    }
    loadAuthState();
    handleAuthCallback();
    router();
    updateUI();
    window.addEventListener('hashchange', router);
    console.log(`App initialized for site: "${siteId}"`);
}

init();
