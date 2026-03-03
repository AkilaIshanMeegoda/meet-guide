#!/bin/bash

################################################################################
# MiroTalk Per-Participant Recording Services Installer
# This script installs and starts the recording watcher service
################################################################################

set -e

echo "=================================="
echo "MiroTalk Recording Services Setup"
echo "=================================="
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  This script requires sudo privileges"
    echo "Please run: sudo bash $0"
    exit 1
fi

MIROTALK_DIR="/home/ubuntu/mirotalk"
SYSTEMD_DIR="/etc/systemd/system"

echo "📋 Step 1: Creating required directories..."
mkdir -p /var/recordings/meetings
mkdir -p /var/log
chown -R ubuntu:ubuntu /var/recordings
chmod -R 755 /var/recordings
echo "   ✅ Directories created and permissions set"

echo ""
echo "📋 Step 2: Installing recording-watcher service..."
if [ -f "$MIROTALK_DIR/recording-watcher.service" ]; then
    cp "$MIROTALK_DIR/recording-watcher.service" "$SYSTEMD_DIR/"
    echo "   ✅ recording-watcher.service installed"
else
    echo "   ❌ Error: recording-watcher.service not found"
    exit 1
fi

echo ""
echo "📋 Step 3: Reloading systemd daemon..."
systemctl daemon-reload
echo "   ✅ Systemd daemon reloaded"

echo ""
echo "📋 Step 4: Enabling service to start on boot..."
systemctl enable recording-watcher
echo "   ✅ Service enabled"

echo ""
echo "📋 Step 5: Starting service..."
systemctl start recording-watcher
sleep 2
echo "   ✅ Service started"

echo ""
echo "📋 Step 6: Verifying service status..."
echo ""
echo "--- Recording Watcher Status ---"
systemctl status recording-watcher --no-pager | head -10

echo ""
echo "=================================="
echo "✅ Installation Complete!"
echo "=================================="
echo ""
echo "Service is now running and will auto-start on boot."
echo ""
echo "To check logs:"
echo "  • Watcher: tail -f /var/log/recording-watcher.log"
echo ""
echo "To manage service:"
echo "  • Status:  sudo systemctl status recording-watcher"
echo "  • Stop:    sudo systemctl stop recording-watcher"
echo "  • Restart: sudo systemctl restart recording-watcher"
echo ""
