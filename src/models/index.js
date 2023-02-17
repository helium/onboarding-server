const fs = require('fs')
const path = require('path')
const Sequelize = require('sequelize')
const basename = path.basename(__filename)
const db = {}
const AWS = require('aws-sdk')
const pg = require('pg')

const host = process.env.PGHOST || 'localhost'
const port = Number(process.env.PGPORT) || 5432
const sequelize = new Sequelize({
  host: host,
  dialect: 'postgres',
  port: port,
  logging: process.env.DISABLE_DB_LOGGING !== 'true',
  dialectModule: pg,
  username: process.env.PGUSER,
  database: process.env.PGDATABASE,
  hooks: {
    beforeConnect: async (config) => {
      const isRds = host.includes('rds.amazonaws.com')

      let password = process.env.PGPASSWORD
      if (isRds && !password) {
        const signer = new AWS.RDS.Signer({
          region: process.env.AWS_REGION,
          hostname: process.env.PGHOST,
          port,
          username: process.env.PGUSER,
        })
        password = await new Promise((resolve, reject) =>
          signer.getAuthToken({}, (err, token) => {
            if (err) {
              return reject(err)
            }
            resolve(token)
          }),
        )
        config.dialectOptions = {
          ssl: {
            require: false,
            rejectUnauthorized: false,
          },
        }
      }
      config.password = password
    },
  },
})

fs.readdirSync(__dirname)
  .filter((file) => {
    return (
      file.indexOf('.') !== 0 && file !== basename && file.slice(-3) === '.js'
    )
  })
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(
      sequelize,
      Sequelize.DataTypes,
    )
    db[model.name] = model
  })

Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db)
  }
})

db.sequelize = sequelize
db.Sequelize = Sequelize

module.exports = db
