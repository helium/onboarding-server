import { Keypair } from '@helium/crypto'
import {
  hotspotConfigKey, hotspotIssuerKey,
  init, iotInfoKey, updateMetadata
} from '@helium/helium-entity-manager-sdk'
import { subDaoKey } from '@helium/helium-sub-daos-sdk'
import { helium } from '@helium/proto'
import {
  AddGatewayV1,
  AssertLocationV1,
  AssertLocationV2, Transaction
} from '@helium/transactions'
import {
  Keypair as SolanaKeypair,
  PublicKey,
  Transaction as SolanaTransaction
} from '@solana/web3.js'
import sodium from 'libsodium-wrappers'
import { Op } from 'sequelize'
import { errorResponse, successResponse } from '../helpers'
import { isEnabled, provider } from '../helpers/solana'
import { Hotspot, Maker } from '../models'

const env = process.env.NODE_ENV || 'development'
const IOT_MINT = process.env.IOT_MINT

export const pay = async (req, res) => {
  try {
    const sdk = await init(provider)
    const { onboardingKey, isDataOnly } = req.params
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
    const makerSolanaKeypair = SolanaKeypair.fromSeed(keypairEntropy)

    const subdao = subDaoKey(new PublicKey(IOT_MINT))[0]
    const hsConfigKey = hotspotConfigKey(subdao, 'IOT')[0]
    const hsIssuerKey = hotspotIssuerKey(
      hsConfigKey,
      makerSolanaKeypair.publicKey,
    )[0]

    const solanaEnabled = await isEnabled()
    let txn, solanaIx
    switch (Transaction.stringType(transaction)) {
      case 'addGateway':
        txn = AddGatewayV1.fromString(transaction)
        const hotspotOwner = new PublicKey(txn.owner.publicKey)

        // Verify the gateway that signed is correct so we can sign for the Solana transaction.
        const addGateway = txn.toProto(true)
        const serialized = helium.blockchain_txn_add_gateway_v1
          .encode(addGateway)
          .finish()

        const verified = sodium.crypto_sign_verify_detached(
          txn.gatewaySignature,
          serialized,
          txn.gateway.publicKey,
        )

        if (!verified) {
          return errorResponse(req, res, 'Invalid gateway signer', 400)
        }

        if (solanaEnabled) {
          const payer = isDataOnly ? hotspotOwner : makerSolanaKeypair.publicKey
          solanaIx = await sdk.methods
            .issueIotHotspotV0({
              hotspotKey: txn.gateway.b58,
              isFullHotspot: !isDataOnly,
            })
            .accounts({
              payer,
              dcFeePayer: payer,
              hotspotIssuer: hsIssuerKey,
              recipient: hotspotOwner,
              maker: makerSolanaKeypair.publicKey,
            })
            .instruction()
        }

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

        if (solanaEnabled) {
          const info = await sdk.account.iotHotspotInfoV0.fetch(
            iotInfoKey(hsConfigKey, tx.gateway.b58)[0],
          )
          solanaIx = await (
            await updateMetadata({
              program: sdk,
              hotspotConfig: hsConfigKey,
              hotspotOwner: new PublicKey(txn.owner.publicKey),
              location: txn.location ? new anchor.BN(txn.location) : null,
              gain: txn.gain ? txn.gain : null,
              elevation: txn.elevation ? txn.elevation : null,
              assetId: info.asset,
            })
          ).instruction()
        }
        break

      default:
        throw new Error('Unsupported transaction type')
    }

    let solanaTransactions = []
    if (solanaIx) {
      const tx = new SolanaTransaction({
        recentBlockhash: (
          await provider.connection.getLatestBlockhash('confirmed')
        ).blockhash,
        feePayer: isDataOnly ? hotspotOwner : makerSolanaKeypair.publicKey,
      })
      tx.add(solanaIx)
      tx.partialSign(makerSolanaKeypair)
      solanaTransactions = [tx]
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
    return successResponse(req, res, {
      transaction: solanaEnabled ? null : signedTxn.toString(),
      solanaTransactions: solanaTransactions.map(
        (tx) =>
          Buffer.from(
            tx.serialize({
              requireAllSignatures: false,
            }),
          ).toJSON().data,
      ),
    })
  } catch (error) {
    console.error(error)
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
