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
import {
  PROGRAM_ID as BUBBLEGUM_PROGRAM_ID,
  TreeConfig,
} from '@metaplex-foundation/mpl-bubblegum'
import { AddGatewayV1, Transaction } from '@helium/transactions'
import {
  Keypair as SolanaKeypair,
  PublicKey,
  SystemProgram,
  Transaction as SolanaTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js'
import { Op } from 'sequelize'
import { errorResponse, successResponse } from '../helpers'
import { ASSET_API_URL, provider } from '../helpers/solana'
import { Hotspot, Maker } from '../models'
import BN from 'bn.js'
import bs58 from 'bs58'
import { sendInstructions, withPriorityFees } from '@helium/spl-utils'
import axios from 'axios'

const ECC_VERIFY_ENDPOINT = process.env.ECC_VERIFY_ENDPOINT
const IOT_MINT = new PublicKey(process.env.IOT_MINT)
const HNT_MINT = new PublicKey(process.env.HNT_MINT)
const MOBILE_MINT = new PublicKey(process.env.MOBILE_MINT)
const ECC_VERIFIER = new PublicKey(process.env.ECC_VERIFIER)
const DAO_KEY = daoKey(HNT_MINT)[0]
const IOT_SUB_DAO_KEY = subDaoKey(IOT_MINT)[0]
const MOBILE_SUB_DAO_KEY = subDaoKey(MOBILE_MINT)[0]
const INITIAL_SOL = process.env.INITIAL_SOL

const BASE_PRIORITY_FEE_MICROLAMPORTS = Number(
  process.env.BASE_PRIORITY_FEE_MICROLAMPORTS || '1',
)

export const createHotspot = async (req, res) => {
  const { transaction, payer: inPayer } = req.body
  console.log(req.body)
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
    let payer
    if (!inPayer) {
      payer = makerSolanaKeypair.publicKey
    } else {
      payer = new PublicKey(inPayer)
    }
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
        await withPriorityFees({
          connection: provider.connection,
          instructions: [createMerkle, updateTree],
          basePriorityFee: BASE_PRIORITY_FEE_MICROLAMPORTS,
          computeUnits: 500000,
        }),
        [makerSolanaKeypair, newMerkle],
        makerSolanaKeypair.publicKey,
        'confirmed',
      )
    }

    const hotspotOwner = new PublicKey(txn.owner.publicKey)

    const { instruction: solanaIx, pubkeys } = await sdk.methods
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
      .prepare()

    let solanaTransactions = []
    // Only return txns if the hotspot doesn't exist
    if (!(await provider.connection.getAccountInfo(pubkeys.keyToAsset))) {
      const tx = new SolanaTransaction({
        recentBlockhash: (
          await provider.connection.getLatestBlockhash('finalized')
        ).blockhash,
        feePayer: makerSolanaKeypair.publicKey,
      })
      tx.add(
        ...(await withPriorityFees({
          connection: provider.connection,
          instructions: [solanaIx],
          computeScaleUp: 1.5,
          basePriorityFee: BASE_PRIORITY_FEE_MICROLAMPORTS,
        })),
      )

      // If INITIAL_SOL env provided, fund new wallets with that amount of sol
      // Only fund the wallet if they aren't doing a payer override.
      if (INITIAL_SOL && !payer) {
        const ownerAcc = await provider.connection.getAccountInfo(hotspotOwner)
        const initialLamports =
          (await provider.connection.getMinimumBalanceForRentExemption(0)) +
          Number(INITIAL_SOL) * LAMPORTS_PER_SOL
        if (!ownerAcc || ownerAcc.lamports < initialLamports) {
          tx.add(
            SystemProgram.transfer({
              fromPubkey: makerSolanaKeypair.publicKey,
              toPubkey: hotspotOwner,
              lamports: ownerAcc
                ? initialLamports - ownerAcc.lamports
                : initialLamports,
            }),
          )
        }
      }

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
        return errorResponse(
          req,
          res,
          'Invalid gateway signature',
          e.response.status || 400,
        )
      }
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
    const { entityKey, location, elevation, gain, payer: inPayer } = req.body
    console.log(req.body)
    if (!entityKey) {
      return errorResponse(req, res, 'Missing entityKey param', 422)
    }

    const program = await init(provider)
    const keyToAsset = await program.account.keyToAssetV0.fetchNullable(
      (
        await keyToAssetKey(DAO_KEY, entityKey, 'b58')
      )[0],
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
    let payer
    if (!inPayer) {
      payer = makerSolanaKeypair.publicKey
    } else {
      payer = new PublicKey(inPayer)
    }
    const dcFeePayer = payer

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
        payer,
        dcFeePayer,
        maker: makerKey(DAO_KEY, makerDbEntry.name)[0],
        dao: DAO_KEY,
        assetEndpoint: ASSET_API_URL,
      })
    ).prepare()

    const tx = new SolanaTransaction({
      recentBlockhash: (
        await provider.connection.getLatestBlockhash('finalized')
      ).blockhash,
      feePayer: makerSolanaKeypair.publicKey,
    })
    tx.add(
      ...(await withPriorityFees({
        instructions: [instruction],
        connection: provider.connection,
        basePriorityFee: BASE_PRIORITY_FEE_MICROLAMPORTS,
        computeScaleUp: 1.5,
      })),
    )
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
    const { entityKey, location, payer: inPayer, deploymentInfo } = req.body
    if (!entityKey) {
      return errorResponse(req, res, 'Missing entityKey param', 422)
    }

    const program = await init(provider)
    const keyToAsset = await program.account.keyToAssetV0.fetchNullable(
      (
        await keyToAssetKey(DAO_KEY, entityKey, 'b58')
      )[0],
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
    let payer
    if (!inPayer) {
      payer = makerSolanaKeypair.publicKey
    } else {
      payer = new PublicKey(inPayer)
    }
    const dcFeePayer = payer

    const { instruction } = await (
      await onboardMobileHotspot({
        program,
        location: typeof location === 'undefined' ? null : new BN(location),
        rewardableEntityConfig: rewardableEntityConfigKey(
          MOBILE_SUB_DAO_KEY,
          'MOBILE',
        )[0],
        assetId,
        payer,
        dcFeePayer,
        maker: makerKey(DAO_KEY, makerDbEntry.name)[0],
        dao: DAO_KEY,
        assetEndpoint: ASSET_API_URL,
        deviceType: hotspot.deviceType
          ? lowercaseFirstLetter(hotspot.deviceType)
          : 'cbrs',
        deploymentInfo: typeof deploymentInfo === 'undefined' ? null : deploymentInfo,
      })
    ).prepare()

    const tx = new SolanaTransaction({
      recentBlockhash: (
        await provider.connection.getLatestBlockhash('finalized')
      ).blockhash,
      feePayer: makerSolanaKeypair.publicKey,
    })

    tx.add(
      ...(await withPriorityFees({
        instructions: [instruction],
        connection: provider.connection,
        basePriorityFee: BASE_PRIORITY_FEE_MICROLAMPORTS,
        computeScaleUp: 1.5,
      })),
    )

    tx.partialSign(makerSolanaKeypair)

    return successResponse(req, res, {
      solanaTransactions: [tx.serialize({ requireAllSignatures: false })],
    })
  } catch (error) {
    console.error(error)
    errorResponse(req, res, error.message, mapCode(error), error.errors)
  }
}

function lowercaseFirstLetter(str) {
  if (str.length === 0) {
    return str // Handle empty string
  }

  return str.charAt(0).toLowerCase() + str.slice(1)
}

export const updateMobileMetadata = async (req, res) => {
  try {
    const {
      entityKey,
      location,
      wallet,
      payer: passedPayer,
      deploymentInfo,
    } = req.body
    if (!entityKey) {
      return errorResponse(req, res, 'Missing entityKey param', 422)
    }
    if (!wallet) {
      return errorResponse(req, res, 'Missing wallet param', 422)
    }
    const program = await init(provider)
    const keyToAsset = await program.account.keyToAssetV0.fetchNullable(
      (
        await keyToAssetKey(DAO_KEY, entityKey, 'b58')
      )[0],
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

    const makerDbEntry =
      hotspot && (await Maker.scope('withKeypair').findByPk(hotspot.makerId))
    const keypairEntropy =
      makerDbEntry && Buffer.from(makerDbEntry.keypairEntropy, 'hex')
    const makerSolanaKeypair =
      keypairEntropy && SolanaKeypair.fromSeed(keypairEntropy)

    if (
      makerSolanaKeypair &&
      makerSolanaKeypair.publicKey.toBase58() === passedPayer
    ) {
      return errorResponse(req, res, 'Payer cannot be the maker', 422)
    }

    const rewardableEntityConfig = rewardableEntityConfigKey(
      MOBILE_SUB_DAO_KEY,
      'MOBILE',
    )[0]
    const [info] = await mobileInfoKey(rewardableEntityConfig, entityKey)
    const infoAcc = await program.account.mobileHotspotInfoV0.fetchNullable(
      info,
    )

    if (!infoAcc) {
      return errorResponse(
        req,
        res,
        'Hotspot info does not exist, has it been onboarded?',
        404,
      )
    }

    const payer = passedPayer
      ? new PublicKey(passedPayer)
      : location &&
        makerDbEntry &&
        infoAcc.numLocationAsserts < makerDbEntry.locationNonceLimit
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
        assetEndpoint: ASSET_API_URL,
        deploymentInfo: typeof deploymentInfo === 'undefined' ? null : deploymentInfo,
      })
    ).prepare()

    const tx = new SolanaTransaction({
      recentBlockhash: (
        await provider.connection.getLatestBlockhash('finalized')
      ).blockhash,
      feePayer: payer,
    })

    tx.add(
      ...(await withPriorityFees({
        instructions: [instruction],
        connection: provider.connection,
        basePriorityFee: BASE_PRIORITY_FEE_MICROLAMPORTS,
        computeScaleUp: 1.5,
      })),
    )

    if (makerSolanaKeypair && payer.equals(makerSolanaKeypair.publicKey)) {
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

function mapCode(error) {
  if (error.message && error.message.includes('No asset')) {
    return 404
  }
  return 500
}

export const updateIotMetadata = async (req, res) => {
  try {
    const {
      entityKey,
      location,
      elevation,
      gain,
      wallet,
      payer: passedPayer,
    } = req.body
    if (!entityKey) {
      return errorResponse(req, res, 'Missing entityKey param', 422)
    }
    if (!wallet) {
      return errorResponse(req, res, 'Missing wallet param', 422)
    }

    const program = await init(provider)
    const keyToAsset = await program.account.keyToAssetV0.fetchNullable(
      (
        await keyToAssetKey(DAO_KEY, entityKey, 'b58')
      )[0],
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

    const makerDbEntry =
      hotspot && (await Maker.scope('withKeypair').findByPk(hotspot.makerId))
    const keypairEntropy =
      makerDbEntry && Buffer.from(makerDbEntry.keypairEntropy, 'hex')
    const makerSolanaKeypair =
      keypairEntropy && SolanaKeypair.fromSeed(keypairEntropy)

    if (
      makerSolanaKeypair &&
      makerSolanaKeypair.publicKey.toBase58() === passedPayer
    ) {
      return errorResponse(req, res, 'Payer cannot be the maker', 422)
    }

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

    const payer = passedPayer
      ? new PublicKey(passedPayer)
      : location &&
        makerSolanaKeypair &&
        infoAcc.numLocationAsserts < makerDbEntry.locationNonceLimit
      ? makerSolanaKeypair.publicKey
      : new PublicKey(wallet)

    const { instruction } = await (
      await updateIotMetadataFn({
        location: typeof location === 'undefined' ? null : new BN(location),
        program,
        rewardableEntityConfig,
        assetId,
        elevation: typeof elevation === 'undefined' ? null : elevation,
        gain: typeof gain === 'undefined' ? null : gain,
        payer: payer,
        dcFeePayer: payer,
        assetEndpoint: ASSET_API_URL,
      })
    ).prepare()

    const tx = new SolanaTransaction({
      recentBlockhash: (
        await provider.connection.getLatestBlockhash('finalized')
      ).blockhash,
      feePayer: payer,
    })

    tx.add(
      ...(await withPriorityFees({
        instructions: [instruction],
        connection: provider.connection,
        basePriorityFee: BASE_PRIORITY_FEE_MICROLAMPORTS,
        computeScaleUp: 1.5,
      })),
    )

    if (makerSolanaKeypair && payer.equals(makerSolanaKeypair.publicKey)) {
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
