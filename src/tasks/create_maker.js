const prompts = require('prompts')
const { Keypair, utils } = require('@helium/crypto')

const generateToken = async (type, bytes) => {
  const buf = await utils.randomBytes(bytes)
  return [type, buf.toString('base64')].join('_')
}

;(async () => {
  const { Maker, Token } = require('../models')

  const response = await prompts([
    {
      type: 'text',
      name: 'name',
      message: "What is the Maker's name?",
      validate: (name) => (name.length > 0 ? true : 'This field is required'),
    },
    {
      type: 'number',
      name: 'locationNonceLimit',
      message: 'How many assert location transactions should be paid for?',
      style: 'default',
      min: 0,
      max: 10,
      validate: (v) => (v !== '' ? true : 'This field is required'),
    },
    {
      type: 'text',
      name: 'keypairEntropy',
      message: '(optional) What is the wallet entropy?',
    },
    {
      type: 'confirm',
      name: 'apiKey',
      message: 'Do you want to create an API key for this Maker?',
    },
  ])

  if (!response.name || !response.locationNonceLimit) {
    return process.exit(0)
  }

  let keypairEntropy
  if (response.keypairEntropy) {
    keypairEntropy = Buffer.from(response.keypairEntropy, 'hex')
  } else {
    keypairEntropy = await utils.randomBytes(32)
  }
  const keypair = await Keypair.fromEntropy(keypairEntropy)
  const address = keypair.address.b58

  const maker = await Maker.create({
    name: response.name,
    address,
    keypairEntropy: keypairEntropy.toString('hex'),
    locationNonceLimit: response.locationNonceLimit,
  })

  console.log('Maker successfully created')
  console.log({
    id: maker.id,
    name: maker.name,
    address: maker.address,
    locationNonceLimit: maker.locationNonceLimit,
  })

  if (response.apiKey === false) {
    return process.exit(0)
  }

  const publicToken = await generateToken('pk', 32)
  const secretToken = await generateToken('sk', 64)

  const token = await Token.create({
    publicToken,
    secretToken,
    makerId: maker.id,
  })

  console.log('Maker API key successfully created')
  console.log({
    maker: maker.name,
    makerId: maker.id,
    publicToken: token.publicToken,
    secretToken,
  })

  return process.exit(0)
})()
