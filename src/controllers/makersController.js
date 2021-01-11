import { Keypair, utils } from '@helium/crypto'
import { Maker } from '../models'
import { errorResponse, successResponse } from '../helpers'

const generateApiKey = async () => {
  const buf = await utils.randomBytes(32)
  return buf.toString('hex')
}

export const create = async (req, res) => {
  try {
    const { name, locationNonceLimit } = req.body
    const keypairEntropy = await utils.randomBytes(32)
    const keypair = await Keypair.fromEntropy(keypairEntropy)
    const address = keypair.address.b58
    const apiKey = await generateApiKey()

    const maker = await Maker.create({
      name,
      address,
      apiKey,
      keypairEntropy: keypairEntropy.toString('hex'),
      locationNonceLimit: locationNonceLimit,
    })

    return successResponse(req, res, {
      name: maker.name,
      address: maker.address,
      apiKey: maker.apiKey,
      locationNonceLimit: maker.locationNonceLimit,
    })
  } catch (error) {
    errorResponse(req, res, error.message, 500, error.errors)
  }
}
