import snakeCaseKeys from 'snakecase-keys'
import camelcaseKeys from 'camelcase-keys'
import { Op } from 'sequelize'
import { Hotspot, Maker } from '../models'
import { errorResponse, paginate, successResponse } from '../helpers'

export const index = async (req, res) => {
  try {
    const { maker } = req
    const page = req.query.page ? parseInt(req.query.page) : 0
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize) : 100

    const hotspots = await Hotspot.findAll({
      where: { makerId: maker.id },
      ...paginate({ page, pageSize }),
    })

    return successResponse(req, res, hotspots, 200, {
      page,
      pageSize,
    })
  } catch (error) {
    errorResponse(req, res, error.message, 500, error.errors)
  }
}

export const showLegacy = async (req, res) => {
  try {
    const { onboardingKey } = req.params
    const hotspot = await Hotspot.findOne({
      where: { onboardingKey },
      include: [{ model: Maker }],
    })
    hotspot.Maker.locationNonceLimit = hotspot.Maker.locationNonceLimit + 1
    const hotspotJSON = hotspot.toJSON()
    return successResponse(req, res, snakeCaseKeys(hotspotJSON))
  } catch (error) {
    errorResponse(req, res, error.message, 500, error.errors)
  }
}

export const show = async (req, res) => {
  try {
    const { maker } = req
    const { onboardingKeyOrId } = req.params
    const where = maker
      ? { [Op.and]: [{ id: onboardingKeyOrId }, { makerId: maker.id }] }
      : {
          [Op.or]: [
            { onboardingKey: onboardingKeyOrId },
            { publicAddress: onboardingKeyOrId },
          ],
        }
    const hotspot = await Hotspot.findOne({
      where,
      include: [{ model: Maker }],
    })
    if (!hotspot) {
      return errorResponse(req, res, 'Unable to find hotspot', 404)
    }
    const hotspotJSON = hotspot.toJSON()
    return successResponse(req, res, camelcaseKeys(hotspotJSON))
  } catch (error) {
    errorResponse(req, res, error.message, 500, error.errors)
  }
}

export const search = async (req, res) => {
  try {
    const { maker } = req

    const searchQuery = []
    for (const [key, value] of Object.entries(req.query)) {
      searchQuery.push({ [key]: value })
    }

    const hotspot = await Hotspot.findAll({
      where: {
        [Op.or]: searchQuery,
        [Op.and]: { makerId: maker.id },
      },
    })

    return successResponse(req, res, hotspot)
  } catch (error) {
    errorResponse(req, res, error.message, 500, error.errors)
  }
}

export const create = async (req, res) => {
  try {
    const { maker } = req

    const {
      onboardingKey,
      macWlan0,
      rpiSerial,
      batch,
      heliumSerial,
      macEth0,
    } = req.body

    const hotspot = await Hotspot.create({
      onboardingKey,
      macWlan0,
      rpiSerial,
      batch,
      heliumSerial,
      macEth0,
      makerId: maker.id,
    })

    return successResponse(req, res, hotspot, 201)
  } catch (error) {
    errorResponse(req, res, error.message, 500, error.errors)
  }
}

export const update = async (req, res) => {
  try {
    const { maker } = req
    const { id } = req.params

    const {
      onboardingKey,
      macWlan0,
      rpiSerial,
      batch,
      heliumSerial,
      macEth0,
    } = req.body

    const hotspot = await Hotspot.findOne({
      where: {
        [Op.and]: [{ id }, { makerId: maker.id }],
      },
    })

    if (!hotspot) {
      return errorResponse(req, res, 'Hotspot not found', 404)
    }

    if (hotspot.publicAddress) {
      return errorResponse(req, res, 'Hotspot is immutable', 422)
    }

    if (onboardingKey) hotspot.onboardingKey = onboardingKey
    if (macWlan0) hotspot.macWlan0 = macWlan0
    if (rpiSerial) hotspot.rpiSerial = rpiSerial
    if (batch) hotspot.batch = batch
    if (heliumSerial) hotspot.heliumSerial = heliumSerial
    if (macEth0) hotspot.macEth0 = macEth0

    const updatedHotspot = await hotspot.save()
    return successResponse(req, res, updatedHotspot)
  } catch (error) {
    errorResponse(req, res, error.message, 500, error.errors)
  }
}

export const destroy = async (req, res) => {
  try {
    const { maker } = req
    const { id } = req.params

    const hotspot = await Hotspot.findOne({
      where: {
        [Op.and]: [{ id }, { makerId: maker.id }],
      },
    })

    if (!hotspot) {
      return errorResponse(req, res, 'Hotspot not found', 404)
    }

    if (hotspot.publicAddress) {
      return errorResponse(req, res, 'Hotspot is immutable', 422)
    }

    await hotspot.destroy()
    return successResponse(req, res, {}, 200)
  } catch (error) {
    errorResponse(req, res, error.message, 500, error.errors)
  }
}
