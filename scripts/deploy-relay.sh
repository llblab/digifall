#!/usr/bin/env bash
set -e

# Output formatting functions for status messages
log() {
    echo -e "\033[0;32m[INFO]\033[0m $1"
}

warn() {
    echo -e "\033[0;33m[WARN]\033[0m $1"
}

error() {
    echo -e "\033[0;31m[ERROR]\033[0m $1"
    exit 1
}

# Verify root privileges
if [ "$(id -u)" != "0" ]; then
    error "This script must be run as root (sudo)"
fi

# Determine execution mode (interactive vs automated)
INTERACTIVE=$([ -t 0 ] && echo true || echo false)
[ "$INTERACTIVE" = false ] && warn "Running in non-interactive mode. Using default values."

# Configuration defaults
APP_DIR="/opt/digifall"
DEFAULT_DOMAIN="relay.digifall.app"
DEFAULT_EMAIL="shlavik@gmail.com"
DEFAULT_RESTART_FREQUENCY="daily"

# Collect configuration in interactive mode
if [ "$INTERACTIVE" = true ]; then
    read -p "Enter domain for the relay service [$DEFAULT_DOMAIN]: " DOMAIN
    read -p "Enter email for Let's Encrypt certificate [$DEFAULT_EMAIL]: " EMAIL
    read -p "Enter server reboot frequency [$DEFAULT_RESTART_FREQUENCY]: " RESTART_FREQUENCY
fi

# Apply defaults for any unspecified values
DOMAIN=${DOMAIN:-$DEFAULT_DOMAIN}
EMAIL=${EMAIL:-$DEFAULT_EMAIL}
RESTART_FREQUENCY=${RESTART_FREQUENCY:-$DEFAULT_RESTART_FREQUENCY}

log "Using domain: $DOMAIN"

# Install required dependencies based on distribution
if command -v apt-get &>/dev/null; then
    log "Installing dependencies with apt..."

    # Setup NodeSource for Node.js 24
    if ! command -v node &>/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 18 ]; then
        curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
    fi

    apt-get update
    apt-get install -y git nginx certbot python3-certbot-nginx nodejs lsof curl

    # Configure firewall for Debian/Ubuntu
    if command -v ufw &>/dev/null; then
        log "Configuring firewall for HTTP and HTTPS"
        ufw allow 80/tcp || warn "Failed to allow HTTP in firewall"
        ufw allow 443/tcp || warn "Failed to allow HTTPS in firewall"
    fi
elif command -v dnf &>/dev/null; then
    log "Installing dependencies with dnf..."

    # Setup NodeSource for Node.js 24
    if ! command -v node &>/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 18 ]; then
        curl -fsSL https://rpm.nodesource.com/setup_24.x | bash -
    fi

    dnf install -y git nginx certbot python3-certbot-nginx nodejs lsof curl policycoreutils-python-utils

    # Configure firewall for Fedora/RHEL
    if command -v firewall-cmd &>/dev/null; then
        log "Configuring firewall for HTTP and HTTPS"
        firewall-cmd --permanent --add-service=http || warn "Failed to add HTTP to firewall"
        firewall-cmd --permanent --add-service=https || warn "Failed to add HTTPS to firewall"
        firewall-cmd --reload || warn "Failed to reload firewall"
    fi
else
    error "Unsupported package manager. This script requires apt or dnf."
fi

# Set up application code repository
if [ -d "$APP_DIR" ]; then
    log "Repository directory exists, updating..."
    cd "$APP_DIR"
    git fetch origin
    git checkout -B main origin/main
else
    log "Cloning repository..."
    git clone https://github.com/llblab/digifall.git "$APP_DIR" || error "Failed to clone repository"
    cd "$APP_DIR"
fi

# Install dependencies
log "Installing Node.js dependencies (production only)..."
npm install --omit=dev || error "Failed to install Node.js dependencies"

# Create dedicated user for the service
if ! id -u digifall > /dev/null 2>&1; then
    log "Creating dedicated user 'digifall'"
    useradd -r -s /bin/false digifall
fi

# Ensure permissions
chown -R digifall:digifall "$APP_DIR"
# Ensure the peerstore directory is writable if it exists or will be created
mkdir -p "$APP_DIR/nodes/relay/peerstore"
chown -R digifall:digifall "$APP_DIR/nodes/relay/peerstore"

# Start the application temporarily as digifall user to verify it works
log "Starting application temporarily for 5 seconds..."
cd "$APP_DIR" && sudo -u digifall npm run relay &
APP_PID=$!
sleep 5

# Terminate the application
if ps -p $APP_PID > /dev/null; then
    log "Stopping temporary application instance..."
    kill $APP_PID
    sleep 2
    kill -9 $APP_PID 2>/dev/null || true
fi

# Check for and stop any existing services on port 80
log "Checking for services using port 80..."
if lsof -i :80 > /dev/null 2>&1; then
    log "Port 80 is already in use. Stopping conflicting services..."
    systemctl stop apache2 2>/dev/null || true
    systemctl stop httpd 2>/dev/null || true
    systemctl stop nginx 2>/dev/null || true
    sleep 2

    if lsof -i :80 > /dev/null 2>&1; then
        error "Port 80 is still in use. Please manually stop any services using port 80."
    fi
fi

# Create systemd service for application
log "Creating systemd service"
cat > /etc/systemd/system/digifall-relay.service << EOF
[Unit]
Description=Digifall Relay WebSocket Service
After=network.target

[Service]
Type=simple
User=digifall
Group=digifall
WorkingDirectory=$APP_DIR
ExecStart=$(which npm) run relay
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production
Environment=PORT=43210

[Install]
WantedBy=multi-user.target
EOF

# Create periodic service restart scheduler if enabled
if [ "$RESTART_FREQUENCY" != "0" ]; then
    log "Creating systemd timer for periodic service restart"
    cat > /etc/systemd/system/digifall-restart.timer << EOF
[Unit]
Description=Scheduled restart of the relay service

[Timer]
OnCalendar=$RESTART_FREQUENCY
Persistent=true

[Install]
WantedBy=timers.target
EOF

    cat > /etc/systemd/system/digifall-restart.service << EOF
[Unit]
Description=Restart the relay service
Wants=digifall-restart.timer

[Service]
Type=oneshot
ExecStart=/bin/systemctl try-restart digifall-relay.service

[Install]
WantedBy=multi-user.target
EOF
fi

# Create proper webroot directory for Let's Encrypt verification
log "Creating webroot directory for certificate validation"
mkdir -p /var/www/html/.well-known/acme-challenge
chmod -R 755 /var/www/html

# Set ownership based on distribution
if [ -f /etc/fedora-release ] || [ -f /etc/redhat-release ]; then
    chown -R nginx:nginx /var/www/html
else
    # Try different web server users for other distributions
    chown -R www-data:www-data /var/www/html 2>/dev/null || \
    chown -R nginx:nginx /var/www/html 2>/dev/null || \
    chown -R apache:apache /var/www/html 2>/dev/null || true
fi

# Fix SELinux context - this is critical for Fedora/RHEL
if command -v getenforce &>/dev/null && [ "$(getenforce)" = "Enforcing" ]; then
    log "Setting SELinux context for web content"
    semanage fcontext -a -t httpd_sys_content_t "/var/www/html(/.*)?" || warn "Failed to set SELinux context pattern"
    restorecon -Rv /var/www/html || warn "Failed to restore SELinux context"

    # Allow nginx to connect to network (needed for proxy)
    setsebool -P httpd_can_network_connect 1 || warn "Failed to set httpd_can_network_connect boolean"

    # Temporarily set SELinux to permissive mode for certificate acquisition
    log "Temporarily setting SELinux to permissive mode for certificate acquisition"
    CURRENT_MODE=$(getenforce)
    setenforce 0
fi

# Create Nginx configuration
log "Creating Nginx configuration"
NGINX_CONF_DIR="/etc/nginx/conf.d"
NGINX_CONF_FILE="$NGINX_CONF_DIR/digifall-relay.conf"

mkdir -p "$NGINX_CONF_DIR"

# Configuration for HTTP only first (for certificate acquisition)
cat > "$NGINX_CONF_FILE" << EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Let's Encrypt challenge path
    location /.well-known/acme-challenge/ {
        root /var/www/html;
        allow all;
    }

    # Return WebSocket message for all other HTTP traffic
    location / {
        return 200 "Only WebSocket connections are supported";
        add_header Content-Type text/plain;
    }
}
EOF

# Start Nginx with HTTP-only configuration
log "Starting Nginx with HTTP-only configuration"
nginx -t || error "Nginx configuration test failed"
systemctl restart nginx || error "Failed to start Nginx"
sleep 2

# Create test file to verify ACME challenge directory
TEST_FILE="/var/www/html/.well-known/acme-challenge/test-file"
echo "certbot-test" > "$TEST_FILE"
chmod 644 "$TEST_FILE"

# Obtain SSL certificate
log "Obtaining Let's Encrypt certificate for $DOMAIN"
certbot certonly --webroot -w /var/www/html -d "$DOMAIN" --non-interactive --agree-tos --email "$EMAIL" || \
    error "Failed to obtain certificate. Check /var/log/letsencrypt/letsencrypt.log for details."

# Cleanup test file
rm -f "$TEST_FILE"

# Create certbot renewal hook to reload nginx after certificate renewal
log "Creating certbot renewal hook"
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/digifall-nginx-reload.sh << 'HOOK_EOF'
#!/bin/bash
systemctl reload nginx
HOOK_EOF
chmod +x /etc/letsencrypt/renewal-hooks/deploy/digifall-nginx-reload.sh

# Restore SELinux if we temporarily disabled it
if [ -n "$CURRENT_MODE" ] && [ "$CURRENT_MODE" = "Enforcing" ]; then
    log "Restoring SELinux to enforcing mode"
    setenforce 1
fi

# Create final Nginx configuration with SSL
log "Creating final Nginx configuration with SSL"
cat > "$NGINX_CONF_FILE" << EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Let's Encrypt challenge path
    location /.well-known/acme-challenge/ {
        root /var/www/html;
        allow all;
    }

    # Redirect all other HTTP traffic to HTTPS
    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name $DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    # Security settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Return plain text message for normal HTTP requests
    location / {
        # For regular HTTP requests, return a plain text message
        if (\$http_upgrade != "websocket") {
            return 200 "Only WebSocket connections are supported";
            add_header Content-Type text/plain;
        }

        # WebSocket proxy configuration
        proxy_pass http://127.0.0.1:43210;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Test and restart Nginx
log "Testing final Nginx configuration"
nginx -t || error "Nginx configuration test failed"
systemctl restart nginx || error "Failed to restart Nginx"

# Enable and start services
log "Enabling and starting services"
systemctl daemon-reload
systemctl enable digifall-relay.service
systemctl enable nginx.service
[ "$RESTART_FREQUENCY" != "0" ] && systemctl enable digifall-restart.timer

systemctl start digifall-relay.service || error "Failed to start digifall-relay service"
[ "$RESTART_FREQUENCY" != "0" ] && systemctl start digifall-restart.timer || true

# Verify service status
DIGIFALL_STATUS=$(systemctl is-active digifall-relay.service)
NGINX_STATUS=$(systemctl is-active nginx.service)

if [ "$DIGIFALL_STATUS" = "active" ] && [ "$NGINX_STATUS" = "active" ]; then
    log "====== Installation Complete ======"
    log "Digifall Relay is running at: wss://$DOMAIN"
    log "Services status:"
    log "  - digifall-relay: $DIGIFALL_STATUS"
    if [ "$RESTART_FREQUENCY" != "0" ]; then
        TIMER_STATUS=$(systemctl is-active digifall-restart.timer)
        log "  - Service restart schedule: ${TIMER_STATUS} (${RESTART_FREQUENCY})"
    else
        log "  - Service restart schedule: disabled"
    fi
    log "  - nginx: $NGINX_STATUS"
    log "To view logs: journalctl -u digifall-relay"
else
    error "Services not running correctly. Check logs with: journalctl -u digifall-relay -u nginx"
fi
