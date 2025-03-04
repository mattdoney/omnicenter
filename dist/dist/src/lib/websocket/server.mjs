import { Server as SocketServer } from 'socket.io';
import { EventEmitter } from 'events';
export class WebSocketServer extends EventEmitter {
    static instance;
    io = null;
    constructor() {
        super();
    }
    static getInstance() {
        if (!WebSocketServer.instance) {
            WebSocketServer.instance = new WebSocketServer();
        }
        return WebSocketServer.instance;
    }
    initialize(server) {
        if (this.io)
            return;
        this.io = new SocketServer(server, {
            cors: {
                origin: '*',
                methods: ['GET', 'POST']
            }
        });
        this.io.on('connection', (socket) => {
            console.log('Client connected:', socket.id);
            socket.on('subscribe', (identifier) => {
                console.log('Client subscribed to:', identifier);
                socket.join(identifier);
            });
            socket.on('unsubscribe', (identifier) => {
                console.log('Client unsubscribed from:', identifier);
                socket.leave(identifier);
            });
            socket.on('disconnect', () => {
                console.log('Client disconnected:', socket.id);
            });
        });
    }
    async broadcastNewMessage(message) {
        const identifier = message.type === 'email' ? message.emailAddress : message.phoneNumber;
        if (!identifier)
            return;
        this.emit('newMessage', message);
        this.io?.to(identifier).emit('newMessage', message);
    }
    async broadcastMessageUpdate(message) {
        const identifier = message.type === 'email' ? message.emailAddress : message.phoneNumber;
        if (!identifier)
            return;
        this.emit('messageUpdate', message);
        this.io?.to(identifier).emit('messageUpdate', message);
    }
}
export default WebSocketServer;
//# sourceMappingURL=server.js.map
//# sourceMappingURL=server.mjs.map