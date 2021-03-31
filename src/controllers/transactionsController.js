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

export const pay = async (req, res) => {
  try {
    const { onboardingKey } = req.params
    const { transaction } = req.body

    const hotspot = await Hotspot.findOne({
      where: { [Op.or]: [{ onboardingKey }, { publicAddress: onboardingKey }] },
    })
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
        if (txn.nonce > maker.locationNonceLimit) {
          return errorResponse(req, res, 'Nonce limit exceeded', 422)
        }
        break

      case 'assertLocationV2':
        txn = AssertLocationV2.fromString(transaction)
        if (txn.nonce > maker.locationNonceLimit) {
          return errorResponse(req, res, 'Nonce limit exceeded', 422)
        }
        break

      default:
        throw new Error('Unsupported transaction type')
    }

    if (txn?.payer?.b58 !== maker.address) {
      return errorResponse(req, res, 'Invalid payer address', 422)
    }

    if (hotspot.publicAddress && hotspot.publicAddress !== txn?.gateway?.b58) {
      return errorResponse(req, res, 'Onboarding key already used', 422)
    }

    hotspot.publicAddress = txn?.gateway?.b58
    await hotspot.save()

    const signedTxn = await txn.sign({ payer: keypair })
    return successResponse(req, res, { transaction: signedTxn.toString() })
  } catch (error) {
    errorResponse(req, res, error.message, 500, error.errors)
  }
}

// TODO: delete below, just for testing
export const sample = async (req, res) => {
  const maker = await Maker.findByPk(3)
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
