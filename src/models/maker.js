const { Model } = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  class Maker extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Maker.init(
    {
      name: DataTypes.STRING,
      address: DataTypes.STRING,
      apiKey: DataTypes.STRING,
      locationNonceLimit: DataTypes.INTEGER,
      keypairEntropy: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: 'Maker',
    },
  )
  return Maker
}
