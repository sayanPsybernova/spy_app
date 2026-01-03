import { WebSocketServer, WebSocket } from 'ws';
import { supabase } from '../lib/supabase';
import { inferIntent } from '../services/intent';

interface ExtendedWebSocket extends WebSocket {
  deviceId?: string;
  clientType?: 'DEVICE' | 'DASHBOARD';
  isAlive?: boolean;
}

// Store connected clients
const deviceConnections = new Map<string, ExtendedWebSocket>();
const dashboardConnections = new Set<ExtendedWebSocket>();

let wss: WebSocketServer;

export function initWebSocketServer(port: number = 8080) {
  wss = new WebSocketServer({ port });

  console.log(`WebSocket server running on port ${port}`);

  wss.on('connection', (ws: ExtendedWebSocket) => {
    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleMessage(ws, message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid JSON' }));
      }
    });

    ws.on('close', () => {
      handleDisconnect(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      handleDisconnect(ws);
    });
  });

  // Heartbeat to detect stale connections
  const interval = setInterval(() => {
    wss.clients.forEach((ws: ExtendedWebSocket) => {
      if (ws.isAlive === false) {
        handleDisconnect(ws);
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  return wss;
}

async function handleMessage(ws: ExtendedWebSocket, message: any) {
  const { type, device_id, client_type, payload } = message;

  switch (type) {
    case 'REGISTER':
      if (client_type === 'DASHBOARD') {
        ws.clientType = 'DASHBOARD';
        dashboardConnections.add(ws);
        console.log('Dashboard connected');

        // Send current device list from Supabase
        const { data: devices } = await supabase
          .from('devices')
          .select('*, user:users(user_id, username, profile_image_url)')
          .order('last_seen', { ascending: false });

        ws.send(JSON.stringify({
          type: 'DEVICE_LIST',
          data: devices || []
        }));
      } else if (client_type === 'DEVICE' && device_id) {
        ws.clientType = 'DEVICE';
        ws.deviceId = device_id;
        deviceConnections.set(device_id, ws);
        console.log(`Device connected: ${device_id}`);

        // Update device online status in Supabase
        await supabase
          .from('devices')
          .update({
            is_online: true,
            last_seen: new Date().toISOString()
          })
          .eq('device_id', device_id);

        // Broadcast device online to dashboards
        broadcastToDashboards({
          type: 'DEVICE_UPDATE',
          device_id,
          data: { is_online: true, last_seen: new Date().toISOString() }
        });
      }
      break;

    case 'LOCATION_UPDATE':
      if (ws.deviceId && payload) {
        // Store location in Supabase
        await supabase
          .from('location_history')
          .insert({
            device_id: ws.deviceId,
            latitude: payload.latitude,
            longitude: payload.longitude,
            accuracy: payload.accuracy || null,
            altitude: payload.altitude || null,
            speed: payload.speed || null,
            bearing: payload.bearing || null,
            timestamp: payload.timestamp || new Date().toISOString()
          });

        // Update device
        await supabase
          .from('devices')
          .update({
            is_online: true,
            location_enabled: true,
            last_seen: new Date().toISOString()
          })
          .eq('device_id', ws.deviceId);

        // Determine movement status
        let movementStatus = 'stationary';
        if (payload.speed !== null && payload.speed !== undefined) {
          if (payload.speed > 1.5 && payload.speed <= 7) {
            movementStatus = 'walking';
          } else if (payload.speed > 7) {
            movementStatus = 'driving';
          }
        }

        // Broadcast to dashboards
        broadcastToDashboards({
          type: 'LOCATION_UPDATE',
          device_id: ws.deviceId,
          data: {
            ...payload,
            movement_status: movementStatus,
            timestamp: payload.timestamp || new Date().toISOString()
          }
        });
      }
      break;

    case 'TELEMETRY_EVENT':
      if (ws.deviceId && payload) {
        // Store telemetry in Supabase
        await supabase
          .from('telemetry_events')
          .insert({
            device_id: ws.deviceId,
            event_type: payload.event_type,
            app_package: payload.app_package || null,
            app_label: payload.app_label || null,
            duration_ms: payload.duration_ms || null,
            screen_state: payload.screen_state || null,
            network_type: payload.network_type || null
          });

        // Update device
        await supabase
          .from('devices')
          .update({
            is_online: true,
            last_seen: new Date().toISOString()
          })
          .eq('device_id', ws.deviceId);

        // Broadcast to dashboards
        broadcastToDashboards({
          type: 'TELEMETRY_EVENT',
          device_id: ws.deviceId,
          data: {
            ...payload,
            timestamp: new Date().toISOString()
          }
        });

        // Infer intent
        if (payload.app_package && payload.app_label && payload.duration_ms) {
          const intent = inferIntent(payload.app_package, payload.app_label, payload.duration_ms);
          if (intent) {
            broadcastToDashboards({
              type: 'INTENT_UPDATE',
              device_id: ws.deviceId,
              data: intent
            });
          }
        }
      }
      break;

    case 'LOCATION_STATUS':
      if (ws.deviceId && payload) {
        await supabase
          .from('devices')
          .update({ location_enabled: payload.enabled })
          .eq('device_id', ws.deviceId);

        broadcastToDashboards({
          type: 'DEVICE_UPDATE',
          device_id: ws.deviceId,
          data: { location_enabled: payload.enabled }
        });
      }
      break;

    case 'HEARTBEAT':
      if (ws.deviceId) {
        await supabase
          .from('devices')
          .update({
            is_online: true,
            last_seen: new Date().toISOString()
          })
          .eq('device_id', ws.deviceId);

        ws.send(JSON.stringify({ type: 'HEARTBEAT_ACK' }));
      }
      break;

    default:
      console.log('Unknown message type:', type);
  }
}

async function handleDisconnect(ws: ExtendedWebSocket) {
  if (ws.clientType === 'DASHBOARD') {
    dashboardConnections.delete(ws);
    console.log('Dashboard disconnected');
  } else if (ws.clientType === 'DEVICE' && ws.deviceId) {
    deviceConnections.delete(ws.deviceId);
    console.log(`Device disconnected: ${ws.deviceId}`);

    // Update device offline status in Supabase
    await supabase
      .from('devices')
      .update({
        is_online: false,
        last_seen: new Date().toISOString()
      })
      .eq('device_id', ws.deviceId);

    // Broadcast device offline to dashboards
    broadcastToDashboards({
      type: 'DEVICE_UPDATE',
      device_id: ws.deviceId,
      data: { is_online: false, last_seen: new Date().toISOString() }
    });
  }
}

// Broadcast message to all connected dashboards
export function broadcastToDashboards(message: any) {
  const messageStr = JSON.stringify(message);
  dashboardConnections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(messageStr);
    }
  });
}

// Send message to specific device
export function sendToDevice(deviceId: string, message: any): boolean {
  const ws = deviceConnections.get(deviceId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
    return true;
  }
  return false;
}

// Get connected device count
export function getConnectedDeviceCount(): number {
  return deviceConnections.size;
}

// Get connected dashboard count
export function getConnectedDashboardCount(): number {
  return dashboardConnections.size;
}

// Check if device is connected
export function isDeviceConnected(deviceId: string): boolean {
  const ws = deviceConnections.get(deviceId);
  return ws !== undefined && ws.readyState === WebSocket.OPEN;
}
