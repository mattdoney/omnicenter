import { Server as HTTPServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { EventEmitter } from 'events';
import { UnifiedMessage } from '@/types/messages';

export class WebSocketServer extends EventEmitter {
  private static instance: WebSocketServer;
  private io: SocketServer | null = null;

  private constructor() {
    super();
  }

  static getInstance(): WebSocketServer {
    if (!WebSocketServer.instance) {
      WebSocketServer.instance = new WebSocketServer();
    }
    return WebSocketServer.instance;
  }

  initialize(server: HTTPServer) {
    if (this.io) return;

    this.io = new SocketServer(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      socket.on('subscribe', (identifier: string) => {
        console.log('Client subscribed to:', identifier);
        socket.join(identifier);
      });

      socket.on('unsubscribe', (identifier: string) => {
        console.log('Client unsubscribed from:', identifier);
        socket.leave(identifier);
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
  }

  async broadcastNewMessage(message: UnifiedMessage) {
    const identifier = message.type === 'email' ? message.emailAddress : message.phoneNumber;
    if (!identifier) return;

    this.emit('newMessage', message);
    this.io?.to(identifier).emit('newMessage', message);
  }

  async broadcastMessageUpdate(message: UnifiedMessage) {
    const identifier = message.type === 'email' ? message.emailAddress : message.phoneNumber;
    if (!identifier) return;

    this.emit('messageUpdate', message);
    this.io?.to(identifier).emit('messageUpdate', message);
  }
}

export default WebSocketServer;
