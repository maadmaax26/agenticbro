"use strict";
/**
 * Agentic Bro API Server
 *
 * Main entry point - Minimal working version
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3002;
const HOST = process.env.HOST || '0.0.0.0';
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
}));
app.use((0, compression_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// Request logging
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    });
    next();
});
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        services: {
            database: 'not_configured',
            redis: 'not_configured',
        },
    });
});
// API version info
app.get('/api/v1', (req, res) => {
    res.json({
        name: 'Agentic Bro API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            'GET /health': 'Health check',
            'GET /api/v1': 'API info',
            'POST /api/v1/scan/token': 'Scan a token contract',
            'POST /api/v1/scan/batch': 'Scan multiple tokens',
            'GET /api/v1/scan/token/:address/history': 'Get scan history',
            'GET /api/v1/scan/trending': 'Get trending tokens',
            'GET /api/v1/scan/stats': 'Get scanner statistics',
            'POST /api/v1/sync/scam-db': 'Sync local CSV to database',
            'GET /api/v1/sync/status': 'Get last sync status',
            'GET /api/v1/sync/csv-stats': 'Get CSV file statistics',
        },
        authentication: 'API key required for premium features',
        rateLimits: {
            free: '5 scans/day',
            basic: '50 scans/day',
            pro: '200 scans/day',
            team: '1000 scans/day',
            enterprise: 'unlimited',
        },
    });
});
// Import routes after middleware is set up
const scan_1 = __importDefault(require("../routes/scan"));
const verify_1 = __importDefault(require("../routes/verify"));
const sync_1 = __importDefault(require("../routes/sync"));
const sla_1 = __importDefault(require("../routes/brand-guard/sla"));
const takedown_1 = __importDefault(require("../routes/brand-guard/takedown"));
const fingerprint_1 = __importDefault(require("../routes/brand-guard/fingerprint"));
const marketplace_1 = __importDefault(require("../routes/brand-guard/marketplace"));
app.use('/api/v1/scan', scan_1.default);
app.use('/api/v1/verify', verify_1.default);
app.use('/api/v1/sync', sync_1.default);
app.use('/api/brand-guard', sla_1.default);
app.use('/api/brand-guard/takedown', takedown_1.default);
app.use('/api/brand-guard/fingerprint', fingerprint_1.default);
app.use('/api/brand-guard/marketplace', marketplace_1.default);
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: 'Endpoint not found',
            path: req.path,
        },
    });
});
// Error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
        },
    });
});
// Start server
app.listen(PORT, () => {
    console.log('');
    console.log('╔════════════════════════════════════════════╗');
    console.log('║                                            ║');
    console.log('║   🛡️  Agentic Bro API Server              ║');
    console.log('║                                            ║');
    console.log('║   Port: ' + PORT + '                              ║');
    console.log('║   Host: ' + HOST + '                          ║');
    console.log('║   Environment: ' + (process.env.NODE_ENV || 'development') + '                    ║');
    console.log('║                                            ║');
    console.log('║   Status: Running (minimal mode)           ║');
    console.log('║                                            ║');
    console.log('║   Endpoints:                               ║');
    console.log('║   • GET  /health                           ║');
    console.log('║   • GET  /api/v1                            ║');
    console.log('║   • POST /api/v1/verify/profile             ║');
    console.log('║   • POST /api/v1/scan/token                 ║');
    console.log('║                                            ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log('');
});
exports.default = app;
//# sourceMappingURL=index.js.map