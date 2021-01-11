'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addIndex(
        'hotspots',
        ['onboarding_key'],
        {
          unique: true,
          transaction,
        }
      );
      await queryInterface.addIndex(
        'hotspots',
        ['public_address'],
        {
          unique: true,
          transaction,
        }
      );
      await queryInterface.addIndex(
        'hotspots',
        ['mac_wlan0'],
        {
          unique: true,
          transaction,
        }
      );
      await queryInterface.addIndex(
        'hotspots',
        ['mac_eth0'],
        {
          unique: true,
          transaction,
        }
      );
      await queryInterface.addIndex(
        'hotspots',
        ['helium_serial'],
        {
          unique: true,
          transaction,
        }
      );
      await queryInterface.addIndex(
        'hotspots',
        ['rpi_serial'],
        {
          unique: true,
          transaction,
        }
      );
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeIndex('hotspots', 'hotspots_onboarding_key', { transaction })
      await queryInterface.removeIndex('hotspots', 'hotspots_public_address', { transaction })
      await queryInterface.removeIndex('hotspots', 'hotspots_mac_wlan0', { transaction })
      await queryInterface.removeIndex('hotspots', 'hotspots_mac_eth0', { transaction })
      await queryInterface.removeIndex('hotspots', 'hotspots_helium_serial', { transaction })
      await queryInterface.removeIndex('hotspots', 'hotspots_rpi_serial', { transaction })
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};
