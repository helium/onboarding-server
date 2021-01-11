import express from 'express'
import basicAuth from 'express-basic-auth'
import * as makersController from '../controllers/makersController'

const router = express.Router()

const username = process.env.ADMIN_USERNAME || 'admin_user'
const password = process.env.ADMIN_PASSWORD || 'admin_password'

router.use(
  basicAuth({
    users: { [username]: password },
  }),
)

router.post('/makers', makersController.create)

module.exports = router
