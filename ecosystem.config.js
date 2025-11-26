module.exports = {
  apps: [
    {
      name: 'zd-api',
      script: './dist/index.js',
      cwd: '/www/wwwroot/zd-api.wenbita.cn',
      env: {
        NODE_ENV: 'production',
        HOME: '/root',
        PATH: '/root/.nvm/versions/node/v18.0.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin'
      },
      instances: 2,
      exec_mode: 'cluster',
      merge_logs: true,
      autorestart: true,
      watch: ['src'],
      ignore_watch: ['node_modules', 'dist', 'logs', '.git'],
      watch_delay: 1000,
      max_memory_restart: '1G',
      out_file: '/www/wwwlogs/zd-api-out.log',
      error_file: '/www/wwwlogs/zd-api-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      listen_timeout: 10000,
      kill_timeout: 5000
    },
    {
      name: 'zd-h5',
      script: 'serve',
      args: 'dist -l 3001 -s',
      cwd: '/www/wwwroot/zd-h5.wenbita.cn',
      env: {
        NODE_ENV: 'production',
        HOME: '/root'
      },
      autorestart: true,
      out_file: '/www/wwwlogs/zd-h5-out.log',
      error_file: '/www/wwwlogs/zd-h5-error.log'
    },
    {
      name: 'zd-admin',
      script: 'serve',
      args: 'dist -l 3002 -s',
      cwd: '/www/wwwroot/zd-admin.wenbita.cn',
      env: {
        NODE_ENV: 'production',
        HOME: '/root'
      },
      autorestart: true,
      out_file: '/www/wwwlogs/zd-admin-out.log',
      error_file: '/www/wwwlogs/zd-admin-error.log'
    }
  ]
};
