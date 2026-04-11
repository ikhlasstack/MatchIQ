// Node.js WebSocket relay server
const WebSocket = require('ws');
const PORT = 8765;

const wss = new WebSocket.Server({ port: PORT });
let clients = [];

wss.on('connection', (ws) => {
    clients.push(ws);
    ws.on('message', (message) => {
        console.log(`Received message of length ${message.length}`);
        let parsed;
        try {
            parsed = JSON.parse(message);
        } catch (e) {
            parsed = null;
        }
        // Relay all messages (frame, llm_summary, control, etc.)
        clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
        // Optionally, handle control messages here (play, pause, seek)
        if (parsed && parsed.type && ['play', 'pause', 'seek'].includes(parsed.type)) {
            // You can add custom logic for control messages if needed
            console.log(`Control message received: ${parsed.type}`);
        }
    });
    ws.on('close', () => {
        clients = clients.filter((client) => client !== ws);
    });
});

console.log(`WebSocket relay server running on ws://localhost:${PORT}`);