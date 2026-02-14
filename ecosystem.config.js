module.exports = {
    apps: [{
        name: 'bas-software',
        script: 'server.js',
        cwd: './Backend',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        env: {
            NODE_ENV: 'production',
            PORT: 3000
        }
    }]
};
