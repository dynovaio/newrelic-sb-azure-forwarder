/**
 * New Relic Log forwarder for Azure B2C
 *
 * Developed by Atentus Peru Development Team:
 * - Martin Vuelta <mavuelta@atentus.com>
 * - Eduardo Yallico <eduardo.yallico@atentusinternacional.com>
 * - Luis Factor <luis.factor@atentusinternacional.com>
 */
'use strict';


/**
 * Log Forwarder Application
 */
const { checkData } = require('../shared/nrlogforwarder');
const { app } = require('@azure/functions');


app.eventHub('fnlogforwardersignin', {
    connection: 'NR_TRIGGER_CONNECTION_STRING',
    eventHubName: 'insights-logs-signinlogs',
    cardinality: 'many',
    handler: async (blob, context) => await checkData(blob, context)
});
