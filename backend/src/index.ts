import express from 'express';
import cors from 'cors';
import { initWebSocketServer, getConnectedDeviceCount, getConnectedDashboardCount } from './websocket/server';
import devicesRouter from './routes/devices';
import telemetryRouter from './routes/telemetry';
import locationRouter from './routes/location';
import authRouter from './routes/auth';
import adminRouter from './routes/admin';
import browserRouter from './routes/browser';

const app = express();
const PORT = process.env.PORT || 3000;
const WS_PORT = process.env.WS_PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    connected_devices: getConnectedDeviceCount(),
    connected_dashboards: getConnectedDashboardCount()
  });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/telemetry', telemetryRouter);
app.use('/api/location', locationRouter);
app.use('/api/browser', browserRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start HTTP server
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║         TELEMETRY BACKEND SERVER STARTED                ║
╠══════════════════════════════════════════════════════════╣
║  REST API:    http://localhost:${PORT}                      ║
║  WebSocket:   ws://localhost:${WS_PORT}                        ║
║  Health:      http://localhost:${PORT}/health               ║
╠══════════════════════════════════════════════════════════╣
║  Auth Endpoints:                                         ║
║  - POST /api/auth/login         User login               ║
║  - POST /api/auth/request-access Request access          ║
╠══════════════════════════════════════════════════════════╣
║  Admin Endpoints (require Basic Auth):                   ║
║  - GET  /api/admin/users        List users               ║
║  - POST /api/admin/users        Create user              ║
║  - DELETE /api/admin/users/:id  Delete user              ║
║  - GET  /api/admin/access-requests  Pending requests     ║
╠══════════════════════════════════════════════════════════╣
║  Device Endpoints:                                       ║
║  - GET  /api/devices            List all devices         ║
║  - GET  /api/devices/:id        Get device details       ║
║  - POST /api/devices/:id/beep   Beep device              ║
║  - GET  /api/devices/:id/location        Latest location ║
║  - POST /api/telemetry          Submit telemetry         ║
║  - POST /api/location           Submit location          ║
╠══════════════════════════════════════════════════════════╣
║  Browser Endpoints:                                      ║
║  - POST /api/browser            Record URL visit         ║
║  - GET  /api/browser/:deviceId  Get browsing history     ║
║  - GET  /api/browser/:deviceId/stats  Browsing stats     ║
╚══════════════════════════════════════════════════════════╝
  `);
});

// Start WebSocket server
initWebSocketServer(Number(WS_PORT));

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});
