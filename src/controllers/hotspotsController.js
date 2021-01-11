import snakeCaseKeys from 'snakecase-keys'
import { Hotspot } from '../models'
import { errorResponse, successResponse } from '../helpers'

export const showLegacy = async (req, res) => {
try {
    const { onboardingKey } = req.params
    const hotspot = await Hotspot.findOne({ where: { onboardingKey } })
    return successResponse(req, res, snakeCaseKeys(hotspot.toJSON()))
  } catch (error) {
    errorResponse(req, res, error.message, 500, error.errors)
  }
}

export const show = async (req, res) => {
  try {
    const { onboardingKey } = req.params
    const hotspot = await Hotspot.findOne({ where: { onboardingKey } })
    return successResponse(req, res, hotspot)
  } catch (error) {
    errorResponse(req, res, error.message, 500, error.errors)
  }
}

export const create = async (req, res) => {
  try {
    const {
      onboardingKey,
      macWlan0,
      rpiSerial,
      batch,
      publicAddress,
      heliumSerial,
      macEth0,
    } = req.body

    const hotspot = await Hotspot.create({
      onboardingKey,
      macWlan0,
      rpiSerial,
      batch,
      publicAddress,
      heliumSerial,
      macEth0,
      makerId: 7,
    })

    return successResponse(req, res, hotspot)
  } catch (error) {
    errorResponse(req, res, error.message, 500, error.errors)
  }
}
