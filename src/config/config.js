const fs = require('fs');
require('dotenv').config();

module.exports = {
  development: {
    username: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    port: process.env.PGPORT,
    host: '127.0.0.1',
    dialect: 'postgres',
  },
}
