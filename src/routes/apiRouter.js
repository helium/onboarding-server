import express from 'express'
import rateLimit from 'express-rate-limit'
import RedisStore from 'rate-limit-redis'
import Redis from 'ioredis'
import cors from 'cors'
import * as transactionsController from '../controllers/transactionsController'
import * as makersController from '../controllers/makersController'
import * as hotspotsController from '../controllers/hotspotsController'
import { restrictToMaker, successResponse, verifyApiKey } from '../helpers'

const REQUIRED_FIRMWARE_VERSION = '2019.11.06.0'

const router = express.Router()

router.use(cors())
router.options('*', cors())

const numberEnv = (envName, fallback) => {
  if (process.env[envName]) {
    return parseInt(process.env[envName])
  }
  return fallback
}

let redisClient
if (process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL)
}

const strictLimitOpts = {
  windowMs: 10 * 60 * 1000,
  max: 10,
  skip: (req, res) => req.maker,
}
if (process.env.REDIS_URL) {
  strictLimitOpts.store = new RedisStore({
    client: redisClient,
  })
}
const strictLimit = rateLimit(strictLimitOpts)

const defaultLimitOpts = {
  windowMs: numberEnv('RATE_LIMIT_WINDOW', 15 * 60 * 1000), // 15 minutes
  max: numberEnv('RATE_LIMIT_MAX', 3),
  skip: (req, res) => req.maker,
}
if (process.env.REDIS_URL) {
  defaultLimitOpts.store = new RedisStore({
    client: redisClient,
  })
}
const defaultLimit = rateLimit(defaultLimitOpts)

router.use(verifyApiKey)
router.use(defaultLimit)

// Legacy CLI Support (2020)
router.post(
  '/v1/transactions/pay/:onboardingKey',
  strictLimit,
  transactionsController.pay,
)
router.get('/v1/address', makersController.legacyAddress)
router.get('/v1/limits', (req, res) => {
  return successResponse(req, res, { location_nonce: 3 })
})

// V2 (Q1 2021)
// Restricted Maker API
router.get('/v2/hotspots', restrictToMaker, hotspotsController.index)
router.get('/v2/hotspots/search', restrictToMaker, hotspotsController.search)
router.post('/v2/hotspots', restrictToMaker, hotspotsController.create)
router.put('/v2/hotspots/:id', restrictToMaker, hotspotsController.update)
router.delete('/v2/hotspots/:id', restrictToMaker, hotspotsController.destroy)

// Public rate limited API
router.get(
  '/v2/hotspots/:onboardingKeyOrId',
  strictLimit,
  hotspotsController.show,
)
router.post(
  '/v2/transactions/pay/:onboardingKey',
  strictLimit,
  transactionsController.pay,
)
router.get('/v2/transactions/sample', transactionsController.sample)
router.get('/v2/makers', makersController.index)
router.get('/v2/makers/:makerId', makersController.show)
router.get('/v2/firmware', (req, res) => {
  return successResponse(req, res, { version: REQUIRED_FIRMWARE_VERSION })
})

module.exports = router
