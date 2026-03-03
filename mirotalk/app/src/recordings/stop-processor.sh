#!/bin/bash

# MiroTalk Meeting Processor - Stop Service Script
# This script stops the automatic meeting processor service

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    MiroTalk Meeting Auto-Processor Service                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}❌ Error: PM2 is not installed${NC}"
    exit 1
fi

# Check if service is running
pm2 describe meeting-processor &> /dev/null
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠${NC}  Service 'meeting-processor' is not running"
    echo ""
    pm2 list
    exit 0
fi

echo -e "${YELLOW}🛑 Stopping meeting processor service...${NC}"

# Stop the service
pm2 stop meeting-processor

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Service stopped"
else
    echo -e "${RED}❌ Failed to stop service${NC}"
    exit 1
fi

# Delete the service
echo -e "${YELLOW}🗑️  Removing service from PM2...${NC}"
pm2 delete meeting-processor

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Service removed"
else
    echo -e "${RED}❌ Failed to remove service${NC}"
    exit 1
fi

# Save PM2 configuration
pm2 save

echo ""
echo -e "${GREEN}✅ Service stopped successfully!${NC}"
echo ""

# Show remaining PM2 processes
pm2 list

echo ""
echo -e "${BLUE}To start the service again:${NC}"
echo "   ./start-processor.sh"
echo ""
