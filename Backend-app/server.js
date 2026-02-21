// Backend-app/server.js
try { require('dotenv').config({ path: '../.env' }); } catch (e) { }
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.BACKEND_PORT || 4000;

// Track metrics
const metrics = {
    startTime: Date.now(),
    totalRequests: 0,
    apiRequests: 0,
    heavyRequests: 0,
    healthChecks: 0,
    pageViews: 0,
    errors: 0,
    avgResponseTime: 0,
    responseTimes: []
};

// Middleware: Track all requests
app.use((req, res, next) => {
    metrics.totalRequests++;
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        metrics.responseTimes.push(duration);
        if (metrics.responseTimes.length > 100) metrics.responseTimes.shift();
        metrics.avgResponseTime = Math.round(
            metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length
        );
    });
    next();
});

app.use(express.json());

// Serve static files
app.use('/public', express.static(path.join(__dirname, 'public')));

// --- MAIN PAGE ---
app.get('/', (req, res) => {
    metrics.pageViews++;
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- HEALTH ENDPOINT ---
app.get('/health', (req, res) => {
    metrics.healthChecks++;
    const uptime = process.uptime();
    res.json({
        status: 'operational',
        service: 'Backend API Server',
        version: '2.0.0',
        uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
        timestamp: new Date().toISOString(),
        memory: {
            used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
            total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
        }
    });
});

// --- HEAVY ENDPOINT ---
app.get('/heavy', (req, res) => {
    metrics.heavyRequests++;
    const start = Date.now();
    // Simulate a 300ms "database" task
    setTimeout(() => {
        const duration = Date.now() - start;
        res.json({
            status: 'success',
            task: 'Heavy Computation',
            duration: `${duration}ms`,
            result: 'Database query simulation completed',
            timestamp: new Date().toISOString()
        });
    }, 300);
});

// --- API DATA ENDPOINT ---
app.get('/api/data', (req, res) => {
    metrics.apiRequests++;
    res.json({
        status: 'success',
        data: {
            message: 'Sensitive API Information',
            records: Math.floor(Math.random() * 1000) + 100,
            region: 'us-east-1',
            tier: 'enterprise'
        },
        meta: {
            responseTime: `${Date.now() - parseInt(req.headers['x-request-start'] || Date.now())}ms`,
            rateLimit: { remaining: 100, limit: 1000 }
        },
        timestamp: new Date().toISOString()
    });
});

// --- METRICS ENDPOINT (for the dashboard) ---
app.get('/api/metrics', (req, res) => {
    const uptime = process.uptime();
    res.json({
        uptime: Math.floor(uptime),
        totalRequests: metrics.totalRequests,
        apiRequests: metrics.apiRequests,
        heavyRequests: metrics.heavyRequests,
        healthChecks: metrics.healthChecks,
        pageViews: metrics.pageViews,
        avgResponseTime: metrics.avgResponseTime,
        memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        timestamp: Date.now()
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Backend App is live at http://0.0.0.0:${PORT}`);
    console.log(`🌐 Interface: http://localhost:${PORT}`);
    console.log(`📊 Health:    http://localhost:${PORT}/health`);
    console.log(`⚡ Heavy:     http://localhost:${PORT}/heavy`);
    console.log(`🔌 API:       http://localhost:${PORT}/api/data`);
});