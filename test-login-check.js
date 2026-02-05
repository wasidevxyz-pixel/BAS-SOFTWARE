const http = require('http');

// Try with username/email as provided
const data = JSON.stringify({
    email: 'optics g15',
    password: '12345'
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        try {
            const json = JSON.parse(body);
            if (json.success === false) {
                console.log('Login Failed:', json.message || json.error);
            } else if (json.user && json.user.rights) {
                console.log('User Role:', json.user.role);
                console.log('User Group:', json.user.group ? json.user.group.name : 'No Group');
                console.log('Rights for [reports]:', json.user.rights['reports']);
                console.log('Rights for [sales_reports]:', json.user.rights['sales_reports']);
                console.log('Rights for [cash_counter_rpt_link]:', json.user.rights['cash_counter_rpt_link']);
                console.log('Total Rights Count:', Object.keys(json.user.rights).length);
            } else {
                console.log('Unexpected Response:', body);
            }
        } catch (e) {
            console.log('Error parsing response:', body);
        }
    });
});

req.on('error', (error) => {
    console.error('Request Error:', error);
});

req.write(data);
req.end();
