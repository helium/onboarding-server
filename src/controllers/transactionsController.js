import { Keypair } from '@helium/crypto'
import { AddGatewayV1, AssertLocationV1, PaymentV2 } from '@helium/transactions'
import { Maker } from '../models'
import { successResponse } from '../helpers'

export const pay = async (req, res) => {
  const { transaction } = req.body

  const maker = await Maker.findByPk(1)
  const keypairEntropy = Buffer.from(maker.keypairEntropy, 'hex')
  const keypair = await Keypair.fromEntropy(keypairEntropy)

  // TODO need to figure out which kind of transaction we have
  const txn = AddGatewayV1.fromString(transaction)
  const signedTxn = await txn.sign({ payer: keypair })

  return successResponse(req, res, { txn: signedTxn.toString()})
}

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
