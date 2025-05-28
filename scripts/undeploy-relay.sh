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

# Configuration
DEFAULT_DOMAIN="relay.digifall.app"
APP_DIR=""

# Collect configuration in interactive mode
if [ "$INTERACTIVE" = true ]; then
    warn "This will remove the Digifall relay service and related configurations."
    read -p "Enter domain of the relay to remove [$DEFAULT_DOMAIN]: " DOMAIN
    DOMAIN=${DOMAIN:-$DEFAULT_DOMAIN}

    # Try to find APP_DIR from systemd service
    if [ -f /etc/systemd/system/digifall-relay.service ]; then
        APP_DIR=$(grep "WorkingDirectory=" /etc/systemd/system/digifall-relay.service | cut -d= -f2)
    fi

    if [ -n "$APP_DIR" ]; then
        read -p "Remove application directory $APP_DIR? [y/N]: " REMOVE_APP
    else
        read -p "Enter application directory to remove (leave empty to skip): " APP_DIR
        [ -n "$APP_DIR" ] && REMOVE_APP="y"
    fi

    read -p "Remove digifall system user? [y/N]: " REMOVE_USER
    read -p "Remove Let's Encrypt certificate for $DOMAIN? [y/N]: " REMOVE_CERT

    log "Summary of actions:"
    log "  - Stop and disable digifall-relay service"
    log "  - Stop and disable digifall-restart timer (if exists)"
    log "  - Remove systemd service files"
    log "  - Remove nginx configuration for $DOMAIN"
    log "  - Remove certbot renewal hook"
    [ "$REMOVE_APP" = "y" ] || [ "$REMOVE_APP" = "Y" ] && log "  - Remove application directory: $APP_DIR"
    [ "$REMOVE_USER" = "y" ] || [ "$REMOVE_USER" = "Y" ] && log "  - Remove digifall system user"
    [ "$REMOVE_CERT" = "y" ] || [ "$REMOVE_CERT" = "Y" ] && log "  - Revoke and delete certificate for $DOMAIN"
    read -p "Proceed with uninstallation? [y/N]: " CONFIRM

    if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
        log "Uninstallation cancelled."
        exit 0
    fi
else
    warn "Running in non-interactive mode. Using defaults and removing all components."
    DOMAIN=${DOMAIN:-$DEFAULT_DOMAIN}
    REMOVE_APP="y"
    REMOVE_USER="y"
    REMOVE_CERT="y"

    # Try to find APP_DIR from systemd service
    if [ -f /etc/systemd/system/digifall-relay.service ]; then
        APP_DIR=$(grep "WorkingDirectory=" /etc/systemd/system/digifall-relay.service | cut -d= -f2)
    fi
fi

log "Starting Digifall relay uninstallation..."

# Stop and disable services
log "Stopping services..."

if systemctl is-active --quiet digifall-relay.service 2>/dev/null; then
    systemctl stop digifall-relay.service
    log "Stopped digifall-relay service"
fi

if systemctl is-active --quiet digifall-restart.timer 2>/dev/null; then
    systemctl stop digifall-restart.timer
    log "Stopped digifall-restart timer"
fi

if systemctl is-enabled --quiet digifall-relay.service 2>/dev/null; then
    systemctl disable digifall-relay.service
    log "Disabled digifall-relay service"
fi

if systemctl is-enabled --quiet digifall-restart.timer 2>/dev/null; then
    systemctl disable digifall-restart.timer
    log "Disabled digifall-restart timer"
fi

# Remove systemd service files
log "Removing systemd service files..."

if [ -f /etc/systemd/system/digifall-relay.service ]; then
    rm -f /etc/systemd/system/digifall-relay.service
    log "Removed digifall-relay.service"
fi

if [ -f /etc/systemd/system/digifall-restart.timer ]; then
    rm -f /etc/systemd/system/digifall-restart.timer
    log "Removed digifall-restart.timer"
fi

if [ -f /etc/systemd/system/digifall-restart.service ]; then
    rm -f /etc/systemd/system/digifall-restart.service
    log "Removed digifall-restart.service"
fi

systemctl daemon-reload
log "Reloaded systemd daemon"

# Remove nginx configuration
log "Removing nginx configuration..."

NGINX_CONF_FILE="/etc/nginx/conf.d/digifall-relay.conf"
if [ -f "$NGINX_CONF_FILE" ]; then
    rm -f "$NGINX_CONF_FILE"
    log "Removed $NGINX_CONF_FILE"

    # Test and reload nginx if it's running
    if systemctl is-active --quiet nginx 2>/dev/null; then
        if nginx -t 2>/dev/null; then
            systemctl reload nginx
            log "Reloaded nginx configuration"
        else
            warn "Nginx configuration test failed. Please check manually."
        fi
    fi
else
    warn "Nginx configuration file not found at $NGINX_CONF_FILE"
fi

# Remove certbot renewal hook
log "Removing certbot renewal hook..."
if [ -f /etc/letsencrypt/renewal-hooks/deploy/digifall-nginx-reload.sh ]; then
    rm -f /etc/letsencrypt/renewal-hooks/deploy/digifall-nginx-reload.sh
    log "Removed certbot renewal hook"
fi

# Remove Let's Encrypt certificate
if [ "$REMOVE_CERT" = "y" ] || [ "$REMOVE_CERT" = "Y" ]; then
    log "Removing Let's Encrypt certificate for $DOMAIN..."

    if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
        # Use certbot to properly remove the certificate
        if command -v certbot &>/dev/null; then
            certbot delete --cert-name "$DOMAIN" --non-interactive 2>/dev/null || \
                warn "Failed to delete certificate with certbot. May need manual removal."
            log "Removed certificate for $DOMAIN"
        else
            warn "certbot not found. Certificate files may remain in /etc/letsencrypt/"
        fi
    else
        warn "Certificate directory not found for $DOMAIN"
    fi
fi

# Remove application directory
if [ "$REMOVE_APP" = "y" ] || [ "$REMOVE_APP" = "Y" ]; then
    if [ -n "$APP_DIR" ] && [ -d "$APP_DIR" ]; then
        log "Removing application directory: $APP_DIR"
        rm -rf "$APP_DIR"
        log "Removed $APP_DIR"
    else
        warn "Application directory not found or not specified"
    fi
fi

# Remove digifall user
if [ "$REMOVE_USER" = "y" ] || [ "$REMOVE_USER" = "Y" ]; then
    if id -u digifall > /dev/null 2>&1; then
        log "Removing digifall system user..."

        # Kill any remaining processes owned by digifall
        pkill -u digifall 2>/dev/null || true

        # Remove the user
        if command -v userdel &>/dev/null; then
            userdel digifall 2>/dev/null || warn "Failed to remove digifall user"
            log "Removed digifall user"
        fi
    else
        warn "User 'digifall' does not exist"
    fi
fi

# Clean up ACME challenge directory (only the test file, not the whole directory)
if [ -f /var/www/html/.well-known/acme-challenge/test-file ]; then
    rm -f /var/www/html/.well-known/acme-challenge/test-file
    log "Cleaned up ACME test file"
fi

# Restore SELinux booleans on Fedora/RHEL (optional, as other services may need them)
if command -v getenforce &>/dev/null && [ "$(getenforce)" != "Disabled" ]; then
    log "Note: SELinux httpd_can_network_connect boolean was not reverted (may be used by other services)"
fi

log "Uninstallation complete"
log "Removed:"
log "  - digifall-relay systemd service"
log "  - digifall-restart timer and service"
log "  - Nginx configuration for $DOMAIN"
log "  - Certbot renewal hook"
[ "$REMOVE_APP" = "y" ] || [ "$REMOVE_APP" = "Y" ] && log "  - Application directory: $APP_DIR"
[ "$REMOVE_USER" = "y" ] || [ "$REMOVE_USER" = "Y" ] && log "  - digifall system user"
[ "$REMOVE_CERT" = "y" ] || [ "$REMOVE_CERT" = "Y" ] && log "  - Let's Encrypt certificate for $DOMAIN"
log "Not removed (may be used by other services): nginx, certbot, Node.js, /var/www/html"
