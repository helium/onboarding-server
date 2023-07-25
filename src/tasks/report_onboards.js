
const prompts = require('prompts')

;(async () => {
  const { Maker, Hotspot } = require('../models')
  const { Op } = require('sequelize')
  const makers = await Maker.findAll()

  const response = await prompts({
    type: 'select',
    name: 'makerId',
    message: 'Select a Maker to generate report for:',
    choices: makers.map(maker => ({
      title: maker.name,
      value: maker.id,
    })),
  });

  if (!response.makerId) {
    return process.exit(0)
  }

  const maker = await Maker.findByPk(response.makerId)

  const total_count = await Hotspot.count({
    [Op.and]:
        [
            { makerId: maker.id },
            { onboardingKey: {[Op.ne]: null} },
        ]
  })

  const unonboarded_count = await Hotspot.count({
    [Op.and]:
        [
            { makerId: maker.id },
            { publicAddress: {[Op.eq]: null} },
            { onboardingKey: {[Op.ne]: null} },
        ]
  })

  console.log({
    maker: maker.name,
    makerId: maker.id,
    totalCount: total_count,
    unonboardedCount: unonboarded_count,
  })

  return process.exit(0)
})()
