'use strict';

// ============================================================
//  NexusNode Core — Team Red X Premium Edition
//  — by Abdul Rehman Rajpoot
//  WhatsApp: +923009842133
//  Telegram: https://t.me/TeamRedxhacker2
//  YouTube:  https://youtube.com/@rootmindtech
// ============================================================

const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const Docker   = require('dockerode');
const bcrypt   = require('bcryptjs');
const jwt      = require('jwt-simple');
const fs       = require('fs');
const path     = require('path');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
});
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const PORT       = process.env.PORT       || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'NEXUSNODE_REDX_ULTRA_SECRET_KEY_2024_ARR';
const DB_PATH    = path.join(__dirname, 'database.json');

// ============================================================
// DATABASE
// ============================================================
function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return { users: [], containers: [], messages: [] };
  }
}
function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

function auth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'No authorization header' });
  const token = header.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token missing' });
  try {
    req.user = jwt.decode(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

// ============================================================
// CONTAINER TEMPLATES
// ============================================================
const TEMPLATES = {
  'whatsapp-node': {
    label: 'WhatsApp Node.js (redxbot302)',
    icon: '📱',
    Image: 'node:18-alpine',
    Cmd: [
      'sh', '-c',
      'apk add --no-cache git curl bash && ' +
      'git clone https://github.com/AbdulRehman19721986/redxbot302 /app && ' +
      'cd /app && npm install --legacy-peer-deps && ' +
      'echo "=== redxbot302 by Abdul Rehman Rajpoot ===" && node index.js'
    ],
    defaultPort: 3000,
  },
  'whatsapp-php': {
    label: 'WhatsApp PHP 8.2 + Apache',
    icon: '🐘',
    Image: 'php:8.2-apache',
    Cmd: ['apache2-foreground'],
    defaultPort: 80,
  },
  'minecraft': {
    label: 'Minecraft Paper + GeyserMC',
    icon: '⛏️',
    Image: 'itzg/minecraft-server:latest',
    Env: [
      'EULA=TRUE',
      'TYPE=PAPER',
      'MEMORY=2G',
      'ENABLE_ROLLING_LOGS=true',
      'ONLINE_MODE=FALSE',
      'PLUGINS=https://download.geysermc.org/v2/projects/geyser/versions/latest/builds/latest/downloads/spigot,https://download.geysermc.org/v2/projects/floodgate/versions/latest/builds/latest/downloads/spigot',
    ],
    Cmd: null,
    defaultPort: 25565,
  },
  'ubuntu': {
    label: 'Clean Ubuntu 22.04 Base',
    icon: '🐧',
    Image: 'ubuntu:22.04',
    Cmd: ['bash', '-c', 'apt-get update -q && apt-get install -y curl wget nano && tail -f /dev/null'],
    defaultPort: 22,
  },
};

// ============================================================
// AUTH ROUTES
// ============================================================
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const db = readDB();
  const user = db.users.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });
  if (user.suspended) return res.status(403).json({ error: 'Account suspended. Contact admin.' });
  const token = jwt.encode(
    { id: user.id, username: user.username, role: user.role, plan: user.plan, iat: Date.now() },
    JWT_SECRET
  );
  res.json({ token, user: { id: user.id, username: user.username, role: user.role, plan: user.plan } });
});

app.get('/api/auth/me', auth, (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.username === req.user.username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, username: user.username, role: user.role, plan: user.plan, suspended: user.suspended });
});

// ============================================================
// TEMPLATE ROUTE
// ============================================================
app.get('/api/templates', auth, (req, res) => {
  const list = Object.entries(TEMPLATES).map(([id, t]) => ({
    id, label: t.label, icon: t.icon, defaultPort: t.defaultPort,
  }));
  res.json(list);
});

// ============================================================
// CONTAINER ROUTES
// ============================================================
app.get('/api/containers', auth, async (req, res) => {
  try {
    const db = readDB();
    const isAdmin = req.user.role === 'admin';
    const list = isAdmin ? db.containers : db.containers.filter(c => c.owner === req.user.username);

    const detailed = await Promise.all(list.map(async c => {
      try {
        const container = docker.getContainer(c.dockerId);
        const info = await container.inspect();
        return {
          ...c,
          status: info.State.Status,
          running: info.State.Running,
          startedAt: info.State.StartedAt,
        };
      } catch {
        return { ...c, status: 'removed', running: false };
      }
    }));
    res.json(detailed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/containers/create', auth, async (req, res) => {
  const { name, template, ram, port } = req.body;
  if (!name || !template) return res.status(400).json({ error: 'Name and template required' });

  const db = readDB();
  const user = db.users.find(u => u.username === req.user.username);
  if (!user) return res.status(401).json({ error: 'User not found' });

  // Plan enforcement
  const userContainers = db.containers.filter(c => c.owner === req.user.username);
  if (user.plan === 'free') {
    if (userContainers.length >= 1) {
      return res.status(403).json({ error: 'Free plan: 1 container max. Upgrade to Premium.' });
    }
    if ((ram || 512) > 1024) {
      return res.status(403).json({ error: 'Free plan: 1GB RAM max.' });
    }
  }
  if ((ram || 512) > 16384) {
    return res.status(403).json({ error: 'Max 16GB RAM allowed.' });
  }

  const tmpl = TEMPLATES[template];
  if (!tmpl) return res.status(400).json({ error: 'Invalid template' });

  const Memory    = (ram || 512) * 1024 * 1024;
  const hostPort  = (port || (Math.floor(Math.random() * 10000) + 20000)).toString();
  const containerName = `nexus_${name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;

  try {
    // Emit progress to all sockets
    io.emit('create_progress', { name, step: 'pull', msg: `Pulling image: ${tmpl.Image}` });

    await new Promise((resolve, reject) => {
      docker.pull(tmpl.Image, (err, stream) => {
        if (err) return reject(err);
        docker.modem.followProgress(stream, err2 => err2 ? reject(err2) : resolve());
      });
    });

    io.emit('create_progress', { name, step: 'create', msg: 'Creating container...' });

    const cfg = {
      Image: tmpl.Image,
      name: containerName,
      Env: tmpl.Env || [],
      HostConfig: {
        Memory,
        MemorySwap: Memory * 2,
        CpuPeriod: 100000,
        CpuQuota: user.plan === 'free' ? 25000 : 100000,
        RestartPolicy: { Name: 'always' },
        PortBindings: {
          [`${tmpl.defaultPort}/tcp`]: [{ HostPort: hostPort }],
        },
      },
      ExposedPorts: { [`${tmpl.defaultPort}/tcp`]: {} },
    };
    if (tmpl.Cmd) cfg.Cmd = tmpl.Cmd;

    const container = await docker.createContainer(cfg);
    await container.start();
    const info = await container.inspect();

    const record = {
      id: `c_${Date.now()}`,
      dockerId: info.Id,
      name,
      containerName,
      template,
      templateLabel: tmpl.label,
      icon: tmpl.icon,
      owner: req.user.username,
      ram: ram || 512,
      port: hostPort,
      createdAt: new Date().toISOString(),
    };
    db.containers.push(record);
    writeDB(db);

    io.emit('create_progress', { name, step: 'done', msg: `Container running on port ${hostPort}` });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/containers/:id/action', auth, async (req, res) => {
  const { action } = req.body;
  const db  = readDB();
  const isAdmin = req.user.role === 'admin';
  const c   = db.containers.find(
    x => x.id === req.params.id && (x.owner === req.user.username || isAdmin)
  );
  if (!c) return res.status(404).json({ error: 'Container not found' });

  try {
    const container = docker.getContainer(c.dockerId);
    if      (action === 'start')   await container.start();
    else if (action === 'stop')    await container.stop({ t: 10 });
    else if (action === 'restart') await container.restart({ t: 10 });
    else if (action === 'delete') {
      try { await container.stop({ t: 5 }); } catch {}
      await container.remove({ force: true });
      db.containers = db.containers.filter(x => x.id !== c.id);
      writeDB(db);
      return res.json({ success: true, deleted: true });
    } else {
      return res.status(400).json({ error: 'Unknown action' });
    }
    res.json({ success: true, action });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/containers/:id/logs', auth, async (req, res) => {
  const db = readDB();
  const isAdmin = req.user.role === 'admin';
  const c = db.containers.find(
    x => x.id === req.params.id && (x.owner === req.user.username || isAdmin)
  );
  if (!c) return res.status(404).json({ error: 'Not found' });
  try {
    const container = docker.getContainer(c.dockerId);
    const raw = await container.logs({ stdout: true, stderr: true, tail: 300, timestamps: true });
    // Strip binary framing bytes
    const clean = raw.toString('utf8').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').trim();
    res.json({ logs: clean });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// SYSTEM STATS
// ============================================================
app.get('/api/stats', auth, async (req, res) => {
  try {
    const info = await docker.info();
    const db   = readDB();
    res.json({
      containers:    info.Containers,
      running:       info.ContainersRunning,
      stopped:       info.ContainersStopped,
      paused:        info.ContainersPaused,
      images:        info.Images,
      users:         db.users.length,
      serverVersion: info.ServerVersion,
      os:            info.OperatingSystem,
      arch:          info.Architecture,
      memoryTotal:   info.MemTotal,
      cpus:          info.NCPU,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// ADMIN USER MANAGEMENT
// ============================================================
app.get('/api/admin/users', auth, adminOnly, (req, res) => {
  const db = readDB();
  res.json(db.users.map(u => ({
    id:             u.id,
    username:       u.username,
    plan:           u.plan,
    role:           u.role,
    suspended:      u.suspended,
    createdAt:      u.createdAt,
    containerCount: db.containers.filter(c => c.owner === u.username).length,
  })));
});

app.post('/api/admin/users', auth, adminOnly, async (req, res) => {
  const { username, password, plan, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const db = readDB();
  if (db.users.find(u => u.username === username))
    return res.status(400).json({ error: 'Username already exists' });
  const hashed = await bcrypt.hash(password, 10);
  const user = {
    id:        `u_${Date.now()}`,
    username,
    password:  hashed,
    plan:      plan || 'free',
    role:      role || 'user',
    suspended: false,
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  writeDB(db);
  res.json({ id: user.id, username: user.username, plan: user.plan, role: user.role });
});

app.put('/api/admin/users/:id', auth, adminOnly, async (req, res) => {
  const db  = readDB();
  const idx = db.users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  const { plan, role, suspended, password } = req.body;
  if (plan      !== undefined) db.users[idx].plan      = plan;
  if (role      !== undefined) db.users[idx].role      = role;
  if (suspended !== undefined) db.users[idx].suspended = suspended;
  if (password)                db.users[idx].password  = await bcrypt.hash(password, 10);
  writeDB(db);
  const u = db.users[idx];
  res.json({ id: u.id, username: u.username, plan: u.plan, role: u.role, suspended: u.suspended });
});

app.delete('/api/admin/users/:id', auth, adminOnly, (req, res) => {
  const db = readDB();
  const u  = db.users.find(x => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  if (u.username === 'admin') return res.status(403).json({ error: 'Cannot delete root admin' });
  db.users = db.users.filter(x => x.id !== req.params.id);
  writeDB(db);
  res.json({ success: true });
});

// ============================================================
// CHAT HISTORY
// ============================================================
app.get('/api/chat/history', auth, (req, res) => {
  const db = readDB();
  res.json((db.messages || []).slice(-200));
});

// ============================================================
// SOCKET.IO — LIVE CHAT + EVENTS
// ============================================================
io.on('connection', socket => {
  socket.on('authenticate', ({ token }) => {
    try {
      socket.user = jwt.decode(token, JWT_SECRET);
      socket.join('support');
      const db = readDB();
      socket.emit('chat_history', (db.messages || []).slice(-100));
      io.to('support').emit('sys_event', {
        text: `${socket.user.username} joined`,
        time: new Date().toISOString(),
        type: 'join',
      });
    } catch {
      socket.emit('auth_error', { error: 'Invalid token' });
    }
  });

  socket.on('send_message', ({ text }) => {
    if (!socket.user || !text?.trim()) return;
    const msg = {
      id:   `msg_${Date.now()}`,
      from: socket.user.username,
      role: socket.user.role,
      text: text.trim().substring(0, 2000),
      time: new Date().toISOString(),
    };
    const db = readDB();
    if (!db.messages) db.messages = [];
    db.messages.push(msg);
    if (db.messages.length > 1000) db.messages = db.messages.slice(-1000);
    writeDB(db);
    io.to('support').emit('new_message', msg);
  });

  socket.on('typing', () => {
    if (socket.user) socket.to('support').emit('user_typing', { username: socket.user.username });
  });

  socket.on('disconnect', () => {
    if (socket.user) {
      io.to('support').emit('sys_event', {
        text: `${socket.user.username} left`,
        time: new Date().toISOString(),
        type: 'leave',
      });
    }
  });
});

// ============================================================
// FALLBACK & ERROR HANDLER
// ============================================================
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================================
// BOOT
// ============================================================
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║   NexusNode Core — Team Red X Premium Edition                ║
║   ⚡ ONLINE  │  Port: ${String(PORT).padEnd(5)}│  24/7 Active Mode         ║
║   WhatsApp : +923009842133                                   ║
║   Telegram : https://t.me/TeamRedxhacker2                    ║
║   YouTube  : https://youtube.com/@rootmindtech               ║
╠══════════════════════════════════════════════════════════════╣
║   — by Abdul Rehman Rajpoot                                  ║
╚══════════════════════════════════════════════════════════════╝`);
});

process.on('SIGTERM',             () => server.close(() => process.exit(0)));
process.on('uncaughtException',   err => console.error('[Uncaught]',   err.message));
process.on('unhandledRejection',  err => console.error('[Unhandled]',  err));
