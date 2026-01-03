import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { initWebSocketServerWithHttp, getConnectedDeviceCount, getConnectedDashboardCount } from './websocket/server';
import devicesRouter from './routes/devices';
import telemetryRouter from './routes/telemetry';
import locationRouter from './routes/location';
import authRouter from './routes/auth';
import adminRouter from './routes/admin';
import browserRouter from './routes/browser';

const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = createServer(app);

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

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Telemetry Backend',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      admin: '/api/admin',
      devices: '/api/devices',
      telemetry: '/api/telemetry',
      location: '/api/location',
      browser: '/api/browser'
    },
    websocket: 'Connect via wss:// on same URL'
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

// Attach WebSocket to the same HTTP server
initWebSocketServerWithHttp(server);

// Start HTTP server (handles both REST API and WebSocket)
server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║         TELEMETRY BACKEND SERVER STARTED                ║
╠══════════════════════════════════════════════════════════╣
║  Server:      http://localhost:${PORT}                      ║
║  WebSocket:   ws://localhost:${PORT} (same port)            ║
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

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...');
  server.close();
  process.exit(0);
});
