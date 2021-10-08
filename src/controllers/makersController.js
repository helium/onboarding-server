import { Maker } from '../models'
import { errorResponse, successResponse } from '../helpers'

export const index = async (req, res) => {
  try {
    const makers = await Maker.findAll()
    return successResponse(req, res, makers)
  } catch (error) {
    errorResponse(req, res, error.message, 500, error.errors)
  }
}

export const show = async (req, res) => {
  try {
    const { makerId } = req.params
    const maker = await Maker.findByPk(makerId)
    return successResponse(req, res, maker)
  } catch (error) {
    errorResponse(req, res, error.message, 500, error.errors)
  }
}

export const legacyAddress = async (req, res) => {
  try {
    const maker = await Maker.findByPk(1)
    return successResponse(req, res, { address: maker.address })
  } catch (error) {
    errorResponse(req, res, error.message, 500, error.errors)
  }
}

export const legacyLimits = async (req, res) => {
  try {
    const maker = await Maker.findByPk(1)
    return res.json({ location_nonce: maker.locationNonceLimit + 1 })
  } catch (error) {
    errorResponse(req, res, error.message, 500, error.errors)
  }
}
