#!/usr/bin/env node
/**
 * MIDI Bridge Server for Reaper
 *
 * Bidirectional MIDI bridge between browser/iPad and Reaper:
 * - Receives MIDI from browser via WebSocket → sends to Reaper via IAC Driver
 * - Receives track changes from Reaper ReaScript via HTTP
 * - Broadcasts track changes to browser clients
 *
 * Usage: node midi-server.js [port]
 *
 * If port is not specified, it will auto-find an available port starting from 7101.
 * Avoids macOS reserved ports (5000, 7000 used by AirPlay).
 */

const WebSocket = require('ws');
const JZZ = require('jzz');
const http = require('http');
const os = require('os');
const net = require('net');

// Default port - can be overridden by command line arg or auto-detected
const DEFAULT_WS_PORT = 7101;

// Ports to avoid on macOS (used by system services)
const MACOS_RESERVED_PORTS = [3000, 5000, 7000];

// Check if a port is available
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '0.0.0.0');
  });
}

// Find an available port
async function findAvailablePort(startPort, maxAttempts = 10) {
  let port = startPort;
  for (let i = 0; i < maxAttempts; i++) {
    while (MACOS_RESERVED_PORTS.includes(port)) {
      port++;
    }
    if (await isPortAvailable(port)) {
      return port;
    }
    port++;
  }
  throw new Error(`Could not find available port after ${maxAttempts} attempts`);
}

// Will be set after finding available port
let WS_PORT = DEFAULT_WS_PORT;

// Get local IP address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// MIDI ports
let midiOut = null;
let selectedOutPortName = null;

// Connected WebSocket clients
let wsClients = new Set();

// Initialize MIDI
async function initMidi() {
  console.log('\n🎹 Reaper MIDI Bridge Server');
  console.log('============================\n');

  const info = JZZ().info();
  const outputs = info.outputs;
  const inputs = info.inputs;

  // List available MIDI ports
  console.log('Available MIDI outputs:');
  outputs.forEach((port, i) => {
    console.log(`  ${i + 1}. ${port.name}`);
  });
  console.log('');

  console.log('Available MIDI inputs:');
  inputs.forEach((port, i) => {
    console.log(`  ${i + 1}. ${port.name}`);
  });
  console.log('');

  // --- Set up OUTPUT (Browser → Reaper) ---
  // Use IAC Driver on macOS - can share with Cubase setup
  const preferredOutNames = ['ArticulationRemote', 'IAC Driver - Bus 1', 'IAC Driver', 'Browser to Cubase', 'Browser to Reaper', 'loopMIDI'];

  for (const preferred of preferredOutNames) {
    const found = outputs.find(p => p.name.toLowerCase().includes(preferred.toLowerCase()));
    if (found) {
      selectedOutPortName = found.name;
      break;
    }
  }

  if (selectedOutPortName) {
    try {
      midiOut = JZZ().openMidiOut(selectedOutPortName);
      console.log(`✅ Output: ${selectedOutPortName} (Browser → Reaper)`);
    } catch (e) {
      console.error(`❌ Failed to open MIDI output: ${e.message}`);
    }
  } else {
    console.log('⚠️  No IAC Driver found - enable it in Audio MIDI Setup');
    console.log('   Or create a virtual MIDI port named "Browser to Reaper"');
  }

  console.log('');
}

// Describe MIDI message type
function describeMidi(bytes) {
  if (!bytes || bytes.length === 0) return 'empty';
  const status = bytes[0];
  const channel = (status & 0x0F) + 1;
  const type = status & 0xF0;

  switch (type) {
    case 0x80: return `Note Off ch${channel} note=${bytes[1]} vel=${bytes[2]}`;
    case 0x90: return bytes[2] > 0 ? `Note On ch${channel} note=${bytes[1]} vel=${bytes[2]}` : `Note Off ch${channel} note=${bytes[1]}`;
    case 0xA0: return `Poly Pressure ch${channel} note=${bytes[1]} pressure=${bytes[2]}`;
    case 0xB0: return `CC ch${channel} cc=${bytes[1]} val=${bytes[2]}`;
    case 0xC0: return `Program Change ch${channel} program=${bytes[1]}`;
    case 0xD0: return `Channel Pressure ch${channel} pressure=${bytes[1]}`;
    case 0xE0: return `Pitch Bend ch${channel}`;
    default: return `Unknown 0x${status.toString(16)}`;
  }
}

// Broadcast any data to all browser clients
function broadcastToClients(data) {
  const message = JSON.stringify(data);

  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });

  console.log(`📤 Sent to ${wsClients.size} browser(s)`);
}

// Legacy aliases
function broadcastTrackChange(trackName, bankName, msb, lsb) {
  broadcastToClients({
    type: 'trackChange',
    trackName,
    bankName: bankName || null,
    msb: msb || null,
    lsb: lsb || null
  });
}

function broadcastTrackName(trackName, msb, lsb) {
  broadcastTrackChange(trackName, null, msb, lsb);
}

// Send MIDI message to Reaper
function sendMidi(status, data1, data2) {
  const msg = [status, data1, data2];
  console.log(`🎵 MIDI Out: [${msg.join(', ')}] - ${describeMidi(msg)}`);

  if (midiOut) {
    try {
      midiOut.send(msg);
    } catch (e) {
      console.error(`   Error: ${e.message}`);
    }
  }
}

// Start HTTP + WebSocket server
function startServer() {
  // Create HTTP server for Reaper script requests
  const httpServer = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Track change endpoint from Reaper script
    if (req.method === 'POST' && req.url === '/track') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);

          // Full bank data with articulations
          if (data.type === 'bankData' && data.articulations) {
            console.log(`📥 Bank from Reaper: "${data.trackName}" -> ${data.bankName} (${data.articulations.length} articulations)`);
            broadcastToClients(data);
          }
          // Just track name change
          else if (data.trackName) {
            console.log(`📥 Track from Reaper: "${data.trackName}"`);
            broadcastToClients({ type: 'trackChange', trackName: data.trackName });
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok' }));
        } catch (e) {
          console.error('Invalid track data:', e.message);
          res.writeHead(400);
          res.end('Invalid JSON');
        }
      });
      return;
    }

    // Health check
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', port: selectedOutPortName }));
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  // WebSocket server attached to HTTP server
  const wss = new WebSocket.Server({ server: httpServer });

  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`📱 Client connected: ${clientIp}`);

    wsClients.add(ws);

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'midi') {
          // MIDI message from browser - send to Reaper
          sendMidi(msg.status, msg.data1, msg.data2);
        } else if (msg.type === 'ping') {
          // Browser ping - respond with status
          ws.send(JSON.stringify({ type: 'pong', port: selectedOutPortName }));
        } else if (msg.type === 'trackChange') {
          // Track change notification (could come from a Reaper script)
          console.log(`📥 Track changed: "${msg.trackName}"`);
          broadcastTrackName(msg.trackName, msg.msb, msg.lsb);
        }
      } catch (e) {
        console.error('Invalid message:', e.message);
      }
    });

    ws.on('close', () => {
      console.log(`📱 Client disconnected: ${clientIp}`);
      wsClients.delete(ws);
    });

    // Send current status
    ws.send(JSON.stringify({
      type: 'connected',
      port: selectedOutPortName,
      status: midiOut ? 'ready' : 'no-midi'
    }));
  });

  // Start the HTTP server (WebSocket is attached to it)
  httpServer.listen(WS_PORT, () => {
    const localIP = getLocalIP();
    // Output port in a parseable format
    console.log(`MIDI_SERVER_PORT=${WS_PORT}`);
    console.log(`🌐 Server running on port ${WS_PORT}`);
    console.log(`   - WebSocket: ws://localhost:${WS_PORT}`);
    console.log(`   - HTTP API:  http://localhost:${WS_PORT}/track`);
    console.log(`\n📱 On your iPad, open: http://${localIP}:7100`);
    console.log('   The app will automatically connect to this MIDI bridge.');
    console.log('\n🎹 In Reaper, run the CubbyRemoteTrackMonitor.lua script');
    console.log('   Location: reaper-scripts/CubbyRemoteTrackMonitor.lua');
    console.log('');
  });
}

// Main
async function main() {
  // Check for port argument
  const portArg = process.argv[2];
  if (portArg) {
    WS_PORT = parseInt(portArg, 10);
    if (isNaN(WS_PORT)) {
      console.error('Invalid port argument');
      process.exit(1);
    }
  } else {
    // Auto-find available port
    try {
      WS_PORT = await findAvailablePort(DEFAULT_WS_PORT);
      if (WS_PORT !== DEFAULT_WS_PORT) {
        console.log(`ℹ️  Port ${DEFAULT_WS_PORT} was busy, using port ${WS_PORT}`);
      }
    } catch (err) {
      console.error('Failed to find available port:', err.message);
      process.exit(1);
    }
  }

  await initMidi();
  startServer();
}

main().catch(console.error);
