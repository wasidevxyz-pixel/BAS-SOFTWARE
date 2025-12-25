document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const alertBox = document.getElementById('alertBox');
        const submitBtn = document.querySelector('.btn-login');

        // Reset state
        alertBox.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Signing in...';

        console.log('Attempting login fetch to: /api/v1/auth/login');
        console.log('Data:', { email, password });

        try {
            const res = await fetch('/api/v1/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            console.log('Response Status:', res.status);

            const data = await res.json();
            console.log('Response Data:', data);

            if (res.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                window.location.href = '/main.html';
            } else {
                throw new Error(data.message || 'Login failed');
            }
        } catch (err) {
            console.error(err);
            alertBox.textContent = err.message;
            alertBox.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Sign In <i class="fas fa-arrow-right ms-2"></i>';
        }
    });

    // Handle Forgot Password
    const forgotPasswordLink = document.querySelector('.text-decoration-none');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            const alertBox = document.getElementById('alertBox');
            alertBox.className = 'alert alert-info';
            alertBox.textContent = 'Please contact system administrator to reset your password.';
            alertBox.style.display = 'block';
        });
    }
});
