import express from 'express'
import basicAuth from 'express-basic-auth'
import * as makersController from '../controllers/makersController'
import * as hotspotsController from '../controllers/hotspotsController'

const router = express.Router()

const username = process.env.ADMIN_USERNAME
const password = process.env.ADMIN_PASSWORD

router.use(
  basicAuth({
    users: { [username]: password },
  }),
)

router.post('/makers', makersController.create)
router.post('/hotspots', hotspotsController.create)

module.exports = router
