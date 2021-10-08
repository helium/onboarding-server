const prompts = require('prompts')
const { utils } = require('@helium/crypto')

const generateToken = async (type, bytes) => {
  const buf = await utils.randomBytes(bytes)
  return [type, buf.toString('base64')].join('_')
}

;(async () => {
  const { Maker, Token } = require('../models')
  const makers = await Maker.findAll()

  const response = await prompts({
    type: 'select',
    name: 'makerId',
    message: 'Select a Maker to create an API token for:',
    choices: makers.map(maker => ({
      title: maker.name,
      value: maker.id,
    })),
  });

  if (!response.makerId) {
    return process.exit(0)
  }

  const maker = await Maker.findByPk(response.makerId)

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
