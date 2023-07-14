'use strict';

/*
 * Widen public key fields. New key types for RSA-2048 require
 * more characters.
 */
module.exports = {
    up: async (queryInterface, Sequelize) => {
        const transaction = await queryInterface.sequelize.transaction()
        try {
            await queryInterface.changeColumn('hotspots', 'onboarding_key', {
                type: Sequelize.TEXT,
                allowNull: true,
            }, {
                transaction,
            })
            await queryInterface.changeColumn('hotspots', 'public_address', {
                type: Sequelize.TEXT,
                allowNull: true,
            }, {
                transaction,
            })
            await transaction.commit()
        } catch (error) {
            await transaction.rollback()
            throw error
        }
    },

    down: async (queryInterface, Sequelize) => {
        const transaction = await queryInterface.sequelize.transaction()
        try {
            await queryInterface.changeColumn('hotspots', 'onboarding_key', {
                type: Sequelize.STRING,
                allowNull: true,
            }, {
                transaction,
            })
            await queryInterface.changeColumn('hotspots', 'public_address', {
                type: Sequelize.STRING,
                allowNull: true,
            }, {
                transaction,
            })
            await transaction.commit()
        } catch (error) {
            await transaction.rollback()
            throw error
        }
    }
};
