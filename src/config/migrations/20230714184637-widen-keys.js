'use strict';

/*
 * Widen public key fields. New key types for RSA-2048 require
 * more characters.
 */
module.exports = {
    up: (queryInterface, Sequelize) => {
        return Promise.all([
            queryInterface.changeColumn('hotspots', 'onboarding_key', {
                type: Sequelize.TEXT,
                allowNull: true,
            }, {
                transaction,
            }),
            queryInterface.changeColumn('hotspots', 'public_address', {
                type: Sequelize.TEXT,
                allowNull: true,
            }, {
                transaction,
            })
        ])
    },

    down: (queryInterface, Sequelize) => {
        return Promise.all([
            queryInterface.changeColumn('hotspots', 'onboarding_key', {
                type: Sequelize.STRING,
                allowNull: true,
            }, {
                transaction,
            }),
            queryInterface.changeColumn('hotspots', 'public_address', {
                type: Sequelize.STRING,
                allowNull: true,
            }, {
                transaction,
            })
        ])
    }
};
