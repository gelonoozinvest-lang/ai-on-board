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

// --- Views (unchanged) ---
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
        <h1>Page Not Found</h1>
        <p>Sorry, we couldn't find the page you're looking for.</p>
        <p>You can return to the main page or connect with us on LinkedIn.</p>
        <a href="https://www.linkedin.com/company/u-cloud24/" target="_blank" rel="noopener noreferrer">Visit our LinkedIn Page</a>
    `
};

// --- PKCE Helper Functions ---
function generateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let text = '';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

async function generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

// --- Auth Logic (Authorization Code with PKCE) ---
async function handleLogin() {
    const codeVerifier = generateRandomString(64);
    localStorage.setItem('code_verifier', codeVerifier);

    const codeChallenge = await generateCodeChallenge(codeVerifier);

    const redirectUri = window.location.origin + window.location.pathname;
    const authUrl = `${ZITADEL_ISSUER}/oauth/v2/authorize?` +
        `client_id=${ZITADEL_CLIENT_ID}` +
        `&response_type=code` + // <-- The correct response_type
        `&scope=openid+email+profile` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&code_challenge=${codeChallenge}` +
        `&code_challenge_method=S256`;

    window.location.href = authUrl;
}

function handleLogout() {
    const redirectUri = window.location.origin + window.location.pathname;
    const logoutUrl = `${ZITADEL_ISSUER}/oidc/v1/end_session?` +
        `id_token_hint=${authState.idToken}` +
        `&post_logout_redirect_uri=${encodeURIComponent(redirectUri)}`;

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
    if (!codeVerifier) {
        console.error('Code verifier not found in storage.');
        return;
    }

    const redirectUri = window.location.origin + window.location.pathname;
    const tokenUrl = `${ZITADEL_ISSUER}/oauth/v2/token`;

    try {
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: redirectUri,
                client_id: ZITADEL_CLIENT_ID,
                code_verifier: codeVerifier
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error_description || 'Failed to fetch token');
        }

        const tokens = await response.json();

        authState = {
            isAuthenticated: true,
            accessToken: tokens.access_token,
            idToken: tokens.id_token,
            userInfo: parseJwt(tokens.id_token)
        };

        localStorage.setItem('authState', JSON.stringify(authState));
        localStorage.removeItem('code_verifier'); // Clean up verifier

        // Clean the URL
        window.history.replaceState({}, document.title, window.location.pathname);

    } catch (error) {
        console.error('Error exchanging code for token:', error);
        // Clean up URL and state
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
    } else {
        authButton.textContent = 'Login';
        authButton.onclick = handleLogin;
    }
}

function parseJwt(token) {
    try {
        return JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
        return null;
    }
}

// --- Router and other functions (unchanged) ---
function getSiteId() {
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    if (parts.length > 1 && parts[0] !== 'localhost' && parts[0] !== 'www') {
        return parts[0];
    }
    return "default_site";
}

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
    console.log('Simulating API call with:', { userId: authState.userInfo.sub, siteId: siteId, message: message });
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
    if (path === '/app/chat') {
        document.getElementById('send-button').addEventListener('click', handleSendMessage);
        document.getElementById('message-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSendMessage();
        });
    }
}

// --- App Initialization ---
async function init() {
    if (!ZITADEL_ISSUER || ZITADEL_ISSUER.includes('your-zitadel-issuer')) {
        appRoot.innerHTML = '<h1>Configuration Error</h1><p>Please configure Zitadel details in <code>frontend/config.js</code>.</p>';
        return;
    }

    // The order is important here!
    // 1. Check for auth code in URL and exchange it for tokens.
    await handleAuthCallback();

    // 2. Load any existing state from storage.
    loadAuthState();

    // 3. Render the UI based on the new state.
    router();
    updateUI();

    window.addEventListener('hashchange', router);
    console.log(`App initialized for site: "${siteId}"`);
}

init();
