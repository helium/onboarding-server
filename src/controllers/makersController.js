import { Keypair, utils } from '@helium/crypto'
import { Maker } from '../models'
import { successResponse } from '../helpers'

const generateApiKey = async () => {
  const buf = await utils.randomBytes(32)
  return buf.toString('hex')
}

export const create = async (req, res) => {
  const { name } = req.body

  const keypairEntropy = await utils.randomBytes(32)
  const keypair = await Keypair.fromEntropy(keypairEntropy)
  const address = keypair.address.b58
  const apiKey = await generateApiKey()

  const maker = await Maker.create({
    name,
    address,
    apiKey,
    keypairEntropy: keypairEntropy.toString('hex'),
  })

  return successResponse(req, res, maker)
}
