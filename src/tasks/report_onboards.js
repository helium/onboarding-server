(async () => {
  const { Maker, Hotspot } = require('../models')
  const { Op } = require('sequelize')
  const makers = await Maker.findAll()

  const results = await Promise.all(makers.map(async (maker) => {
    const total_count = await Hotspot.count({
      where: {
        [Op.and]:
          [
            { makerId: maker.id },
            { onboardingKey: {[Op.ne]: null} },
          ]
      }
    })

    const unonboarded_count = await Hotspot.count({
      where: {
        [Op.and]:
          [
            { makerId: maker.id },
            { publicAddress: {[Op.eq]: null} },
            { onboardingKey: {[Op.ne]: null} },
          ]
      }
    })

    return {
      maker: maker.name,
      makerId: maker.id,
      totalCount: total_count,
      unonboardedCount: unonboarded_count,
    }
  }))

  console.log(results)

  return process.exit(0)
})()
