const express = require('express');
const mongoose = require('mongoose');
const os = require('os');

const router = express.Router();

/**
 * GET /health
 * Health check básico — usado por load balancers y uptime monitors.
 * No requiere autenticación.
 */
router.get('/', (req, res) => {
    const dbState = mongoose.connection.readyState;
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    const dbStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] ?? 'unknown';
    const healthy = dbState === 1;

    res.status(healthy ? 200 : 503).json({
        status: healthy ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime_seconds: Math.floor(process.uptime()),
        environment: process.env.NODE_ENV || 'development',
        database: {
            status: dbStatus,
            name: mongoose.connection.name || null
        }
    });
});

/**
 * GET /health/detailed
 * Health check detallado — incluye métricas del sistema.
 * Útil para dashboards de operaciones y diagnóstico.
 */
router.get('/detailed', async (req, res) => {
    const dbState = mongoose.connection.readyState;
    const dbStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] ?? 'unknown';
    const healthy = dbState === 1;

    // Ping a MongoDB para medir latencia real
    let dbLatencyMs = null;
    let dbPingOk = false;
    try {
        const start = Date.now();
        await mongoose.connection.db.admin().ping();
        dbLatencyMs = Date.now() - start;
        dbPingOk = true;
    } catch {
        dbPingOk = false;
    }

    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    res.status(healthy ? 200 : 503).json({
        status: healthy && dbPingOk ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime_seconds: Math.floor(process.uptime()),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',

        database: {
            status: dbStatus,
            ping_ok: dbPingOk,
            latency_ms: dbLatencyMs,
            host: mongoose.connection.host || null,
            name: mongoose.connection.name || null
        },

        memory: {
            process_heap_used_mb: (memUsage.heapUsed / 1024 / 1024).toFixed(2),
            process_heap_total_mb: (memUsage.heapTotal / 1024 / 1024).toFixed(2),
            process_rss_mb: (memUsage.rss / 1024 / 1024).toFixed(2),
            system_total_mb: (totalMem / 1024 / 1024).toFixed(2),
            system_free_mb: (freeMem / 1024 / 1024).toFixed(2),
            system_used_pct: (((totalMem - freeMem) / totalMem) * 100).toFixed(1)
        },

        system: {
            platform: process.platform,
            node_version: process.version,
            cpu_count: os.cpus().length,
            load_avg_1m: os.loadavg()[0].toFixed(2)
        }
    });
});

/**
 * GET /health/ready
 * Readiness probe — indica si la app está lista para recibir tráfico.
 * Útil para Kubernetes / Docker health checks.
 */
router.get('/ready', async (req, res) => {
    const dbState = mongoose.connection.readyState;
    const isReady = dbState === 1;

    if (isReady) {
        return res.status(200).json({ ready: true });
    }
    return res.status(503).json({ ready: false, reason: 'database_not_connected' });
});

module.exports = router;