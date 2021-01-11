var express = require('express')
var cookieParser = require('cookie-parser')
var logger = require('morgan')

import indexRouter from './routes/indexRouter'
import appRouter from './routes/appRouter'
import adminRouter from './routes/adminRouter'

var app = express()

app.use(logger('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())

app.use('/', indexRouter)
app.use('/app', appRouter)
app.use('/admin', adminRouter)

module.exports = app
