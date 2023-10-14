(async (args) => {
  const yargs = require('yargs')
  const { Maker, Hotspot } = require('../models')
  const { Op } = require('sequelize')
  const makers = await Maker.findAll()
  const yarg = yargs(args).options({
    format: {
      alias: "f",
      describe: "Output format",
      type: "string",
      default: "json",
    },
  })

  const argv = await yarg.argv;

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
      name: maker.name,
      id: maker.id,
      totalCount: total_count,
      unonboardedCount: unonboarded_count,
    }
  }))

  if (argv.format == "csv") {
    console.log( [ "id", "name", "total", "unonboarded" ].join(",") )
    console.log(
      results.map(maker =>
        [ maker.id, maker.name, maker.totalCount, maker.unonboardedCount ]
        .join(",")
      ).join("\n")
    )
  } else {
    console.log(results)
  }

  return process.exit(0)
})(process.argv)
