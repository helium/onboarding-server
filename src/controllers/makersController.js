import { Maker } from '../models'
import { successResponse } from '../helpers'

export const create = async (req, res) => {
  const { name } = req.body

  const maker = await Maker.create({ name })
  return successResponse(req, res, maker)
}
