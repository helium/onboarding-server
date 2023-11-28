const { Model } = require('sequelize')
const { keyring } = require('@fnando/keyring')
const Address = require('@helium/address').default
const { PublicKey } = require('@solana/web3.js')

const keys = JSON.parse(process.env.KEYRING)
const digestSalt = process.env.KEYRING_SALT

module.exports = (sequelize, DataTypes) => {
  class Maker extends Model {
    static associate(models) {
      this.hotspots = this.hasMany(models.Hotspot)
      this.tokens = this.hasMany(models.Token)
    }
  }
  Maker.init(
    {
      name: DataTypes.STRING,
      address: DataTypes.STRING,
      locationNonceLimit: DataTypes.INTEGER,
      encryptedKeypairEntropy: DataTypes.TEXT,
      keypairEntropy: DataTypes.VIRTUAL,
      keyringId: DataTypes.INTEGER,
      solanaAddress: DataTypes.VIRTUAL,
    },
    {
      sequelize,
      modelName: 'Maker',
      tableName: 'makers',
      underscored: true,
      hooks: {
        beforeCreate: (record) => {
          const encryptor = keyring(keys, { digestSalt })
          const { keypairEntropy } = record

          record.keyringId = encryptor.currentId()
          record.encryptedKeypairEntropy = encryptor.encrypt(keypairEntropy)
        },
        afterFind: (record) => {
          if (!record) return

          const records = Array.isArray(record) ? record : [record]
          for (const record of records) {
            const addr = record.address && Address.fromB58(record.address)
            record.solanaAddress =
              addr && new PublicKey(addr.publicKey).toBase58()
          }

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
          exclude: ['keypairEntropy', 'encryptedKeypairEntropy', 'keyringId'],
        },
      },
      scopes: {
        withKeypair: {
          attributes: {
            include: ['keypairEntropy', 'encryptedKeypairEntropy', 'keyringId'],
          },
        },
      },
    },
  )

  return Maker
}
