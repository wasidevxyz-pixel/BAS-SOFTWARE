// Connection Monitor - Detects when server is down
(function () {
    let checkInterval;
    let failedAttempts = 0;
    const MAX_FAILED_ATTEMPTS = 3;
    const CHECK_INTERVAL = 5000; // Check every 5 seconds

    function checkServerConnection() {
        fetch('/api/v1/health', {
            method: 'GET',
            cache: 'no-cache'
        })
            .then(response => {
                if (response.ok) {
                    failedAttempts = 0;
                } else {
                    handleConnectionLost();
                }
            })
            .catch(() => {
                handleConnectionLost();
            });
    }

    function handleConnectionLost() {
        failedAttempts++;

        if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
            // Server is down - show message and close/redirect
            clearInterval(checkInterval);

            // Create overlay
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.9);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 99999;
                color: white;
                font-family: Arial, sans-serif;
            `;

            overlay.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 64px; color: #ff6b6b; margin-bottom: 20px;"></i>
                    <h2 style="margin-bottom: 20px;">Server Connection Lost</h2>
                    <p style="margin-bottom: 30px; color: #ccc;">The server has been stopped or is not responding.</p>
                    <button onclick="window.close()" style="
                        background: #667eea;
                        color: white;
                        border: none;
                        padding: 12px 30px;
                        border-radius: 6px;
                        font-size: 16px;
                        cursor: pointer;
                        margin-right: 10px;
                    ">Close Window</button>
                    <button onclick="location.reload()" style="
                        background: #51cf66;
                        color: white;
                        border: none;
                        padding: 12px 30px;
                        border-radius: 6px;
                        font-size: 16px;
                        cursor: pointer;
                    ">Retry Connection</button>
                </div>
            `;

            document.body.appendChild(overlay);

            // Try to close the window (may not work in all browsers)
            setTimeout(() => {
                window.close();
            }, 10000); // Auto-close after 10 seconds if possible
        }
    }

    // Start monitoring when page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            checkInterval = setInterval(checkServerConnection, CHECK_INTERVAL);
        });
    } else {
        checkInterval = setInterval(checkServerConnection, CHECK_INTERVAL);
    }
})();
