const prompts = require('prompts')

;(async () => {
  const { Maker } = require('../models')
  const makers = await Maker.findAll()

  const response = await prompts({
    type: 'select',
    name: 'makerId',
    message: 'Select a Maker to export:',
    choices: makers.map((maker) => ({
      title: maker.name,
      value: maker.id,
    })),
  })

  if (!response.makerId) {
    return process.exit(0)
  }

  const confirmResponse = await prompts({
    type: 'text',
    name: 'understand',
    message: "Danger! The selected Maker's **UNENCRYPTED** wallet entropy seed will now be displayed. This provides full access to the Maker wallet including its DC, HNT and onboarding rights. If you know what you are doing, type 'I UNDERSTAND'",
    validate: (v) => (v === "I UNDERSTAND" ? true : 'This field is required'),
  })

  if (confirmResponse.understand !== 'I UNDERSTAND') {
    return process.exit(0)
  }

  const maker = await Maker.scope('withKeypair').findByPk(response.makerId)
  const keypairEntropy = maker.keypairEntropy

  console.log('Maker details:')
  console.log({
    id: maker.id,
    name: maker.name,
    address: maker.address,
    locationNonceLimit: maker.locationNonceLimit,
  })

  console.log('Maker wallet entropy:')
  console.log(keypairEntropy)
  return process.exit(0)
})()
