// Shield-Proxy/index.js
// In Docker: env vars come from docker-compose. In local dev: load from .env if present.
try { require('dotenv').config(); } catch (e) { /* dotenv optional */ }
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { dosMitigator, clearJail, banUser, updateConfig, CONFIG } = require('./middleware/dosMitigator');
const { initRedis } = require('./lib/redisClient');
const cors = require('cors');
const path = require('path');

// Init Redis (non-blocking — server starts even if Redis is slow)
initRedis().catch(err => console.error('[Sentinel] Redis init warning:', err.message));

const http = require('http');
const socketIo = require('socket.io');

const app = express();
const crypto = require('crypto');

// 1. Serve Dashboard Files
const dashboardPath = path.join(__dirname, 'dashboard');
app.use('/sentinel', express.static(dashboardPath));

// Failsafe: Catch any /sentinel sub-routes and serve index.html (SPA logic)
app.get(['/sentinel', '/sentinel/*'], (req, res) => {
    const target = path.join(dashboardPath, 'index.html');
    res.sendFile(target, (err) => {
        if (err) {
            console.error(`🔴 [SENTINEL] Dashboard load failed: ${err.message}`);
            res.status(500).send("Security HUD Internal Error: Dashboard files missing in container.");
        }
    });
});

// Health Check API (Enterprise Requirement)
app.get('/health', (req, res) => {
    const { getRedisClient } = require('./lib/redisClient');
    const client = getRedisClient();
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        engine: 'Sentinel Shield v2.5',
        environment: process.env.NODE_ENV || 'production',
        redis: client?.isOpen ? 'connected' : 'disconnected',
        uptime: process.uptime()
    });
});

// 2. Admin Auth Middleware
const ADMIN_KEY = process.env.ADMIN_KEY || 'SENTINEL-ROOT';
const authMiddleware = (req, res, next) => {
    const key = req.headers['x-sentinel-auth'];
    if (key === ADMIN_KEY) return next();
    res.status(401).json({ status: 'error', message: 'UNAUTHORIZED ACCESS BLOCKED' });
};

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Priority: port in .env, then 8081, then fallback
const SHIELD_PORT = process.env.SHIELD_PORT || 8081;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

// Global io instance for middleware HUD updates
global.io = io;

io.on('connection', (socket) => {
    // console.log('📊 Dashboard connected');
    socket.on('manual-ban', async (data) => {
        if (data && data.fingerprint) {
            await banUser(data.fingerprint);
        }
    });
    socket.on('manual-unjail', async (data) => {
        if (data && data.fingerprint) {
            await clearJail(data.fingerprint);
        }
    });
});

console.log(`🛡️ Sentinel Shield starting...`);
console.log(`Forwarding requests from :${SHIELD_PORT} ➔ ${BACKEND_URL}`);

// App-level middleware
app.use(cors());
app.use(express.json());

// Administrative: Config Endpoints
app.get('/api/config', authMiddleware, (req, res) => {
    res.json(CONFIG);
});

app.post('/api/config', authMiddleware, (req, res) => {
    updateConfig(req.body);
    io.emit('config-updated', CONFIG);
    res.json({ status: "success", config: CONFIG });
});

// Administrative: Unjail Endpoint
app.post('/api/unjail', authMiddleware, async (req, res) => {
    const { fingerprint } = req.body;
    if (!fingerprint) return res.status(400).send("Fingerprint required");

    await clearJail(fingerprint);
    res.json({ status: "success", message: `Subject freed successfully.` });
});

// 🛡️ Apply Sentinel DoS Mitigation
app.use(dosMitigator);

// ⚡ Reverse Proxy Engine (Strictly filter out internal routes)
app.use('/', createProxyMiddleware({
    target: BACKEND_URL,
    changeOrigin: true,
    // EXCEPTION: Never proxy these routes
    filter: (pathname, req) => {
        const isInternal = pathname.startsWith('/sentinel') ||
            pathname.startsWith('/api/') ||
            pathname.startsWith('/health');
        return !isInternal;
    },
    onError: (err, req, res) => {
        console.error(`[PROXY] Gateway Error: ${err.message}`);
        res.status(502).send('Gateway Error: Backend is unreachable.');
    }
}));

server.listen(SHIELD_PORT, '0.0.0.0', () => {
    console.log(`✅ Sentinel Shield is active at http://0.0.0.0:${SHIELD_PORT} (Internal)`);
    console.log(`🛡️  External access via host port mapping configured in docker-compose.`);
});
