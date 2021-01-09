module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Makers', {
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
      apiKey: {
        type: Sequelize.STRING,
      },
      locationNonceLimit: {
        allowNull: false,
        defaultValue: 1,
        type: Sequelize.INTEGER,
      },
      keypairEntropy: {
        type: Sequelize.STRING,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    })
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Makers')
  },
}
