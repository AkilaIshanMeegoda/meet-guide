#!/bin/bash

################################################################################
# Janus WebRTC Server Installation Script for Ubuntu 22.04
# Purpose: Install Janus with recording capabilities for per-participant audio
# Target: EC2 Ubuntu 22.04 or local development
################################################################################

set -e

echo "======================================"
echo "Janus WebRTC Server Installation"
echo "Ubuntu 22.04 - Audio Recording Setup"
echo "======================================"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   log_error "This script should not be run as root. Run as normal user with sudo privileges."
   exit 1
fi

# Update system
log_info "Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Install essential dependencies
log_info "Installing build essentials and dependencies..."
sudo apt-get install -y \
    build-essential \
    git \
    cmake \
    pkg-config \
    gengetopt \
    libtool \
    automake \
    autoconf \
    gtk-doc-tools \
    libglib2.0-dev \
    libjansson-dev \
    libssl-dev \
    libsofia-sip-ua-dev \
    libopus-dev \
    libogg-dev \
    libcurl4-openssl-dev \
    liblua5.3-dev \
    libconfig-dev \
    libnice-dev \
    libsrtp2-dev \
    libwebsockets-dev \
    libmicrohttpd-dev \
    libnanomsg-dev \
    librabbitmq-dev \
    libavutil-dev \
    libavcodec-dev \
    libavformat-dev \
    libavdevice-dev \
    ffmpeg

# Install libnice (if not recent enough)
log_info "Checking libnice version..."
LIBNICE_VERSION=$(pkg-config --modversion nice 2>/dev/null || echo "0.0.0")
if [[ "$LIBNICE_VERSION" < "0.1.18" ]]; then
    log_warn "Building libnice from source..."
    cd /tmp
    git clone https://gitlab.freedesktop.org/libnice/libnice.git
    cd libnice
    git checkout 0.1.21
    meson builddir
    ninja -C builddir
    sudo ninja -C builddir install
    sudo ldconfig
    cd /tmp
    rm -rf libnice
fi

# Install libsrtp (ensure version 2.x)
log_info "Checking libsrtp version..."
if ! pkg-config --exists libsrtp2; then
    log_warn "Building libsrtp2 from source..."
    cd /tmp
    wget https://github.com/cisco/libsrtp/archive/v2.5.0.tar.gz
    tar xfv v2.5.0.tar.gz
    cd libsrtp-2.5.0
    ./configure --prefix=/usr --enable-openssl
    make shared_library
    sudo make install
    sudo ldconfig
    cd /tmp
    rm -rf libsrtp-2.5.0 v2.5.0.tar.gz
fi

# Install usrsctp (for DataChannel support)
log_info "Installing usrsctp..."
cd /tmp
git clone https://github.com/sctplab/usrsctp
cd usrsctp
./bootstrap
./configure --prefix=/usr
make
sudo make install
sudo ldconfig
cd /tmp
rm -rf usrsctp

# Install Janus WebRTC Server
log_info "Cloning Janus Gateway..."
cd /opt
sudo git clone https://github.com/meetecho/janus-gateway.git
sudo chown -R $USER:$USER janus-gateway
cd janus-gateway

log_info "Checking out stable version..."
git checkout v1.2.2  # Use stable release

log_info "Configuring Janus with recording support..."
sh autogen.sh

# Configure with all needed plugins
./configure \
    --prefix=/opt/janus \
    --enable-post-processing \
    --enable-plugin-audiobridge \
    --enable-plugin-videoroom \
    --enable-plugin-streaming \
    --enable-plugin-recordplay \
    --enable-rest \
    --enable-websockets \
    --enable-rabbitmq \
    --enable-mqtt \
    --enable-data-channels

log_info "Building Janus (this may take several minutes)..."
make -j$(nproc)

log_info "Installing Janus..."
sudo make install
sudo make configs

# Configure library path
echo "/opt/janus/lib" | sudo tee /etc/ld.so.conf.d/janus.conf
sudo ldconfig

# Create recordings directory structure
log_info "Creating recording directories..."
sudo mkdir -p /var/recordings/meetings
sudo mkdir -p /var/transcribe/jobs
sudo chown -R $USER:$USER /var/recordings
sudo chown -R $USER:$USER /var/transcribe

# Create Janus config directory if it doesn't exist
sudo mkdir -p /opt/janus/etc/janus

# Create systemd service for Janus
log_info "Creating systemd service..."
sudo tee /etc/systemd/system/janus.service > /dev/null <<EOF
[Unit]
Description=Janus WebRTC Server
After=network.target

[Service]
Type=simple
ExecStart=/opt/janus/bin/janus --config /opt/janus/etc/janus/janus.jcfg
Restart=on-failure
RestartSec=5s
User=$USER
Group=$USER

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/recordings /var/transcribe /tmp

[Install]
WantedBy=multi-user.target
EOF

# Enable but don't start yet (needs configuration)
sudo systemctl daemon-reload
sudo systemctl enable janus

log_info "Installing Node.js and npm (for recorder service)..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

log_info "Verifying installations..."
echo "Janus version: $(/opt/janus/bin/janus --version || echo 'Not found')"
echo "FFmpeg version: $(ffmpeg -version | head -n1)"
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

echo ""
log_info "======================================"
log_info "Janus installation completed!"
log_info "======================================"
echo ""
log_warn "NEXT STEPS:"
echo "  1. Configure Janus settings in /opt/janus/etc/janus/"
echo "     - Copy janus.jcfg.example from deploy/janus/ directory"
echo "     - Set your public IP in nat.1_1_mapping"
echo "     - Configure STUN/TURN servers"
echo "  2. Configure firewall (see README.md)"
echo "  3. Install and configure recorder service"
echo "  4. Start Janus: sudo systemctl start janus"
echo "  5. Check logs: journalctl -u janus -f"
echo ""
log_warn "IMPORTANT: Update the following configuration:"
echo "  - /opt/janus/etc/janus/janus.jcfg -> Set nat_1_1_mapping to your public IP"
echo "  - /opt/janus/etc/janus/janus.transport.http.jcfg -> Enable CORS for your domain"
echo "  - /opt/janus/etc/janus/janus.plugin.audiobridge.jcfg -> Enable recording"
echo ""
