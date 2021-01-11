import { Keypair } from '@helium/crypto'
import {
  Transaction,
  AddGatewayV1,
  AssertLocationV1,
} from '@helium/transactions'
import { Maker, Hotspot } from '../models'
import { errorResponse, successResponse } from '../helpers'

export const pay = async (req, res) => {
  try {
    const { onboardingKey } = req.params
    const { transaction } = req.body

    const { Maker: maker } = await Hotspot.findOne({
      where: { onboardingKey },
      include: Maker.scope('withKeypair'),
    })
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

      default:
        throw new Error('Unsupported transaction type')
    }

    const signedTxn = await txn.sign({ payer: keypair })
    return successResponse(req, res, { txn: signedTxn.toString() })
  } catch (error) {
    errorResponse(req, res, error.message, 500, error.errors)
  }
}

// TODO: delete below, just for testing
export const sample = async (req, res) => {
  const maker = await Maker.findByPk(1)
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
