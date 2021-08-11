import { Keypair } from '@helium/crypto'
import {
  Transaction,
  AddGatewayV1,
  AssertLocationV1,
  AssertLocationV2,
} from '@helium/transactions'
import { Maker, Hotspot } from '../models'
import { errorResponse, successResponse } from '../helpers'
import { Op } from 'sequelize'

const env = process.env.NODE_ENV || 'development'

export const pay = async (req, res) => {
  try {
    const { onboardingKey } = req.params
    const { transaction } = req.body

    if (!transaction) {
      return errorResponse(req, res, 'Missing transaction param', 422)
    }

    const hotspot = await Hotspot.findOne({
      where: { [Op.or]: [{ onboardingKey }, { publicAddress: onboardingKey }] },
    })

    if (!hotspot) {
      return errorResponse(req, res, 'Hotspot not found', 404)
    }

    const maker = await Maker.scope('withKeypair').findByPk(hotspot.makerId)
    const keypairEntropy = Buffer.from(maker.keypairEntropy, 'hex')
    const keypair = await Keypair.fromEntropy(keypairEntropy)

    let txn
    switch (Transaction.stringType(transaction)) {
      case 'addGateway':
        txn = AddGatewayV1.fromString(transaction)
        break

      case 'assertLocation':
        txn = AssertLocationV1.fromString(transaction)

        // transactions are only signed up until the maker's nonce limit
        if (txn.nonce > maker.locationNonceLimit) {
          return errorResponse(req, res, 'Nonce limit exceeded', 422)
        }
        break

      case 'assertLocationV2':
        txn = AssertLocationV2.fromString(transaction)

        // transactions are only signed up until the maker's nonce limit
        if (txn.nonce > maker.locationNonceLimit) {
          return errorResponse(req, res, 'Nonce limit exceeded', 422)
        }
        break

      default:
        throw new Error('Unsupported transaction type')
    }

    // The transaction must include the onboarding server as the payer
    if (txn?.payer?.b58 !== maker.address) {
      return errorResponse(req, res, 'Invalid payer address', 422)
    }

    // Starting after hotspot 32951, it's required that the onboarding key
    // match the txn gateway address
    if (hotspot.id > 32951 && txn?.gateway?.b58 !== onboardingKey) {
      return errorResponse(req, res, 'Invalid hotspot address', 422)
    }

    // Once an onboarding key has been associated with a hotspot's public
    // address, it cannot be used for a hotspot with a different public address
    if (hotspot.publicAddress && hotspot.publicAddress !== txn?.gateway?.b58) {
      return errorResponse(req, res, 'Onboarding key already used', 422)
    }

    hotspot.publicAddress = txn?.gateway?.b58
    await hotspot.save()

    const signedTxn = await txn.sign({ payer: keypair })
    return successResponse(req, res, { transaction: signedTxn.toString() })
  } catch (error) {
    errorResponse(
      req,
      res,
      env === 'development' ? error.message : 'Internal error',
      500,
      env === 'development' ? error.errors : [],
    )
  }
}

export const sample = async (req, res) => {
  if (env === 'production') {
    return errorResponse(req, res, 'Not available', 422)
  }

  const maker = await Maker.scope('withKeypair').findByPk(1)
  const keypairEntropy = Buffer.from(maker.keypairEntropy, 'hex')
  const keypair = await Keypair.fromEntropy(keypairEntropy)

  const owner = await Keypair.makeRandom()
  const gateway = await Keypair.makeRandom()

  const txn = new AddGatewayV1({
    owner: owner.address,
    gateway: gateway.address,
    payer: keypair.address,
    stakingFee: 40000,
  })

  const signedTxn1 = await txn.sign({ owner })
  const signedTxn2 = await signedTxn1.sign({ gateway })

  return successResponse(req, res, { txn: signedTxn2.toString() })
}
