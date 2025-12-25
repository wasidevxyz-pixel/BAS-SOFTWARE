const express = require('express');
const router = express.Router();
const os = require('os');
const mongoose = require('mongoose');

// Helper function to format bytes
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Helper function to format uptime
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    let result = '';
    if (days > 0) result += `${days}d `;
    if (hours > 0) result += `${hours}h `;
    if (mins > 0) result += `${mins}m `;
    result += `${secs}s`;
    return result;
}

// Store server start time
const serverStartTime = Date.now();

// @desc    Comprehensive health check endpoint
// @route   GET /api/v1/health
// @access  Public
router.get('/', async (req, res) => {
    try {
        // System Memory
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const memoryUsagePercent = ((usedMemory / totalMemory) * 100).toFixed(1);

        // Process Memory (Node.js)
        const processMemory = process.memoryUsage();

        // CPU Info
        const cpus = os.cpus();
        const cpuModel = cpus[0]?.model || 'Unknown';
        const cpuCores = cpus.length;

        // Calculate CPU usage (average across all cores)
        let cpuUsage = 0;
        cpus.forEach(cpu => {
            const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
            const idle = cpu.times.idle;
            cpuUsage += ((total - idle) / total) * 100;
        });
        cpuUsage = (cpuUsage / cpuCores).toFixed(1);

        // Database Status
        const dbState = mongoose.connection.readyState;
        const dbStates = {
            0: 'Disconnected',
            1: 'Connected',
            2: 'Connecting',
            3: 'Disconnecting'
        };
        const dbStatus = dbStates[dbState] || 'Unknown';

        // Get database stats if connected
        let dbStats = null;
        if (dbState === 1) {
            try {
                const admin = mongoose.connection.db.admin();
                const serverStatus = await admin.serverStatus();
                dbStats = {
                    connections: serverStatus.connections?.current || 0,
                    opcounters: {
                        insert: serverStatus.opcounters?.insert || 0,
                        query: serverStatus.opcounters?.query || 0,
                        update: serverStatus.opcounters?.update || 0,
                        delete: serverStatus.opcounters?.delete || 0
                    },
                    uptime: formatUptime(serverStatus.uptime || 0)
                };
            } catch (e) {
                // MongoDB Atlas may not allow serverStatus
                dbStats = { connections: 'N/A', note: 'Stats unavailable on cloud DB' };
            }
        }

        // System Uptime
        const systemUptime = os.uptime();
        const processUptime = process.uptime();
        const serverUptime = (Date.now() - serverStartTime) / 1000;

        // Network Interfaces
        const networkInterfaces = os.networkInterfaces();
        const primaryNetwork = Object.values(networkInterfaces)
            .flat()
            .find(iface => iface && !iface.internal && iface.family === 'IPv4');

        // Health Status Calculation
        let healthScore = 100;
        let healthStatus = 'Healthy';
        let healthColor = '#27ae60'; // Green

        // Deduct points for issues
        if (parseFloat(memoryUsagePercent) > 90) {
            healthScore -= 30;
            healthStatus = 'Critical';
            healthColor = '#e74c3c';
        } else if (parseFloat(memoryUsagePercent) > 75) {
            healthScore -= 15;
            healthStatus = 'Warning';
            healthColor = '#f39c12';
        }

        if (dbState !== 1) {
            healthScore -= 40;
            healthStatus = 'Critical';
            healthColor = '#e74c3c';
        }

        if (parseFloat(cpuUsage) > 90) {
            healthScore -= 20;
            healthStatus = healthStatus === 'Healthy' ? 'Warning' : healthStatus;
            healthColor = healthColor === '#27ae60' ? '#f39c12' : healthColor;
        }

        res.status(200).json({
            success: true,
            timestamp: new Date().toISOString(),

            health: {
                score: Math.max(0, healthScore),
                status: healthStatus,
                color: healthColor
            },

            server: {
                platform: os.platform(),
                arch: os.arch(),
                hostname: os.hostname(),
                nodeVersion: process.version,
                environment: process.env.NODE_ENV || 'development',
                processId: process.pid,
                uptime: formatUptime(serverUptime),
                systemUptime: formatUptime(systemUptime)
            },

            memory: {
                system: {
                    total: formatBytes(totalMemory),
                    used: formatBytes(usedMemory),
                    free: formatBytes(freeMemory),
                    usagePercent: parseFloat(memoryUsagePercent)
                },
                process: {
                    heapTotal: formatBytes(processMemory.heapTotal),
                    heapUsed: formatBytes(processMemory.heapUsed),
                    external: formatBytes(processMemory.external),
                    rss: formatBytes(processMemory.rss)
                }
            },

            cpu: {
                model: cpuModel,
                cores: cpuCores,
                usagePercent: parseFloat(cpuUsage),
                loadAverage: os.loadavg().map(val => val.toFixed(2))
            },

            database: {
                status: dbStatus,
                type: 'MongoDB',
                host: mongoose.connection.host || 'N/A',
                name: mongoose.connection.name || 'N/A',
                stats: dbStats
            },

            network: {
                ip: primaryNetwork?.address || 'N/A',
                mac: primaryNetwork?.mac || 'N/A'
            }
        });
    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get health status',
            message: error.message
        });
    }
});

// @desc    Quick ping endpoint
// @route   GET /api/v1/health/ping
// @access  Public
router.get('/ping', (req, res) => {
    res.status(200).json({
        success: true,
        status: 'pong',
        timestamp: new Date().toISOString()
    });
});

// Rate limiting for cache clearing
let lastCacheClean = 0;
const CACHE_CLEAR_COOLDOWN = 30000; // 30 seconds cooldown

// @desc    Clear server cache
// @route   POST /api/v1/health/clear-cache
// @access  Admin only (should add auth middleware)
router.post('/clear-cache', async (req, res) => {
    try {
        const now = Date.now();
        const timeSinceLastClear = now - lastCacheClean;
        const remainingCooldown = Math.max(0, CACHE_CLEAR_COOLDOWN - timeSinceLastClear);

        // Check rate limit
        if (remainingCooldown > 0) {
            return res.status(429).json({
                success: false,
                error: 'Rate limit exceeded',
                message: `Please wait ${Math.ceil(remainingCooldown / 1000)} seconds before clearing cache again`,
                cooldownRemaining: remainingCooldown,
                nextClearAvailable: new Date(lastCacheClean + CACHE_CLEAR_COOLDOWN).toISOString()
            });
        }

        // Get memory before clearing
        const memoryBefore = process.memoryUsage();

        // Clear various caches
        const clearedItems = [];

        // 1. Clear require cache (be careful - only clear application modules)
        // This is usually not recommended in production

        // 2. Force garbage collection if available
        if (global.gc) {
            global.gc();
            clearedItems.push('Garbage collection triggered');
        } else {
            clearedItems.push('Garbage collection not exposed (run node with --expose-gc)');
        }

        // 3. Clear any application-level caches you may have
        // Add your custom cache clearing logic here

        // 4. Clear module caches (optional - use with caution)
        // Object.keys(require.cache).forEach(key => {
        //     if (!key.includes('node_modules')) {
        //         delete require.cache[key];
        //         clearedItems.push(`Cleared: ${key}`);
        //     }
        // });

        // Update last clear time
        lastCacheClean = now;

        // Get memory after clearing
        const memoryAfter = process.memoryUsage();

        // Calculate memory freed
        const memoryFreed = {
            heapUsed: formatBytes(memoryBefore.heapUsed - memoryAfter.heapUsed),
            heapTotal: formatBytes(memoryBefore.heapTotal - memoryAfter.heapTotal),
            rss: formatBytes(memoryBefore.rss - memoryAfter.rss),
            external: formatBytes(memoryBefore.external - memoryAfter.external)
        };

        res.status(200).json({
            success: true,
            message: 'Cache cleared successfully',
            timestamp: new Date().toISOString(),
            clearedItems: clearedItems,
            memoryBefore: {
                heapUsed: formatBytes(memoryBefore.heapUsed),
                heapTotal: formatBytes(memoryBefore.heapTotal),
                rss: formatBytes(memoryBefore.rss)
            },
            memoryAfter: {
                heapUsed: formatBytes(memoryAfter.heapUsed),
                heapTotal: formatBytes(memoryAfter.heapTotal),
                rss: formatBytes(memoryAfter.rss)
            },
            memoryFreed: memoryFreed,
            nextClearAvailable: new Date(now + CACHE_CLEAR_COOLDOWN).toISOString(),
            cooldownSeconds: CACHE_CLEAR_COOLDOWN / 1000
        });

    } catch (error) {
        console.error('Cache clear error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to clear cache',
            message: error.message
        });
    }
});

// @desc    Get cache status and cooldown info
// @route   GET /api/v1/health/cache-status
// @access  Public
router.get('/cache-status', (req, res) => {
    const now = Date.now();
    const timeSinceLastClear = now - lastCacheClean;
    const remainingCooldown = Math.max(0, CACHE_CLEAR_COOLDOWN - timeSinceLastClear);
    const canClear = remainingCooldown === 0;

    res.status(200).json({
        success: true,
        canClearCache: canClear,
        cooldownRemaining: remainingCooldown,
        cooldownRemainingSeconds: Math.ceil(remainingCooldown / 1000),
        lastClearedAt: lastCacheClean > 0 ? new Date(lastCacheClean).toISOString() : null,
        nextClearAvailable: lastCacheClean > 0 ? new Date(lastCacheClean + CACHE_CLEAR_COOLDOWN).toISOString() : 'Now',
        cooldownDuration: CACHE_CLEAR_COOLDOWN / 1000
    });
});

module.exports = router;
