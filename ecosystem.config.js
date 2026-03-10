module.exports = {
  apps: [
    // ============================================
    // 1. MiroTalk SFU — Video Conferencing Server
    // ============================================
    {
      name: 'mirotalk-sfu',
      script: 'app/src/Server.js',
      cwd: '/home/ubuntu/Final_MeetGuide/mirotalk',
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      error_file: '/home/ubuntu/Final_MeetGuide/logs/mirotalk-error.log',
      out_file: '/home/ubuntu/Final_MeetGuide/logs/mirotalk-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },

    // ============================================
    // 2. Meeting Processor — Recording Watcher
    // ============================================
    {
      name: 'meeting-processor',
      script: 'app/src/recordings/watch-and-process.js',
      cwd: '/home/ubuntu/Final_MeetGuide/mirotalk',
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      error_file: '/home/ubuntu/Final_MeetGuide/logs/meeting-processor-error.log',
      out_file: '/home/ubuntu/Final_MeetGuide/logs/meeting-processor-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },

    // ============================================
    // 3. MeetGuide Backend — Express.js API
    //    (Auto-starts summarization + recording watcher internally)
    // ============================================
    {
      name: 'meetguide-backend',
      script: 'src/index.js',
      cwd: '/home/ubuntu/Final_MeetGuide/meet-guide-backend',
      env: {
        NODE_ENV: 'production',
        PORT: 8000,
        PYTHON_PATH: '/home/ubuntu/Final_MeetGuide/meet-guide-components/meeting-summarization-system/venv/bin/python3',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      error_file: '/home/ubuntu/Final_MeetGuide/logs/backend-error.log',
      out_file: '/home/ubuntu/Final_MeetGuide/logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },

    // ============================================
    // 4. MeetGuide Frontend — Next.js
    // ============================================
    {
      name: 'meetguide-frontend',
      script: 'npm',
      args: 'start -- -p 4001',
      cwd: '/home/ubuntu/Final_MeetGuide/meet-guide-app',
      env: {
        NODE_ENV: 'production',
        PORT: 4001,
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      error_file: '/home/ubuntu/Final_MeetGuide/logs/frontend-error.log',
      out_file: '/home/ubuntu/Final_MeetGuide/logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};