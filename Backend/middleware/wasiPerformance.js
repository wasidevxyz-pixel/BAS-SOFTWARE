const compression = require('compression');
const mongoose = require('mongoose');

// Function 1: Performance Booster (Compression + Headers)
const wasiPerformanceBooster = (app) => {
    // Enable GZIP compression if not already enabled, usually good to ensure it's here.
    // If server.js already has it, we can remove it there and use this.
    app.use(compression());

    console.log('[WASI MODULE] Performance Booster Activated (Compression Enabled)');
};

// Function 2: API Health Monitor (Logs 5xx errors)
const wasiApiHealthMonitor = (req, res, next) => {
    const start = Date.now();

    // Intercept response finish to log status
    res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;

        // Log Errors (5xx)
        if (status >= 500) {
            console.error(`[WASI HEALTH LOG] 🔴 API DOWN/ERROR: ${req.method} ${req.originalUrl} | Status: ${status} | Time: ${duration}ms`);
        }

        // Log Slow Requests (> 2s)
        if (duration > 2000) {
            console.warn(`[WASI PERF LOG] ⚠️ Slow Response: ${req.method} ${req.originalUrl} | Time: ${duration}ms`);
        }
    });

    next();
};

// Function 3: System Health Check Endpoint Handler
const wasiSystemHealthCheck = async (req, res) => {
    try {
        const dbState = mongoose.connection.readyState;
        const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

        const healthStatus = {
            module: 'WASI_PERFORMANCE_MODULE',
            status: 'Operational',
            timestamp: new Date().toISOString(),
            uptime: process.uptime().toFixed(2) + 's',
            database: {
                status: states[dbState] || 'unknown'
            },
            memory: process.memoryUsage()
        };

        if (dbState !== 1) {
            console.error('[WASI HEALTH LOG] 🔴 Database is Disconnected!');
            return res.status(503).json({ ...healthStatus, status: 'Database Down' });
        }

        return res.status(200).json(healthStatus);
    } catch (error) {
        console.error('[WASI HEALTH LOG] Health Check Failed:', error);
        return res.status(500).json({ status: 'Error', message: error.message });
    }
};

module.exports = {
    wasiPerformanceBooster,
    wasiApiHealthMonitor,
    wasiSystemHealthCheck
};
