import express from 'express'
import * as makersController from '../controllers/makersController'

const router = express.Router()

router.post('/', makersController.create)

module.exports = router
