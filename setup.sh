#!/usr/bin/env bash
# ============================================================
#  NexusNode Core — Team Red X Premium Edition
#  One-Click Automated Deployment Script
#  — by Abdul Rehman Rajpoot
#  WhatsApp: +923009842133 | Telegram: @TeamRedxhacker2
# ============================================================
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗] ERROR:${NC} $1"; exit 1; }
info() { echo -e "${CYAN}[i]${NC} $1"; }

echo -e "${RED}${BOLD}
╔══════════════════════════════════════════════════════════════╗
║   NexusNode Core — Team Red X Premium Edition                ║
║   Automated Deployment v1.0.0                                ║
║   — by Abdul Rehman Rajpoot                                  ║
╚══════════════════════════════════════════════════════════════╝
${NC}"

# ── OS check ──────────────────────────────────────────────────
if [[ "$OSTYPE" != "linux"* ]]; then
  err "Linux required. Detected: $OSTYPE"
fi
log "OS: $(uname -sr)"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/server"

# ── Node.js ───────────────────────────────────────────────────
install_node() {
  warn "Installing Node.js 18 LTS..."
  if command -v apt-get &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - 2>/dev/null
    sudo apt-get install -y nodejs 2>/dev/null
  elif command -v yum &>/dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash - 2>/dev/null
    sudo yum install -y nodejs 2>/dev/null
  else
    err "Package manager not found. Install Node.js 18 manually."
  fi
}

if command -v node &>/dev/null; then
  NODE_VER=$(node -v | cut -dv -f2 | cut -d. -f1)
  if [[ "$NODE_VER" -lt 18 ]]; then
    warn "Node.js $NODE_VER detected — need 18+"
    install_node
  else
    log "Node.js: $(node -v)"
  fi
else
  install_node
  log "Node.js: $(node -v)"
fi

# ── Docker ────────────────────────────────────────────────────
if command -v docker &>/dev/null; then
  log "Docker: $(docker --version | cut -d' ' -f3 | tr -d ',')"
  # Ensure daemon running
  if ! docker info &>/dev/null 2>&1; then
    warn "Docker daemon not running. Starting..."
    sudo systemctl start docker 2>/dev/null || sudo service docker start 2>/dev/null || true
    sleep 2
    docker info &>/dev/null || err "Docker daemon failed to start. Check manually."
  fi
else
  warn "Docker not found. Installing..."
  curl -fsSL https://get.docker.com | sudo bash
  sudo usermod -aG docker "$USER" 2>/dev/null || true
  sudo systemctl enable docker 2>/dev/null || true
  sudo systemctl start docker 2>/dev/null || true
  log "Docker installed: $(docker --version)"
fi

# ── PM2 ───────────────────────────────────────────────────────
if ! command -v pm2 &>/dev/null; then
  warn "PM2 not found. Installing globally..."
  sudo npm install -g pm2 --quiet
  log "PM2: $(pm2 --version)"
else
  log "PM2: $(pm2 --version)"
fi

# ── npm install ───────────────────────────────────────────────
info "Installing server dependencies..."
cd "$SERVER_DIR"
npm install --production --silent
log "npm dependencies installed"

# ── Initialize database ───────────────────────────────────────
info "Initializing database..."
node -e "
const bcrypt = require('bcryptjs');
const fs     = require('fs');
const dbPath = './database.json';
let db = { users: [], containers: [], messages: [] };

if (fs.existsSync(dbPath)) {
  try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); }
  catch(e) { db = { users: [], containers: [], messages: [] }; }
}
if (!db.users) db.users = [];
if (!db.containers) db.containers = [];
if (!db.messages) db.messages = [];

if (!db.users.find(u => u.username === 'admin')) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.users.push({
    id: 'u_admin_001',
    username: 'admin',
    password: hash,
    plan: 'premium',
    role: 'admin',
    suspended: false,
    createdAt: new Date().toISOString()
  });
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  console.log('Admin user created.');
} else {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  console.log('Database OK — admin already exists.');
}
"
log "Database ready"

# ── Pull base Docker images (optional, background) ────────────
info "Pre-pulling common Docker images in background..."
{
  docker pull node:18-alpine &>/dev/null
  docker pull ubuntu:22.04   &>/dev/null
} &

# ── Start with PM2 ────────────────────────────────────────────
info "Starting NexusNode Core with PM2..."
pm2 delete nexusnode-core 2>/dev/null || true
pm2 start "$SERVER_DIR/server.js" \
  --name "nexusnode-core" \
  --node-args="--max-old-space-size=512" \
  --restart-delay=2000 \
  --max-restarts=50 \
  --watch false \
  --log "$SCRIPT_DIR/nexusnode.log" \
  --error "$SCRIPT_DIR/nexusnode-err.log"

pm2 save --force 2>/dev/null || true

# Try enabling startup (non-fatal)
pm2 startup 2>/dev/null | tail -1 | bash 2>/dev/null || true

# ── Wait for server ───────────────────────────────────────────
info "Waiting for server to come online..."
for i in {1..15}; do
  sleep 1
  if curl -sf http://localhost:5000/api/stats -H "Authorization: Bearer x" &>/dev/null 2>&1 || \
     curl -sf http://localhost:5000/ &>/dev/null 2>&1; then
    break
  fi
  if [[ $i -eq 15 ]]; then
    warn "Server may still be starting. Check logs: pm2 logs nexusnode-core"
  fi
done

# ── Done ──────────────────────────────────────────────────────
echo -e "${GREEN}${BOLD}
╔══════════════════════════════════════════════════════════════╗
║   ✅  NEXUSNODE CORE DEPLOYED SUCCESSFULLY                   ║
╠══════════════════════════════════════════════════════════════╣
║   URL    : http://localhost:5000                             ║
║   User   : admin                                            ║
║   Pass   : admin123    ← CHANGE THIS IMMEDIATELY            ║
╠══════════════════════════════════════════════════════════════╣
║   PM2 commands:                                             ║
║     pm2 logs nexusnode-core   (live logs)                   ║
║     pm2 restart nexusnode-core                              ║
║     pm2 stop nexusnode-core                                 ║
╠══════════════════════════════════════════════════════════════╣
║   WhatsApp : +923009842133                                  ║
║   Telegram : https://t.me/TeamRedxhacker2                   ║
║   YouTube  : https://youtube.com/@rootmindtech              ║
╠══════════════════════════════════════════════════════════════╣
║   — by Abdul Rehman Rajpoot                                 ║
╚══════════════════════════════════════════════════════════════╝
${NC}"

pm2 logs nexusnode-core --lines 8 --nostream 2>/dev/null || true
