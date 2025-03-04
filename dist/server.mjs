import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
// Initialize Next.js
await app.prepare();
const server = createServer((req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*'); // Adjust this to allow specific domains
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', true);
    // Handle OPTIONS method for CORS preflight
    if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
    }
    try {
        const parsedUrl = parse(req.url, true);
        handle(req, res, parsedUrl);
    }
    catch (err) {
        console.error('Error occurred handling', req.url, err);
        res.statusCode = 500;
        res.end('Internal server error');
    }
});
// Initialize WebSocket server
const { default: WebSocketServer } = await import('./dist/src/lib/websocket/server.mjs');
WebSocketServer.init(server);
server.listen(process.env.PORT || 3001, (err) => {
    if (err)
        throw err;
    console.log(`> Ready on http://localhost:${process.env.PORT || 3001}`);
});
//# sourceMappingURL=server.mjs.map