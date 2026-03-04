// Windows-local PM2 config — mirrors ecosystem.config.js but with Windows paths.
// The original ecosystem.config.js must NOT be changed; it is used on the Ubuntu EC2.
// Usage:  pm2 start ecosystem.windows.config.js

const BASE = 'D:\\Research';
const LOGS = `${BASE}\\logs`;

module.exports = {
  apps: [
    // ============================================
    // 1. MiroTalk SFU — Video Conferencing Server
    // ============================================
    {
      name: 'mirotalk-sfu',
      script: 'app/src/Server.js',
      cwd: `${BASE}\\mirotalk`,
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      error_file: `${LOGS}\\mirotalk-error.log`,
      out_file:   `${LOGS}\\mirotalk-out.log`,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },

    // ============================================
    // 2. Meeting Processor — Recording Watcher
    // ============================================
    {
      name: 'meeting-processor',
      script: 'app/src/recordings/watch-and-process.js',
      cwd: `${BASE}\\mirotalk`,
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      error_file: `${LOGS}\\meeting-processor-error.log`,
      out_file:   `${LOGS}\\meeting-processor-out.log`,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },

    // ============================================
    // 3. MeetGuide Backend — Express.js API
    // ============================================
    {
      name: 'meetguide-backend',
      script: 'src/index.js',
      cwd: `${BASE}\\meet-guide-backend`,
      env: {
        NODE_ENV: 'production',
        PORT: 8000,
        // Point to the local Python executable.
        // If you have a venv, replace with its absolute path, e.g.:
        //   D:\\Research\\meet-guide-components\\meeting-summarization-system\\venv\\Scripts\\python.exe
        PYTHON_PATH: 'python',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      error_file: `${LOGS}\\backend-error.log`,
      out_file:   `${LOGS}\\backend-out.log`,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },

    // ============================================
    // 4. MeetGuide Frontend — Next.js
    // ============================================
    {
      name: 'meetguide-frontend',
      // Point directly to the Next.js JS binary so PM2 can run it with Node.
      // Using next.cmd fails because PM2 always passes the script to Node.js.
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 4001',
      cwd: `${BASE}\\meet-guide-app`,
      exec_mode: 'fork',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        PORT: 4001,
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      error_file: `${LOGS}\\frontend-error.log`,
      out_file:   `${LOGS}\\frontend-out.log`,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
