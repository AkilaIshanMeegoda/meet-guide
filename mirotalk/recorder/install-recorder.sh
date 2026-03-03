#!/bin/bash

################################################################################
# Recorder Service Installation Script
# Purpose: Install and configure the Janus recorder service
################################################################################

set -e

echo "======================================"
echo "Janus Recorder Service Installation"
echo "======================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "Error: ffmpeg is not installed. Please install ffmpeg first."
    exit 1
fi

# Create recorder user
if ! id -u recorder &>/dev/null; then
    echo "Creating recorder user..."
    sudo useradd -r -s /bin/false recorder
fi

# Create installation directory
echo "Creating installation directory..."
sudo mkdir -p /opt/janus-recorder
sudo cp package.json /opt/janus-recorder/
sudo cp index.js /opt/janus-recorder/

# Install dependencies
echo "Installing Node.js dependencies..."
cd /opt/janus-recorder
sudo npm install --production

# Create directories with proper permissions
echo "Creating recording directories..."
sudo mkdir -p /var/recordings/meetings
sudo mkdir -p /var/transcribe/jobs
sudo mkdir -p /var/log

sudo chown -R recorder:recorder /var/recordings
sudo chown -R recorder:recorder /var/transcribe
sudo chown -R recorder:recorder /var/log
sudo chown -R recorder:recorder /opt/janus-recorder

# Install systemd service
echo "Installing systemd service..."
sudo cp recorder.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable service
sudo systemctl enable recorder

echo ""
echo "======================================"
echo "Recorder service installed!"
echo "======================================"
echo ""
echo "NEXT STEPS:"
echo "  1. Edit /etc/systemd/system/recorder.service to configure environment variables"
echo "  2. Start the service: sudo systemctl start recorder"
echo "  3. Check status: sudo systemctl status recorder"
echo "  4. View logs: journalctl -u recorder -f"
echo ""
