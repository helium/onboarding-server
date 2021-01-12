import { Model } from 'sequelize'
import { keyring } from '@fnando/keyring'
import bcrypt from 'bcryptjs'

const keys = JSON.parse(process.env.KEYRING)
const digestSalt = process.env.KEYRING_SALT

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
      encryptedKeypairEntropy: DataTypes.TEXT,
      keypairEntropy: DataTypes.VIRTUAL,
      keyringId: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: 'Maker',
      tableName: 'makers',
      underscored: true,
      hooks: {
        beforeSave: (record, options) => {
          const encryptor = keyring(keys, { digestSalt })
          const { keypairEntropy } = record

          record.keyringId = encryptor.currentId()
          record.encryptedKeypairEntropy = encryptor.encrypt(keypairEntropy)
          record.apiKey = bcrypt.hashSync(record.apiKey, 10)
        },
        afterFind: (record) => {
          if (!record) return
          const { encryptedKeypairEntropy, keyringId } = record
          if (encryptedKeypairEntropy) {
            const encryptor = keyring(keys, { digestSalt })
            record.keypairEntropy = encryptor.decrypt(
              encryptedKeypairEntropy,
              keyringId,
            )
          }
        },
      },
      defaultScope: {
        attributes: {
          exclude: ['keypairEntropy', 'encryptedKeypairEntropy', 'apiKey'],
        },
      },
      scopes: {
        withApiKey: {
          attributes: {
            include: ['apiKey'],
          }
        },
        withKeypair: {
          attributes: {
            include: ['keypairEntropy', 'encryptedKeypairEntropy'],
          },
        },
      },
    },
  )

  return Maker
}
