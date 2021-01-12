module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('makers', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      name: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      address: {
        type: Sequelize.STRING,
      },
      api_key: {
        type: Sequelize.STRING,
      },
      location_nonce_limit: {
        allowNull: false,
        defaultValue: 1,
        type: Sequelize.INTEGER,
      },
      encrypted_keypair_entropy: {
        type: Sequelize.TEXT,
      },
      keyring_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    })
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('makers')
  },
}
