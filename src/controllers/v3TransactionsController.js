import {
  init,
  makerKey,
  onboardIotHotspot,
  onboardMobileHotspot,
  updateIotMetadata as updateIotMetadataFn,
  updateMobileMetadata as updateMobileMetadataFn,
  rewardableEntityConfigKey,
  keyToAssetKey,
  mobileInfoKey,
  iotInfoKey,
} from '@helium/helium-entity-manager-sdk'
import { daoKey, subDaoKey } from '@helium/helium-sub-daos-sdk'
import {
  getConcurrentMerkleTreeAccountSize,
  ConcurrentMerkleTreeAccount,
  PROGRAM_ID as SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
} from '@solana/spl-account-compression'
import { helium } from '@helium/proto'
import { PROGRAM_ID as BUBBLEGUM_PROGRAM_ID, TreeConfig } from '@metaplex-foundation/mpl-bubblegum'
import { AddGatewayV1, Transaction } from '@helium/transactions'
import {
  ComputeBudgetProgram,
  Keypair as SolanaKeypair,
  PublicKey,
  SystemProgram,
  Transaction as SolanaTransaction,
} from '@solana/web3.js'
import sodium from 'libsodium-wrappers'
import { Op } from 'sequelize'
import { errorResponse, successResponse } from '../helpers'
import { ASSET_API_URL, provider } from '../helpers/solana'
import { Hotspot, Maker } from '../models'
import BN from "bn.js";
import bs58 from 'bs58'
import { sendInstructions } from '@helium/spl-utils'
import axios from "axios"

const ECC_VERIFY_ENDPOINT = process.env.ECC_VERIFY_ENDPOINT
const IOT_MINT = new PublicKey(process.env.IOT_MINT)
const HNT_MINT = new PublicKey(process.env.HNT_MINT)
const MOBILE_MINT = new PublicKey(process.env.MOBILE_MINT)
const ECC_VERIFIER = new PublicKey(process.env.ECC_VERIFIER)
const DAO_KEY = daoKey(HNT_MINT)[0]
const IOT_SUB_DAO_KEY = subDaoKey(IOT_MINT)[0]
const MOBILE_SUB_DAO_KEY = subDaoKey(MOBILE_MINT)[0]

export const createHotspot = async (req, res) => {
  const { transaction } = req.body
  const sdk = await init(provider)

  try {
    if (!transaction) {
      return errorResponse(req, res, 'Missing transaction param', 422)
    }

    if (Transaction.stringType(transaction) !== 'addGateway') {
      throw new Error('Unsupported transaction type')
    }

    const txn = AddGatewayV1.fromString(transaction)

    const onboardingKey = txn.gateway.b58
    const hotspot = await Hotspot.findOne({
      where: {
        [Op.or]: [{ onboardingKey }, { publicAddress: onboardingKey }],
      },
    })

    if (!hotspot) {
      return errorResponse(req, res, 'Hotspot not found', 404)
    }

    const makerDbEntry = await Maker.scope('withKeypair').findByPk(
      hotspot.makerId,
    )
    const keypairEntropy = Buffer.from(makerDbEntry.keypairEntropy, 'hex')
    const makerSolanaKeypair = SolanaKeypair.fromSeed(keypairEntropy)
    const maker = makerKey(DAO_KEY, makerDbEntry.name)[0]
    const program = await init(provider)
    const makerAcc = await program.account.makerV0.fetchNullable(maker)
    if (!makerAcc) {
      return errorResponse(req, res, 'Maker does not exist', 404)
    }
    const merkle = makerAcc.merkleTree
    const treeAuthority = PublicKey.findProgramAddressSync(
      [merkle.toBuffer()],
      BUBBLEGUM_PROGRAM_ID,
    )[0]
    const treeConfig = await TreeConfig.fromAccountAddress(
      provider.connection,
      treeAuthority,
    )

    if (treeConfig.numMinted >= treeConfig.totalMintCapacity - 2) {
      const oldMerkle = await ConcurrentMerkleTreeAccount.fromAccountAddress(
        provider.connection,
        merkle,
      )
      const newMerkle = SolanaKeypair.generate()
      const space = await getConcurrentMerkleTreeAccountSize(
        oldMerkle.getMaxDepth(),
        oldMerkle.getMaxBufferSize(),
        oldMerkle.getCanopyDepth(),
      )
      console.log(
        `Tree is full with ${treeConfig.numMinted} minted and ${treeConfig.totalMintCapacity} capacity, creating a new tree`,
      )
      const createMerkle = SystemProgram.createAccount({
        fromPubkey: makerSolanaKeypair.publicKey,
        newAccountPubkey: newMerkle.publicKey,
        lamports: await provider.connection.getMinimumBalanceForRentExemption(
          space,
        ),
        space: space,
        programId: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
      })
      const updateTree = await program.methods
        .updateMakerTreeV0({
          maxBufferSize: oldMerkle.getMaxBufferSize(),
          maxDepth: oldMerkle.getMaxDepth(),
        })
        .accounts({
          payer: makerSolanaKeypair.publicKey,
          maker,
          treeAuthority,
          newTreeAuthority: PublicKey.findProgramAddressSync(
            [newMerkle.publicKey.toBuffer()],
            BUBBLEGUM_PROGRAM_ID,
          )[0],
          newMerkleTree: newMerkle.publicKey,
        })
        .instruction()

      await sendInstructions(
        provider,
        [createMerkle, updateTree],
        [makerSolanaKeypair, newMerkle],
        makerSolanaKeypair.publicKey,
        'confirmed',
      )
    }

    const hotspotOwner = new PublicKey(txn.owner.publicKey)

    const payer = makerSolanaKeypair.publicKey
    const solanaIx = await sdk.methods
      .issueEntityV0({
        entityKey: Buffer.from(bs58.decode(txn.gateway.b58)),
      })
      .accounts({
        payer,
        maker,
        eccVerifier: ECC_VERIFIER,
        dao: DAO_KEY,
        recipient: hotspotOwner,
        issuingAuthority: makerSolanaKeypair.publicKey,
      })
      .instruction()

    let solanaTransactions = []
    const tx = new SolanaTransaction({
      recentBlockhash: (
        await provider.connection.getLatestBlockhash('confirmed')
      ).blockhash,
      feePayer: makerSolanaKeypair.publicKey,
    })
    tx.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 350000,
      }),
    )
    tx.add(solanaIx)
    tx.partialSign(makerSolanaKeypair)

    // Verify the gateway that signed is correct so we can sign for the Solana transaction.
    const addGateway = txn.toProto(true)
    const serialized = helium.blockchain_txn_add_gateway_v1
      .encode(addGateway)
      .finish()

    try {
      const { transaction: eccVerifiedTxn } = (
        await axios.post(ECC_VERIFY_ENDPOINT, {
          transaction: tx
            .serialize({
              requireAllSignatures: false,
            })
            .toString('hex'),
          msg: Buffer.from(serialized).toString('hex'),
          signature: Buffer.from(txn.gatewaySignature).toString('hex'),
        })
      ).data
      solanaTransactions = [
        SolanaTransaction.from(Buffer.from(eccVerifiedTxn, 'hex')),
      ]
    } catch (e) {
      console.error(e)
      return errorResponse(req, res, 'Invalid gateway signature', e.response.status || 400)
    }

    // The transaction must include the onboarding server as the payer
    if (txn?.payer?.b58 !== makerDbEntry.address) {
      return errorResponse(req, res, 'Invalid payer address', 422)
    }

    // Once an onboarding key has been associated with a hotspot's public
    // address, it cannot be used for a hotspot with a different public address
    if (hotspot.publicAddress && hotspot.publicAddress !== txn?.gateway?.b58) {
      return errorResponse(req, res, 'Onboarding key already used', 422)
    }

    hotspot.publicAddress = txn?.gateway?.b58
    await hotspot.save()

    return successResponse(req, res, {
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
    errorResponse(req, res, error.message, mapCode(error), error.errors)
  }
}

export const onboardToIot = async (req, res) => {
  try {
    const { entityKey, location, elevation, gain } = req.body
    if (!entityKey) {
      return errorResponse(req, res, 'Missing entityKey param', 422)
    }

    const program = await init(provider)
    const keyToAsset = await program.account.keyToAssetV0.fetchNullable(
      (await keyToAssetKey(DAO_KEY, entityKey))[0],
    )

    if (!keyToAsset) {
      return errorResponse(req, res, 'Key to asset does not exist, has the entity been created?', 404)
    }

    const assetId = keyToAsset.asset

    const hotspot = await Hotspot.findOne({
      where: {
        [Op.or]: [{ publicAddress: entityKey }],
      },
    })

    if (!hotspot) {
      return errorResponse(req, res, 'Hotspot not found', 404)
    }

    const makerDbEntry = await Maker.scope('withKeypair').findByPk(
      hotspot.makerId,
    )
    const keypairEntropy = Buffer.from(makerDbEntry.keypairEntropy, 'hex')
    const makerSolanaKeypair = SolanaKeypair.fromSeed(keypairEntropy)

    const { instruction } = await (
      await onboardIotHotspot({
        program,
        location: typeof location === 'undefined' ? null : new BN(location),
        elevation: typeof elevation === 'undefined' ? null : elevation,
        gain: typeof gain === 'undefined' ? null : gain,
        rewardableEntityConfig: rewardableEntityConfigKey(
          IOT_SUB_DAO_KEY,
          'IOT',
        )[0],
        assetId,
        payer: makerSolanaKeypair.publicKey,
        dcFeePayer: makerSolanaKeypair.publicKey,
        maker: makerKey(DAO_KEY, makerDbEntry.name)[0],
        dao: DAO_KEY,
        assetEndpoint: ASSET_API_URL,
      })
    ).prepare()

    const tx = new SolanaTransaction({
      recentBlockhash: (
        await provider.connection.getLatestBlockhash('confirmed')
      ).blockhash,
      feePayer: makerSolanaKeypair.publicKey,
    })
    tx.add(instruction)
    tx.partialSign(makerSolanaKeypair)

    return successResponse(req, res, {
      solanaTransactions: [tx.serialize({ requireAllSignatures: false })],
    })
  } catch (error) {
    console.error(error)
    errorResponse(req, res, error.message, mapCode(error), error.errors)
  }
}

export const onboardToMobile = async (req, res) => {
  try {
    const { entityKey, location } = req.body
    if (!entityKey) {
      return errorResponse(req, res, 'Missing entityKey param', 422)
    }

    const program = await init(provider)
    const keyToAsset = await program.account.keyToAssetV0.fetchNullable(
      (await keyToAssetKey(DAO_KEY, entityKey))[0],
    )
    if (!keyToAsset) {
      return errorResponse(
        req,
        res,
        'Key to asset does not exist, has the entity been created?',
        404,
      )
    }
    const assetId = keyToAsset.asset

    const hotspot = await Hotspot.findOne({
      where: {
        [Op.or]: [{ publicAddress: entityKey }],
      },
    })

    if (!hotspot) {
      return errorResponse(req, res, 'Hotspot not found', 404)
    }

    const makerDbEntry = await Maker.scope('withKeypair').findByPk(
      hotspot.makerId,
    )
    const keypairEntropy = Buffer.from(makerDbEntry.keypairEntropy, 'hex')
    const makerSolanaKeypair = SolanaKeypair.fromSeed(keypairEntropy)

    const { instruction } = await (
      await onboardMobileHotspot({
        program,
        location: typeof location === 'undefined' ? null : new BN(location),
        rewardableEntityConfig: rewardableEntityConfigKey(
          MOBILE_SUB_DAO_KEY,
          'MOBILE',
        )[0],
        assetId,
        payer: makerSolanaKeypair.publicKey,
        dcFeePayer: makerSolanaKeypair.publicKey,
        maker: makerKey(DAO_KEY, makerDbEntry.name)[0],
        dao: DAO_KEY,
        assetEndpoint: ASSET_API_URL,
      })
    ).prepare()

    const tx = new SolanaTransaction({
      recentBlockhash: (
        await provider.connection.getLatestBlockhash('confirmed')
      ).blockhash,
      feePayer: makerSolanaKeypair.publicKey,
    })
    tx.add(instruction)
    tx.partialSign(makerSolanaKeypair)

    return successResponse(req, res, {
      solanaTransactions: [tx.serialize({ requireAllSignatures: false })],
    })
  } catch (error) {
    console.error(error)
    errorResponse(req, res, error.message, mapCode(error), error.errors)
  }
}

export const updateMobileMetadata = async (req, res) => {
  try {
    const { entityKey, location, wallet } = req.body
    if (!entityKey) {
      return errorResponse(req, res, 'Missing entityKey param', 422)
    }
    if (!wallet) {
      return errorResponse(req, res, 'Missing wallet param', 422)
    }
    const program = await init(provider)
    const keyToAsset = await program.account.keyToAssetV0.fetchNullable(
      (await keyToAssetKey(DAO_KEY, entityKey))[0],
    )
    if (!keyToAsset) {
      return errorResponse(
        req,
        res,
        'Key to asset does not exist, has the entity been created?',
        404,
      )
    }
    const assetId = keyToAsset.asset

    const hotspot = await Hotspot.findOne({
      where: {
        [Op.or]: [{ publicAddress: entityKey }],
      },
    })

    if (!hotspot) {
      return errorResponse(req, res, 'Hotspot not found', 404)
    }

    const makerDbEntry = await Maker.scope('withKeypair').findByPk(
      hotspot.makerId,
    )
    const keypairEntropy = Buffer.from(makerDbEntry.keypairEntropy, 'hex')
    const makerSolanaKeypair = SolanaKeypair.fromSeed(keypairEntropy)

    const rewardableEntityConfig = rewardableEntityConfigKey(
      MOBILE_SUB_DAO_KEY,
      'MOBILE',
    )[0]
    const [info] = await mobileInfoKey(rewardableEntityConfig, entityKey)
    const infoAcc = await program.account.mobileHotspotInfoV0.fetchNullable(info)
    if (!infoAcc) {
      return errorResponse(
        req,
        res,
        'Hotspot info does not exist, has it been onboarded?',
        404,
      )
    }

    const payer =
      location && (infoAcc.numLocationAsserts < makerDbEntry.locationNonceLimit)
        ? makerSolanaKeypair.publicKey
        : new PublicKey(wallet)

    const { instruction } = await (
      await updateMobileMetadataFn({
        location: typeof location === 'undefined' ? null : new BN(location),
        program,
        rewardableEntityConfig,
        assetId,
        payer,
        dcFeePayer: payer,
        maker: makerKey(DAO_KEY, makerDbEntry.name)[0],
        assetEndpoint: ASSET_API_URL,
      })
    ).prepare()

    const tx = new SolanaTransaction({
      recentBlockhash: (
        await provider.connection.getLatestBlockhash('confirmed')
      ).blockhash,
      feePayer: payer,
    })
    tx.add(instruction)
    if (payer.equals(makerSolanaKeypair.publicKey)) {
      tx.partialSign(makerSolanaKeypair)
    }

    return successResponse(req, res, {
      solanaTransactions: [tx.serialize({ requireAllSignatures: false })],
    })
  } catch (error) {
    console.error(error)
    errorResponse(
      req,
      res,
      error.message,
      mapCode(error),
      error.errors
    )
  }
}

function mapCode(error) {
  if(error.message && error.message.includes("No asset")) {
    return 404
  }
  return 500
}

export const updateIotMetadata = async (req, res) => {
  try {
    const { entityKey, location, elevation, gain, wallet } = req.body
    if (!entityKey) {
      return errorResponse(req, res, 'Missing entityKey param', 422)
    }
    if (!wallet) {
      return errorResponse(req, res, 'Missing wallet param', 422)
    }

    const program = await init(provider)
    const keyToAsset = await program.account.keyToAssetV0.fetchNullable(
      (await keyToAssetKey(DAO_KEY, entityKey))[0],
    )
    if (!keyToAsset) {
      return errorResponse(
        req,
        res,
        'Key to asset does not exist, has the entity been created?',
        404,
      )
    }
    const assetId = keyToAsset.asset

    const hotspot = await Hotspot.findOne({
      where: {
        [Op.or]: [{ publicAddress: entityKey }],
      },
    })

    if (!hotspot) {
      return errorResponse(req, res, 'Hotspot not found', 404)
    }

    const makerDbEntry = await Maker.scope('withKeypair').findByPk(
      hotspot.makerId,
    )
    const keypairEntropy = Buffer.from(makerDbEntry.keypairEntropy, 'hex')
    const makerSolanaKeypair = SolanaKeypair.fromSeed(keypairEntropy)
    const rewardableEntityConfig = rewardableEntityConfigKey(
      IOT_SUB_DAO_KEY,
      'IOT',
    )[0]
    const [info] = await iotInfoKey(rewardableEntityConfig, entityKey)
    const infoAcc = await program.account.iotHotspotInfoV0.fetchNullable(info)
    if (!infoAcc) {
      return errorResponse(
        req,
        res,
        'Hotspot info does not exist, has it been onboarded?',
        404,
      )
    }
    const payer =
      location && (infoAcc.numLocationAsserts < makerDbEntry.locationNonceLimit)
        ? makerSolanaKeypair.publicKey
        : new PublicKey(wallet)


    const { instruction } = await (
      await updateIotMetadataFn({
        location: typeof location === 'undefined' ? null : new BN(location),
        program,
        rewardableEntityConfig,
        assetId,
        elevation: typeof elevation === 'undefined' ? null : elevation,
        gain: typeof gain === "undefined" ? null : gain,
        payer: payer,
        dcFeePayer: payer,
        maker: makerKey(DAO_KEY, makerDbEntry.name)[0],
        assetEndpoint: ASSET_API_URL,
      })
    ).prepare()

    const tx = new SolanaTransaction({
      recentBlockhash: (
        await provider.connection.getLatestBlockhash('confirmed')
      ).blockhash,
      feePayer: payer,
    })
    tx.add(instruction)
    if (payer.equals(makerSolanaKeypair.publicKey)) {
      tx.partialSign(makerSolanaKeypair)
    }

    return successResponse(req, res, {
      solanaTransactions: [tx.serialize({ requireAllSignatures: false })],
    })
  } catch (error) {
    console.error(error)
    errorResponse(req, res, error.message, mapCode(error), error.errors)
  }
}
