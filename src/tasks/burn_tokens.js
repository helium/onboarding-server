const prompts = require('prompts')
const { Client, Network } = require('@helium/http')
const { TokenBurnV1, Transaction } = require('@helium/transactions')
const { Address, Keypair } = require('@helium/crypto')

;(async () => {
  const client = new Client(Network.production)
  const vars = await client.vars.get()
  Transaction.config(vars)

  const { Maker } = require('../models')
  const makers = await Maker.findAll()

  const makerAccounts = {}

  for (const maker of makers) {
    const account = await client.accounts.get(maker.address)
    makerAccounts[maker.id] = account
  }

  const makerChoice = await prompts({
    type: 'select',
    name: 'makerId',
    message: 'Select a Maker with an HNT balance to burn:',
    choices: makers.map((maker) => ({
      title: `${maker.name} (${makerAccounts[maker.id].balance.toString(2)})`,
      value: maker.id,
      disabled: makerAccounts[maker.id].balance.integerBalance === 0
    })),
  })

  if (!makerChoice.makerId) {
    return process.exit(0)
  }

  const maker = await Maker.findByPk(makerChoice.makerId)
  const makerAccount = makerAccounts[makerChoice.makerId]

  const amountChoice = await prompts({
    type: 'number',
    name: 'amount',
    message: 'How much HNT should be burned?',
    style: 'default',
    float: true,
    round: 8,
    min: 0.00000001,
    max: makerAccount.balance.floatBalance,
    validate: (v) => (v !== '' ? true : 'This field is required'),
  })

  const txn = new TokenBurnV1({
    payer: Address.fromB58(maker.address),
    payee: Address.fromB58(maker.address),
    amount: amountChoice.amount * 100000000,
    nonce: makerAccount.speculativeNonce + 1,
    memo: "",
  })

  console.log('Payer', txn.payer.b58)
  console.log('Payee', txn.payee.b58)
  console.log('Amount (in Bones)', txn.amount)
  console.log('Fee (in DC)', txn.fee)
  console.log('Nonce', txn.nonce)
  console.log('Memo', txn.memo)

  const confirmResponse = await prompts({
    type: 'text',
    name: 'understand',
    message: "Danger! Confirm transaction details above. This will sign and submit a DC Burn transaction. If you know what you are doing, type 'I UNDERSTAND'",
    validate: (v) => (v === "I UNDERSTAND" ? true : 'This field is required'),
  })


  if (confirmResponse.understand !== 'I UNDERSTAND') {
    return process.exit(0)
  }

  const makerWithKeypair = await Maker.scope('withKeypair').findByPk(makerChoice.makerId)
  const keypairEntropy = Buffer.from(makerWithKeypair.keypairEntropy, 'hex')

  const keypair = await Keypair.fromEntropy(keypairEntropy)

  const signedTxn = await txn.sign({ payer: keypair })

  const pendingTxn = await client.transactions.submit(signedTxn.toString())

  console.log(pendingTxn)

  return process.exit(0)
})()
