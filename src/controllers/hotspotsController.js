import { Hotspot } from '../models'
import { errorResponse, successResponse } from '../helpers'

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
