'use strict'
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction()
    try {
      await queryInterface.createTable(
        'tokens',
        {
          id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
          },
          public_token: {
            allowNull: false,
            type: Sequelize.STRING,
          },
          secret_token: {
            allowNull: false,
            type: Sequelize.STRING,
          },
          maker_id: {
            allowNull: false,
            type: Sequelize.INTEGER,
            references: {
              model: {
                tableName: 'makers',
              },
              key: 'id',
            },
          },
          last_used_at: {
            type: Sequelize.DATE,
          },
          created_at: {
            allowNull: false,
            type: Sequelize.DATE,
          },
          updated_at: {
            allowNull: false,
            type: Sequelize.DATE,
          },
        },
        {
          transaction,
        },
      )
      await queryInterface.addIndex('tokens', ['public_token'], {
        unique: true,
        transaction,
      })
      await queryInterface.addIndex('tokens', ['secret_token'], {
        unique: true,
        transaction,
      })
      await transaction.commit();
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  },
  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction()
    try {
      await queryInterface.dropTable('tokens', { transaction })
      await queryInterface.removeIndex('tokens', 'tokens_public_token', {
        transaction,
      })
      await queryInterface.removeIndex('tokens', 'tokens_secret_token', {
        transaction,
      })
      await transaction.commit()
    } catch (err) {
      await transaction.rollback()
      throw err
    }
  },
}
