import { utils } from '@helium/crypto'
import { Token, Maker } from '../models'
import { errorResponse, successResponse } from '../helpers'

const generateToken = async (type, bytes) => {
  const buf = await utils.randomBytes(bytes)
  return [type, buf.toString('base64')].join('_')
}

export const create = async (req, res) => {
  try {
    const { id } = req.params
    const { name } = req.body
    const maker = await Maker.findByPk(id)
    const publicToken = await generateToken('pk', 32)
    const secretToken = await generateToken('sk', 64)

    const token = await Token.create({
      name,
      publicToken,
      secretToken,
      makerId: maker.id,
    })

    return successResponse(req, res, {
      name: token.name,
      maker: maker.name,
      makerId: maker.id,
      publicToken: token.publicToken,
      secretToken,
    })
  } catch (error) {
    console.error(error)
    errorResponse(req, res, error.message, 500, error.errors)
  }
}
