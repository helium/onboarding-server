import express from 'express'
import basicAuth from 'express-basic-auth'
import * as makersController from '../controllers/makersController'
import * as tokensController from '../controllers/tokensController'

const router = express.Router()

const username = process.env.ADMIN_USERNAME
const password = process.env.ADMIN_PASSWORD

router.use(
  basicAuth({
    users: { [username]: password },
  }),
)

router.post('/makers', makersController.create)
router.post('/makers/:id/tokens', tokensController.create)

module.exports = router
