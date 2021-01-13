import { Keypair, utils } from '@helium/crypto'
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

export const create = async (req, res) => {
  try {
    const { name, locationNonceLimit } = req.body
    const keypairEntropy = await utils.randomBytes(32)
    const keypair = await Keypair.fromEntropy(keypairEntropy)
    const address = keypair.address.b58

    const maker = await Maker.create({
      name,
      address,
      keypairEntropy: keypairEntropy.toString('hex'),
      locationNonceLimit: locationNonceLimit,
    })

    return successResponse(req, res, {
      id: maker.id,
      name: maker.name,
      address: maker.address,
      locationNonceLimit: maker.locationNonceLimit,
    })
  } catch (error) {
    errorResponse(req, res, error.message, 500, error.errors)
  }
}
