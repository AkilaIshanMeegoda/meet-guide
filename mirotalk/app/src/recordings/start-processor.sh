#!/bin/bash

# MiroTalk Meeting Processor - Start Service Script
# This script starts the automatic meeting processor as a PM2 service

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    MiroTalk Meeting Auto-Processor Service                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Navigate to recordings directory
cd "$SCRIPT_DIR" || exit 1

# Check if process-meeting.js exists
if [ ! -f "process-meeting.js" ]; then
    echo -e "${RED}❌ Error: process-meeting.js not found!${NC}"
    echo "   Expected location: $SCRIPT_DIR/process-meeting.js"
    exit 1
fi

# Check if watch-and-process.js exists
if [ ! -f "watch-and-process.js" ]; then
    echo -e "${RED}❌ Error: watch-and-process.js not found!${NC}"
    echo "   Expected location: $SCRIPT_DIR/watch-and-process.js"
    exit 1
fi

echo -e "${GREEN}✓${NC} Found process-meeting.js"
echo -e "${GREEN}✓${NC} Found watch-and-process.js"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Error: Node.js is not installed${NC}"
    echo "   Please install Node.js first:"
    echo "   sudo apt install nodejs npm"
    exit 1
fi

echo -e "${GREEN}✓${NC} Node.js is installed: $(node --version)"

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠${NC}  PM2 is not installed. Installing PM2..."
    npm install -g pm2
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Error: Failed to install PM2${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓${NC} PM2 installed successfully"
else
    echo -e "${GREEN}✓${NC} PM2 is installed: $(pm2 --version)"
fi

echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Error: Failed to install dependencies${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓${NC} Dependencies installed"
    echo ""
fi

# Stop existing processor if running
echo -e "${YELLOW}🔄 Checking for existing service...${NC}"
pm2 describe meeting-processor &> /dev/null
if [ $? -eq 0 ]; then
    echo "   Stopping existing service..."
    pm2 delete meeting-processor 2>/dev/null
    echo -e "${GREEN}✓${NC} Stopped existing service"
else
    echo "   No existing service found"
fi

echo ""

# Start the processor
echo -e "${GREEN}🚀 Starting meeting processor service...${NC}"
pm2 start watch-and-process.js --name meeting-processor --log-date-format "YYYY-MM-DD HH:mm:ss"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error: Failed to start service${NC}"
    exit 1
fi

# Wait a moment for service to start
sleep 2

# Save PM2 configuration
echo ""
echo -e "${YELLOW}💾 Saving PM2 configuration...${NC}"
pm2 save

# Setup PM2 to start on boot
echo -e "${YELLOW}⚙️  Configuring PM2 startup...${NC}"
pm2 startup systemd -u $USER --hp $HOME 2>&1 | grep "sudo" | bash 2>/dev/null || true

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Service started successfully!${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

# Show status
pm2 list

echo ""
echo -e "${BLUE}📋 Service Information:${NC}"
echo "   Name: meeting-processor"
echo "   Script: watch-and-process.js"
echo "   Working Directory: $SCRIPT_DIR"
echo "   Scan Interval: 30 seconds"
echo ""
echo -e "${BLUE}📊 Useful Commands:${NC}"
echo "   View logs:       ${GREEN}pm2 logs meeting-processor${NC}"
echo "   View live logs:  ${GREEN}pm2 logs meeting-processor --lines 100${NC}"
echo "   Service status:  ${GREEN}pm2 status meeting-processor${NC}"
echo "   Restart service: ${GREEN}pm2 restart meeting-processor${NC}"
echo "   Stop service:    ${GREEN}pm2 stop meeting-processor${NC}"
echo "   Or use:          ${GREEN}./stop-processor.sh${NC}"
echo ""
echo -e "${GREEN}🎉 The service is now running and will automatically process completed meetings!${NC}"
echo ""
