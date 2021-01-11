var express = require('express')
var cookieParser = require('cookie-parser')
var logger = require('morgan')

import indexRouter from './routes/indexRouter'
import apiRouter from './routes/apiRouter'
import appRouter from './routes/appRouter'
import adminRouter from './routes/adminRouter'

var app = express()

app.set('trust proxy', 1)

app.use(logger('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())

app.use('/', indexRouter)
app.use('/api', apiRouter)
app.use('/app', appRouter)
app.use('/admin', adminRouter)

module.exports = app
