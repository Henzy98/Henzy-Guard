module.exports = {
  apps: [
    {
      name: 'henzy-database',
      script: './guards/database.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        HENZY_CONFIG: process.env.HENZY_CONFIG
      },
      error_file: './logs/database-error.log',
      out_file: './logs/database-out.log',
      log_file: './logs/database-combined.log',
      time: true
    },
    {
      name: 'henzy-guard1',
      script: './guards/guard1.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        HENZY_CONFIG: process.env.HENZY_CONFIG
      },
      error_file: './logs/guard1-error.log',
      out_file: './logs/guard1-out.log',
      log_file: './logs/guard1-combined.log',
      time: true
    },
    {
      name: 'henzy-guard2',
      script: './guards/guard2.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        HENZY_CONFIG: process.env.HENZY_CONFIG
      },
      error_file: './logs/guard2-error.log',
      out_file: './logs/guard2-out.log',
      log_file: './logs/guard2-combined.log',
      time: true
    },
    {
      name: 'henzy-guard3',
      script: './guards/guard3.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        HENZY_CONFIG: process.env.HENZY_CONFIG
      },
      error_file: './logs/guard3-error.log',
      out_file: './logs/guard3-out.log',
      log_file: './logs/guard3-combined.log',
      time: true
    },
    {
      name: 'henzy-guard4',
      script: './guards/guard4.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        HENZY_CONFIG: process.env.HENZY_CONFIG
      },
      error_file: './logs/guard4-error.log',
      out_file: './logs/guard4-out.log',
      log_file: './logs/guard4-combined.log',
      time: true
    },
    {
      name: 'henzy-moderation',
      script: './guards/moderation.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        HENZY_CONFIG: process.env.HENZY_CONFIG
      },
      error_file: './logs/moderation-error.log',
      out_file: './logs/moderation-out.log',
      log_file: './logs/moderation-combined.log',
      time: true
    }
  ]
};
