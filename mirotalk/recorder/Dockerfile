FROM node:18-alpine

# Install ffmpeg
RUN apk add --no-cache ffmpeg

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY index.js ./

# Create directories for recordings and logs
RUN mkdir -p /var/recordings/meetings && \
    mkdir -p /var/log

# Non-root user
RUN addgroup -g 1001 recorder && \
    adduser -D -u 1001 -G recorder recorder && \
    chown -R recorder:recorder /app /var/recordings /var/log

USER recorder

# Expose recorder API port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the recorder service
CMD ["node", "index.js"]
