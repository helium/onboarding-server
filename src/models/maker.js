import { Model } from 'sequelize'

module.exports = (sequelize, DataTypes) => {
  class Maker extends Model {
    static associate(models) {
      this.hotspots = this.hasMany(models.Hotspot)
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
      tableName: 'makers',
      underscored: true,
      defaultScope: {
        attributes: { exclude: ['keypairEntropy', 'apiKey'] },
      },
      scopes: {
        withKeypair: {
          attributes: {
            include: ['keypairEntropy'],
          },
        },
      },
    },
  )
  return Maker
}
