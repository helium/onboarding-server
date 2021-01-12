import express from 'express'
import rateLimit from 'express-rate-limit'
import * as transactionsController from '../controllers/transactionsController'
import * as makersController from '../controllers/makersController'
import * as hotspotsController from '../controllers/hotspotsController'
import { restrictToMaker, successResponse, verifyApiKey } from '../helpers'

const REQUIRED_FIRMWARE_VERSION = '2019.11.06.0'

const router = express.Router()

const numberEnv = (envName, fallback) => {
  if (process.env[envName]) {
    return parseInt(process.env[envName])
  }
  return fallback
}

const strictLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  skip: (req, res) => req.maker,
})

router.use(verifyApiKey)
router.use(
  rateLimit({
    windowMs: numberEnv('RATE_LIMIT_WINDOW', 15 * 60 * 1000), // 15 minutes
    max: numberEnv('RATE_LIMIT_MAX', 3),
    skip: (req, res) => req.maker,
  }),
)

// Legacy CLI Support (2020)
router.post('/v1/transactions/pay/:onboardingKey', strictLimit, transactionsController.pay)
router.get('/v1/limits', (req, res) => {
  return successResponse(req, res, { location_nonce: 3 })
})
router.get('/v1/address', (req, res) => {
  // TODO hardcode the helium inc maker address here
  throw new Error('TODO')
})

// V2 (Q1 2021)
// Restricted Maker API
router.get('/v2/hotspots', restrictToMaker, hotspotsController.index)
router.get('/v2/hotspots/search', restrictToMaker, hotspotsController.search)
router.post('/v2/hotspots', restrictToMaker, hotspotsController.create)
router.put('/v2/hotspots/:id', restrictToMaker, hotspotsController.update)
router.delete('/v2/hotspots/:id', restrictToMaker, hotspotsController.destroy)

// Public rate limited API
router.get('/v2/hotspots/:onboardingKeyOrId', strictLimit, hotspotsController.show)
router.post('/v2/transactions/pay/:onboardingKey', strictLimit,  transactionsController.pay)
router.get('/v2/makers', makersController.index)
router.get('/v2/makers/:makerId', makersController.show)
router.get('/v2/firmware', (req, res) => {
  return successResponse(req, res, { version: REQUIRED_FIRMWARE_VERSION })
})

module.exports = router