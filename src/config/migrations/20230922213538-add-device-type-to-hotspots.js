'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    queryInterface.addColumn('hotspots', 'device_type', Sequelize.TEXT)
  },

  down: async (queryInterface, Sequelize) => {
    queryInterface.removeColumn('hotspots', 'device_type', Sequelize.TEXT)
  }
};
