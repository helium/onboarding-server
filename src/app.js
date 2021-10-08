const express = require('express')
const cookieParser = require('cookie-parser')
const logger = require('morgan')
const compression = require('compression')
const env = process.env.NODE_ENV || 'development'

import indexRouter from './routes/indexRouter'
import apiRouter from './routes/apiRouter'
import appRouter from './routes/appRouter'

var app = express()

if (env === 'production') {
  app.enable('trust proxy')
  app.use(compression())

  // Enforce SSL & HSTS in production
  app.use((req, res, nextPlug) => {
    const proto = req.headers['x-forwarded-proto']
    if (proto === 'https') {
      res.set({
        'Strict-Transport-Security': 'max-age=31557600', // one-year
      })
      return nextPlug()
    }
    res.redirect(`https://${req.headers.host}${req.url}`)
  })
}

app.use(logger('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())

app.use('/', indexRouter)
app.use('/api', apiRouter)
app.use('/app', appRouter)

module.exports = app
