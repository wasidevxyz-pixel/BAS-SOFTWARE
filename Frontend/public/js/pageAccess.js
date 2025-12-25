// Page Access Control - Must be included in all protected pages
document.addEventListener('DOMContentLoaded', function () {
    // Check authentication on page load
    checkAuthentication();

    // Set up periodic token validation
    setInterval(checkTokenValidity, 60000); // Check every minute
});

// Check if user is authenticated
function checkAuthentication() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    const path = window.location.pathname;

    // Check if we are on the login page
    if (path === '/' || path === '/login.html' || path.includes('login.html')) {
        // If already logged in, redirect to main page
        if (token && user) {
            window.location.href = '/main.html';
        }
        return true;
    }

    if (!token || !user) {
        redirectWithMessage('Please login to access this page');
        return false;
    }

    // Check if token is expired
    if (isTokenExpired()) {
        redirectWithMessage('Session expired. Please login again');
        return false;
    }

    return true;
}

// Check if token is expired
function isTokenExpired() {
    const token = localStorage.getItem('token');
    if (!token) return true;

    try {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        return decoded.exp < Date.now() / 1000;
    } catch (e) {
        return true;
    }
}

// Redirect to login with message
function redirectWithMessage(message) {
    // Store message to show on login page
    sessionStorage.setItem('loginMessage', message);

    // Clear expired tokens
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    // Redirect to login page
    window.location.href = '/login.html';
}

// Get current user
function getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}

// Get auth token for API calls
function getAuthToken() {
    return localStorage.getItem('token');
}

// Make authenticated API calls
async function authenticatedFetch(url, options = {}) {
    const token = getAuthToken();

    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };

    const finalOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };

    try {
        const response = await fetch(url, finalOptions);

        // Handle 401 Unauthorized
        if (response.status === 401) {
            redirectWithMessage('Session expired. Please login again');
            return null;
        }

        // Handle 403 Forbidden
        if (response.status === 403) {
            const errorData = await response.json();
            showError(errorData.msg || 'You are not authorized to perform this action');
            return null;
        }

        return response;
    } catch (error) {
        console.error('API call error:', error);
        showError('Network error. Please check your connection.');
        return null;
    }
}

// Check token validity periodically
function checkTokenValidity() {
    if (!checkAuthentication()) {
        return;
    }

    // Optional: Validate token with server
    validateTokenWithServer();
}

// Validate token with server
async function validateTokenWithServer() {
    try {
        const response = await authenticatedFetch('/api/v1/auth/me');
        if (!response) {
            return;
        }

        const userData = await response.json();

        // Update user data in localStorage if changed
        const currentUser = getCurrentUser();
        if (JSON.stringify(currentUser) !== JSON.stringify(userData)) {
            localStorage.setItem('user', JSON.stringify(userData));
        }
    } catch (error) {
        console.error('Token validation error:', error);
    }
}

// Show error message
function showError(message) {
    // Create or update error alert
    let alertContainer = document.getElementById('pageAlertContainer');

    if (!alertContainer) {
        alertContainer = document.createElement('div');
        alertContainer.id = 'pageAlertContainer';
        alertContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            max-width: 400px;
        `;
        document.body.appendChild(alertContainer);
    }

    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-danger alert-dismissible fade show';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    alertContainer.innerHTML = '';
    alertContainer.appendChild(alertDiv);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

// Show success message
function showSuccess(message) {
    let alertContainer = document.getElementById('pageAlertContainer');

    if (!alertContainer) {
        alertContainer = document.createElement('div');
        alertContainer.id = 'pageAlertContainer';
        alertContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            max-width: 400px;
        `;
        document.body.appendChild(alertContainer);
    }

    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-success alert-dismissible fade show';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    alertContainer.innerHTML = '';
    alertContainer.appendChild(alertDiv);

    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 3000);
}

// Show loading spinner
function showLoading() {
    let loader = document.getElementById('globalLoader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'globalLoader';
        loader.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.7);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
        `;
        loader.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>';
        document.body.appendChild(loader);
    }
    loader.style.display = 'flex';
}

// Hide loading spinner
function hideLoading() {
    const loader = document.getElementById('globalLoader');
    if (loader) {
        loader.style.display = 'none';
    }
}

// Export functions for global access
window.pageAccess = {
    checkAuthentication,
    getCurrentUser,
    getAuthToken,
    authenticatedFetch,
    showError,
    showSuccess,
    showLoading,
    hideLoading,
    logout: async function () {
        try {
            await fetch('/api/v1/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        } catch (error) {
            console.error('Logout error:', error);
        }

        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login.html';
    }
};

// Expose globally for convenience (as used in settings.js)
window.isAuthenticated = checkAuthentication;
window.getCurrentUser = getCurrentUser;
window.showError = showError;
window.showSuccess = showSuccess;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.logout = window.pageAccess.logout;
