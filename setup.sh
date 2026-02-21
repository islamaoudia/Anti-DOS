#!/bin/bash
# ═══════════════════════════════════════════════════
#   🛡️  SENTINEL SHIELD - DEEP DIAGNOSTIC INSTALLER
#   Universal DDoS protection with Advanced Debugging
# ═══════════════════════════════════════════════════

set -e

echo ""
echo "  ╔═══════════════════════════════════════════════╗"
echo "  ║   🛡️  SENTINEL SHIELD INSTALLER  v2.6        ║"
echo "  ║      Enhanced Diagnostic Integration        ║"
echo "  ╚═══════════════════════════════════════════════╝"
echo ""

# 🚨 Git Bash / Windows Compatibility
export MSYS_NO_PATHCONV=1

# ──────────────────────────────────────────────────
# 1. PREREQUISITES & SYSTEM CHECKS
# ──────────────────────────────────────────────────

check_dep() {
    if ! [ -x "$(command -v $1)" ]; then
        echo "  ⚠️  Warning: $1 is not installed. Some diagnostics may be limited."
    else
        echo "  ✅ $1 detected."
    fi
}

check_dep "docker"
check_dep "curl"
check_dep "netstat"

if docker compose version &>/dev/null; then
  COMPOSE_CMD="docker compose"
else
  COMPOSE_CMD="docker-compose"
fi

# ──────────────────────────────────────────────────
# 2. INTERACTIVE CONFIGURATION
# ──────────────────────────────────────────────────

echo ""
echo "  ┌─────────────────────────────────────────────┐"
echo "  │         DEPLOYMENT CONFIGURATION             │"
echo "  └─────────────────────────────────────────────┘"
echo ""

read -rp "  1. What port is your server running on? (e.g. 3000): " TARGET_PORT
read -rp "  2. What port should Complex Shield listen on? (e.g. 80): " SHIELD_PORT
echo -n "  3. Choose a dashboard secret key: "
read -rs ADMIN_KEY
echo -e "\n"

# Validate Ports
if [[ ! "$SHIELD_PORT" =~ ^[0-9]+$ ]] || [[ ! "$TARGET_PORT" =~ ^[0-9]+$ ]]; then
    echo "❌ ERROR: Invalid port numbers."
    exit 1
fi

# 🔎 DIAGNOSTIC: Check if port is already in use on the host
echo "  🔍 Checking if port $SHIELD_PORT is available on host..."
if netstat -tuln | grep -q ":$SHIELD_PORT "; then
    echo "  ❌ ERROR: Port $SHIELD_PORT is ALREADY IN USE by another process!"
    echo "     Complex Shield cannot start unless this port is free."
    exit 1
fi
echo "  ✅ Port $SHIELD_PORT is free."

# ──────────────────────────────────────────────────
# 3. CLEANUP & PREP
# ──────────────────────────────────────────────────

echo "  🧹 Cleaning environment..."
$COMPOSE_CMD down --remove-orphans 2>/dev/null || true
docker rm -f sentinel-shield sentinel-redis 2>/dev/null || true

# ──────────────────────────────────────────────────
# 4. GENERATE FILES
# ──────────────────────────────────────────────────

echo "  ⚙️  Generating Deployment Assets..."

cat > .env <<ENVEOF
TARGET_PORT=${TARGET_PORT}
SHIELD_PORT=${SHIELD_PORT}
BACKEND_URL=http://host.docker.internal:${TARGET_PORT}
USE_REDIS=true
ADMIN_KEY=${ADMIN_KEY}
RL_CAPACITY=20
RL_REFILL_RATE=5
RL_TTL_SECONDS=600
ENVEOF

cat > docker-compose.yml <<COMPEOF
services:
  redis:
    image: redis:alpine
    container_name: sentinel-redis
    restart: always
    expose:
      - "6379"

  shield:
    build: 
      context: ./Shield-Proxy
    container_name: sentinel-shield
    restart: always
    depends_on:
      - redis
    ports:
      - "${SHIELD_PORT}:${SHIELD_PORT}"
    environment:
      - SHIELD_PORT=${SHIELD_PORT}
      - BACKEND_URL=http://host.docker.internal:${TARGET_PORT}
      - USE_REDIS=true
      - REDIS_URL=redis://redis:6379
      - ADMIN_KEY=${ADMIN_KEY}
    extra_hosts:
      - "host.docker.internal:host-gateway"
COMPEOF

# ──────────────────────────────────────────────────
# 5. BUILD & DEPLOY
# ──────────────────────────────────────────────────

echo "  🏗️  Building Security Layer..."
$COMPOSE_CMD build --pull

echo "  🚀 Starting Services..."
$COMPOSE_CMD up -d

# ──────────────────────────────────────────────────
# 6. DEEP DIAGNOSTICS
# ──────────────────────────────────────────────────

echo "  ⏳ Initializing diagnostics (10s)..."
sleep 10

echo ""
echo "  📊 --- DIAGNOSTIC REPORT ---"
echo "  ----------------------------"

# A. Container Status
if docker ps | grep -q sentinel-shield; then
    echo "  [1/4] Container: RUNNING ✅"
else
    echo "  [1/4] Container: CRASHED ❌"
    docker logs sentinel-shield
    exit 1
fi

# B. Internal Process Check
echo "  [2/4] Internal Process Check..."
if docker exec sentinel-shield netstat -tuln | grep ":$SHIELD_PORT" >/dev/null 2>&1; then
    echo "        Node.js is listening on port $SHIELD_PORT internally. ✅"
else
    echo "        ❌ Node.js IS NOT LISTENING inside the container!"
    docker logs sentinel-shield | tail -n 20
    exit 1
fi

# C. Docker Port Mapping Check
MAPPED=$(docker port sentinel-shield $SHIELD_PORT 2>/dev/null)
if [ -z "$MAPPED" ]; then
    echo "  [3/4] Port Mapping: FAILED ❌"
else
    echo "  [3/4] Port Mapping: $MAPPED ✅"
fi

# D. Firewall / Connectivity Check
echo "  [4/4] External Connectivity Test..."
if curl -s --max-time 3 "http://localhost:${SHIELD_PORT}/health" | grep -q "online" >/dev/null 2>&1; then
    echo "        Shield Health Check: OK ✅"
else
    echo "        ❌ Shield Health Check: FAILED (Possible Firewall issue)"
fi

echo "  ----------------------------"
echo ""
echo "  ✅ Setup Complete."
echo "  App: http://localhost:$SHIELD_PORT"
echo "  HUD: http://localhost:$SHIELD_PORT/sentinel"
echo ""
