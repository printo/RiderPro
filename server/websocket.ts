import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { RouteTrackingQueries } from './db/routeQueries.js';

interface LocationUpdate {
  type: 'location_update';
  employeeId: string;
  sessionId: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number;
  speed?: number;
}

interface ClientMessage {
  type: 'subscribe_tracking' | 'unsubscribe_tracking';
  employeeId?: string;
}

interface ConnectedClient {
  ws: WebSocket;
  subscribedEmployees: Set<string>;
  isAdmin: boolean;
}

export class LiveTrackingWebSocket {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, ConnectedClient> = new Map();
  private routeQueries: RouteTrackingQueries;

  constructor(server: Server) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws/tracking'
    });

    this.routeQueries = new RouteTrackingQueries();
    this.setupWebSocketHandlers();
  }

  private setupWebSocketHandlers(): void {
    this.wss.on('connection', (ws: WebSocket, request) => {
      console.log('New WebSocket connection for live tracking');

      // Initialize client
      const client: ConnectedClient = {
        ws,
        subscribedEmployees: new Set(),
        isAdmin: true // For now, assume all connections are admin
      };

      this.clients.set(ws, client);

      // Send initial active sessions
      this.sendActiveSessionsToClient(client);

      ws.on('message', (data: Buffer) => {
        try {
          const message: ClientMessage = JSON.parse(data.toString());
          this.handleClientMessage(client, message);
        } catch (error) {
          console.error('Invalid WebSocket message:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format'
          }));
        }
      });

      ws.on('close', () => {
        console.log('WebSocket connection closed');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });
    });
  }

  private handleClientMessage(client: ConnectedClient, message: ClientMessage): void {
    switch (message.type) {
      case 'subscribe_tracking':
        if (message.employeeId) {
          client.subscribedEmployees.add(message.employeeId);
          console.log(`Client subscribed to employee ${message.employeeId}`);
        } else {
          // Subscribe to all active employees
          this.subscribeToAllActive(client);
        }
        break;

      case 'unsubscribe_tracking':
        if (message.employeeId) {
          client.subscribedEmployees.delete(message.employeeId);
          console.log(`Client unsubscribed from employee ${message.employeeId}`);
        } else {
          client.subscribedEmployees.clear();
        }
        break;

      default:
        client.ws.send(JSON.stringify({
          type: 'error',
          message: 'Unknown message type'
        }));
    }
  }

  private subscribeToAllActive(client: ConnectedClient): void {
    try {
      // Get all employees with active sessions
      const activeSessions = this.routeQueries.getDatabase().prepare(`
        SELECT DISTINCT employee_id 
        FROM route_tracking 
        WHERE session_status = 'active'
      `).all();

      activeSessions.forEach((session: any) => {
        client.subscribedEmployees.add(session.employee_id);
      });

      console.log(`Client subscribed to ${activeSessions.length} active employees`);
    } catch (error) {
      console.error('Error subscribing to all active employees:', error);
    }
  }

  private sendActiveSessionsToClient(client: ConnectedClient): void {
    try {
      const activeSessions = this.routeQueries.getDatabase().prepare(`
        SELECT DISTINCT 
          employee_id as employeeId,
          session_id as sessionId,
          session_start_time as startTime,
          latitude,
          longitude,
          timestamp,
          accuracy,
          speed
        FROM route_tracking 
        WHERE session_status = 'active'
        ORDER BY timestamp DESC
      `).all();

      client.ws.send(JSON.stringify({
        type: 'active_sessions',
        sessions: activeSessions
      }));

      // Auto-subscribe to all active employees
      activeSessions.forEach((session: any) => {
        client.subscribedEmployees.add(session.employeeId);
      });

    } catch (error) {
      console.error('Error sending active sessions:', error);
    }
  }

  // Method to broadcast location updates (called from route API endpoints)
  public broadcastLocationUpdate(locationUpdate: LocationUpdate): void {
    const message = JSON.stringify({
      ...locationUpdate
    });

    this.clients.forEach((client) => {
      if (client.subscribedEmployees.has(locationUpdate.employeeId)) {
        try {
          client.ws.send(message);
        } catch (error) {
          console.error('Error sending location update to client:', error);
          // Remove dead connection
          this.clients.delete(client.ws);
        }
      }
    });
  }

  // Method to broadcast session status changes
  public broadcastSessionStatusChange(employeeId: string, sessionId: string, status: string): void {
    const message = JSON.stringify({
      type: 'session_status_change',
      employeeId,
      sessionId,
      status,
      timestamp: new Date().toISOString()
    });

    this.clients.forEach((client) => {
      if (client.subscribedEmployees.has(employeeId)) {
        try {
          client.ws.send(message);
        } catch (error) {
          console.error('Error sending session status change to client:', error);
          this.clients.delete(client.ws);
        }
      }
    });
  }

  // Get connection stats
  public getStats(): { totalConnections: number, totalSubscriptions: number } {
    let totalSubscriptions = 0;
    this.clients.forEach((client) => {
      totalSubscriptions += client.subscribedEmployees.size;
    });

    return {
      totalConnections: this.clients.size,
      totalSubscriptions
    };
  }
}

// Global instance to be used across the application
let liveTrackingWS: LiveTrackingWebSocket | null = null;

export function initializeLiveTracking(server: Server): LiveTrackingWebSocket {
  if (!liveTrackingWS) {
    liveTrackingWS = new LiveTrackingWebSocket(server);
  }
  return liveTrackingWS;
}

export function getLiveTrackingWS(): LiveTrackingWebSocket | null {
  return liveTrackingWS;
}