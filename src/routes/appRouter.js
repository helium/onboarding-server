import express from 'express'
import basicAuth from 'express-basic-auth'
import * as transactionsController from '../controllers/transactionsController'

const router = express.Router()

const username = process.env.APP_USERNAME || 'app_user'
const password = process.env.APP_PASSWORD || 'app_password'

router.use(
  basicAuth({
    users: { [username]: password },
  }),
)

router.post('/transactions/pay/:onboardingKey', transactionsController.pay)

module.exports = router
