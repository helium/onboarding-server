import express from 'express'
import basicAuth from 'express-basic-auth'
import * as transactionsController from '../controllers/transactionsController'
import * as makersController from '../controllers/makersController'
import * as hotspotsController from '../controllers/hotspotsController'
import { successResponse } from '../helpers'

const router = express.Router()

const username = process.env.APP_USERNAME
const password = process.env.APP_PASSWORD

router.use(
  basicAuth({
    users: { [username]: password },
  }),
)

const REQUIRED_FIRMWARE_VERSION = '2019.11.06.0'

// Legacy Support (2020)
router.get('/hotspots/:onboardingKey', hotspotsController.showLegacy)
router.post('/transactions/pay/:onboardingKey', transactionsController.pay)
router.get('/address', makersController.legacyAddress)
router.get('/limits', makersController.legacyLimits)
router.get('/firmware', (req, res) => {
  return successResponse(req, res, { version: REQUIRED_FIRMWARE_VERSION })
})

module.exports = router
