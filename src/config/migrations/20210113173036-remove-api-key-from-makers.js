'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    queryInterface.removeColumn('makers', 'api_key')
  },

  down: async (queryInterface, Sequelize) => {
    queryInterface.addColumn('makers', 'api_key', Sequelize.STRING)
  }
};
