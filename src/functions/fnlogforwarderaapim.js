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
const { NewRelicForwarder } = require('../shared/nrforwarder');
const { app } = require('@azure/functions');


app.eventHub('fnlogforwardeaapim', {
    connection: 'NR_TRIGGER_CONNECTION_STRING',
    eventHubName: '%eventHubName%',
    cardinality: 'many',
    handler: async (messages, context) => await NewRelicForwarder(messages, context)
});
