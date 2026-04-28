#!/usr/bin/env bash
set -e

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

require_root() {
    if [ "$(id -u)" != "0" ]; then
        error "This script must be run as root (sudo)"
    fi
}

detect_interactive() {
    [ -t 0 ] && echo true || echo false
}

is_yes() {
    case "${1:-}" in
        y|Y|yes|YES|Yes) return 0 ;;
        *) return 1 ;;
    esac
}

get_systemd_working_directory() {
    local service_file="$1"
    [ -f "$service_file" ] || return 0
    grep "^WorkingDirectory=" "$service_file" | cut -d= -f2-
}

stop_disable_unit() {
    local unit="$1"
    if systemctl is-active --quiet "$unit" 2>/dev/null; then
        systemctl stop "$unit"
        log "Stopped $unit"
    fi
    if systemctl is-enabled --quiet "$unit" 2>/dev/null; then
        systemctl disable "$unit"
        log "Disabled $unit"
    fi
}

remove_file() {
    local file="$1"
    local label="${2:-$file}"
    if [ -f "$file" ]; then
        rm -f "$file"
        log "Removed $label"
    else
        warn "$label not found"
    fi
}

require_root

INTERACTIVE=$(detect_interactive)
DEFAULT_DOMAIN="relay.digifall.app"
SERVICE_FILE="/etc/systemd/system/digifall-relay.service"
RESTART_TIMER_FILE="/etc/systemd/system/digifall-restart.timer"
RESTART_SERVICE_FILE="/etc/systemd/system/digifall-restart.service"
NGINX_CONF_FILE="/etc/nginx/conf.d/digifall-relay.conf"
RENEWAL_HOOK_FILE="/etc/letsencrypt/renewal-hooks/deploy/digifall-nginx-reload.sh"
ACME_TEST_FILE="/var/www/html/.well-known/acme-challenge/test-file"
APP_DIR="${APP_DIR:-$(get_systemd_working_directory "$SERVICE_FILE")}"

print_summary() {
    log "Summary of actions:"
    log "  - Stop and disable digifall-relay.service"
    log "  - Stop and disable digifall-restart.timer if present"
    log "  - Remove systemd unit files"
    log "  - Remove nginx relay configuration for $DOMAIN"
    log "  - Remove certbot renewal hook"
    is_yes "$REMOVE_APP" && log "  - Remove application directory: $APP_DIR"
    is_yes "$REMOVE_USER" && log "  - Remove digifall system user"
    is_yes "$REMOVE_CERT" && log "  - Delete Let's Encrypt certificate for $DOMAIN"
}

confirm_interactive_options() {
    warn "This will remove the Digifall relay service and related configurations."
    read -p "Enter domain of the relay to remove [$DEFAULT_DOMAIN]: " DOMAIN
    DOMAIN=${DOMAIN:-$DEFAULT_DOMAIN}
    if [ -n "$APP_DIR" ]; then
        read -p "Remove application directory $APP_DIR? [y/N]: " REMOVE_APP
    else
        read -p "Enter application directory to remove (leave empty to skip): " APP_DIR
        [ -n "$APP_DIR" ] && REMOVE_APP="y" || REMOVE_APP="n"
    fi
    read -p "Remove digifall system user? [y/N]: " REMOVE_USER
    read -p "Remove Let's Encrypt certificate for $DOMAIN? [y/N]: " REMOVE_CERT
    print_summary
    read -p "Proceed with uninstallation? [y/N]: " CONFIRM
    if ! is_yes "$CONFIRM"; then
        log "Uninstallation cancelled."
        exit 0
    fi
}

set_noninteractive_options() {
    warn "Running in non-interactive mode. Using defaults and removing all components."
    DOMAIN=${DOMAIN:-$DEFAULT_DOMAIN}
    REMOVE_APP=${REMOVE_APP:-y}
    REMOVE_USER=${REMOVE_USER:-y}
    REMOVE_CERT=${REMOVE_CERT:-y}
}

reload_nginx_if_running() {
    command -v nginx &>/dev/null || return
    systemctl is-active --quiet nginx 2>/dev/null || return
    if nginx -t 2>/dev/null; then
        systemctl reload nginx
        log "Reloaded nginx configuration"
    else
        warn "Nginx configuration test failed. Please check manually."
    fi
}

remove_certificate() {
    is_yes "$REMOVE_CERT" || return
    log "Removing Let's Encrypt certificate for $DOMAIN..."
    if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
        warn "Certificate directory not found for $DOMAIN"
        return
    fi
    if ! command -v certbot &>/dev/null; then
        warn "certbot not found. Certificate files may remain in /etc/letsencrypt/"
        return
    fi
    certbot delete --cert-name "$DOMAIN" --non-interactive 2>/dev/null || warn "Failed to delete certificate with certbot. May need manual removal."
    log "Removed certificate for $DOMAIN"
}

remove_application_dir() {
    is_yes "$REMOVE_APP" || return
    if [ -z "$APP_DIR" ] || [ ! -d "$APP_DIR" ]; then
        warn "Application directory not found or not specified"
        return
    fi
    case "$APP_DIR" in
        /|/opt|/usr|/var|/home) error "Refusing to remove unsafe application directory: $APP_DIR" ;;
    esac
    log "Removing application directory: $APP_DIR"
    rm -rf "$APP_DIR"
    log "Removed $APP_DIR"
}

remove_digifall_user() {
    is_yes "$REMOVE_USER" || return
    if ! id -u digifall > /dev/null 2>&1; then
        warn "User 'digifall' does not exist"
        return
    fi
    log "Removing digifall system user..."
    pkill -u digifall 2>/dev/null || true
    if command -v userdel &>/dev/null; then
        userdel digifall 2>/dev/null || warn "Failed to remove digifall user"
        log "Removed digifall user"
    else
        warn "userdel not found. User 'digifall' was not removed."
    fi
}

if [ "$INTERACTIVE" = true ]; then
    confirm_interactive_options
else
    set_noninteractive_options
fi

log "Starting Digifall relay uninstallation..."
log "Stopping services..."
stop_disable_unit digifall-relay.service
stop_disable_unit digifall-restart.timer

log "Removing systemd service files..."
remove_file "$SERVICE_FILE" "digifall-relay.service"
remove_file "$RESTART_TIMER_FILE" "digifall-restart.timer"
remove_file "$RESTART_SERVICE_FILE" "digifall-restart.service"
systemctl daemon-reload
log "Reloaded systemd daemon"

log "Removing nginx configuration..."
remove_file "$NGINX_CONF_FILE"
reload_nginx_if_running

log "Removing certbot renewal hook..."
remove_file "$RENEWAL_HOOK_FILE" "certbot renewal hook"
remove_certificate
remove_application_dir
remove_digifall_user
remove_file "$ACME_TEST_FILE" "ACME test file"

if command -v getenforce &>/dev/null && [ "$(getenforce)" != "Disabled" ]; then
    log "SELinux httpd_can_network_connect was not reverted because other services may use it"
fi

log "Uninstallation complete"
log "Not removed because they may be shared: nginx, certbot, Node.js, /var/www/html"
