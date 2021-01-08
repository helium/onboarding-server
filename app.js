var express = require('express')
var cookieParser = require('cookie-parser')
var logger = require('morgan')

var indexRouter = require('./src/routes/index')
var usersRouter = require('./src/routes/users')
var makersRouter = require('./src/routes/makers')

var app = express()

app.use(logger('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())

app.use('/', indexRouter)
app.use('/users', usersRouter)
app.use('/makers', makersRouter)

module.exports = app
