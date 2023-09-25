const { Model } = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  class Hotspot extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.maker = this.belongsTo(models.Maker, {
        foreignKey: 'makerId',
      })
    }
  }
  Hotspot.init(
    {
      onboardingKey: DataTypes.TEXT,
      macWlan0: DataTypes.STRING,
      rpiSerial: DataTypes.STRING,
      batch: DataTypes.STRING,
      publicAddress: DataTypes.TEXT,
      heliumSerial: DataTypes.STRING,
      macEth0: DataTypes.STRING,
      deviceType: DataTypes.TEXT,
    },
    {
      defaultScope: {
        attributes: { exclude: ['MakerId'] },
      },
      sequelize,
      modelName: 'Hotspot',
      underscored: true,
    },
  )
  return Hotspot
}
