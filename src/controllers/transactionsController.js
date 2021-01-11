import { Keypair } from '@helium/crypto'
import { AddGatewayV1, AssertLocationV1, PaymentV2 } from '@helium/transactions'
import { Maker } from '../models'
import { successResponse } from '../helpers'

const deserializeTxn = (txnString) => {
  // TODO figure out what kind it is
  const txn = AddGatewayV1.fromString(txnString)
  return txn
}

export const pay = async (req, res) => {
  const { onboardingKey } = req.params
  const { transaction } = req.body

  // TODO look up hotspot by onboarding key
  // TODO get maker associated with hotspot
  const maker = await Maker.findByPk(1)
  const keypairEntropy = Buffer.from(maker.keypairEntropy, 'hex')
  const keypair = await Keypair.fromEntropy(keypairEntropy)

  const txn = deserializeTxn(transaction)
  // TODO: if location, validate nonce
  const signedTxn = await txn.sign({ payer: keypair })

  return successResponse(req, res, { txn: signedTxn.toString()})
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

  return successResponse(req, res, { txn: signedTxn2.toString()})
}
