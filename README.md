# NexusNode Core — Team Red X Premium Edition

> **24/7 VPS Management Panel | Docker Container Control | Live Chat | Cyberpunk UI**
>
> — by Abdul Rehman Rajpoot

---

## 📁 File Structure

```
nexusnode/
├── server/
│   ├── server.js       ← Express + Socket.io + Dockerode backend
│   ├── package.json    ← Dependencies
│   └── database.json   ← JSON flat-file DB (auto-created on setup)
├── public/
│   ├── index.html      ← Cyberpunk login page
│   └── dashboard.html  ← Full admin/user dashboard SPA
└── setup.sh            ← One-click Linux deployment
```

---

## ⚡ GitHub Codespaces — Quick Deploy

### Step 1 — Open your repo in Codespaces
Fork or push this project to your GitHub repo, then click  
**Code → Codespaces → Create codespace on main**

### Step 2 — Run setup
```bash
chmod +x setup.sh
bash setup.sh
```

### Step 3 — Access the panel
Codespaces will show a **port 5000 notification** — click **Open in Browser**.  
Or go to the **Ports** tab → find port 5000 → click the globe icon.

### Step 4 — Login
| Field    | Value      |
|----------|------------|
| Username | `admin`    |
| Password | `admin123` |

> ⚠️ **Change the admin password immediately after first login** (delete + recreate user in Users tab).

---

## 🛠️ Manual Start (without setup.sh)

```bash
cd server
npm install
node server.js
```

---

## 🔄 PM2 Commands (after setup.sh)

```bash
pm2 status                        # check status
pm2 logs nexusnode-core           # live logs
pm2 restart nexusnode-core        # restart
pm2 stop nexusnode-core           # stop
pm2 delete nexusnode-core         # remove from PM2
```

---

## 🌍 Environment Variables

| Variable     | Default                          | Description          |
|--------------|----------------------------------|----------------------|
| `PORT`       | `5000`                           | Server port          |
| `JWT_SECRET` | `NEXUSNODE_REDX_ULTRA_SECRET...` | JWT signing key      |

Set before start:
```bash
export PORT=5000
export JWT_SECRET=your_super_secret_key
node server.js
```

---

## 📦 Container Templates

| Template         | Image                     | Default Port |
|------------------|---------------------------|-------------|
| WhatsApp Node.js | `node:18-alpine`          | 3000        |
| WhatsApp PHP     | `php:8.2-apache`          | 80          |
| Minecraft Paper  | `itzg/minecraft-server`   | 25565       |
| Ubuntu Base      | `ubuntu:22.04`            | 22          |

---

## 👑 Membership Plans

| Feature            | Free    | Premium   |
|--------------------|---------|-----------|
| Containers         | 1 max   | Unlimited |
| RAM                | 1 GB    | 16 GB     |
| CPU quota          | 25%     | 100%      |
| Port routing       | Shared  | Dedicated |
| Priority support   | ✗       | ✓         |

---

## 📞 Contact & Community

| Channel     | Link |
|-------------|------|
| WhatsApp    | +923009842133 |
| Telegram    | https://t.me/TeamRedxhacker2 |
| YouTube     | https://youtube.com/@rootmindtech |
| GitHub      | https://github.com/AbdulRehman19721986/redxbot302 |
| WA Group    | https://chat.whatsapp.com/LhSmx2SeXX75r8I2bxsNDo |

---

```
============================================================
— by Abdul Rehman Rajpoot
============================================================
```
