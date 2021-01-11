'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('hotspots', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
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
      onboarding_key: {
        type: Sequelize.STRING
      },
      mac_wlan0: {
        type: Sequelize.STRING
      },
      rpi_serial: {
        type: Sequelize.STRING
      },
      batch: {
        type: Sequelize.STRING
      },
      public_address: {
        type: Sequelize.STRING
      },
      helium_serial: {
        type: Sequelize.STRING
      },
      mac_eth0: {
        type: Sequelize.STRING
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('hotspots');
  }
};
