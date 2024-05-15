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
const { NewRelicLogForwarder } = require('../shared/nrlogforwarder');
const { app } = require('@azure/functions');


app.eventHub('fnlogforwarderresponses', {
    connection: 'NR_TRIGGER_CONNECTION_STRING',
    eventHubName: 'newrelic-logs-responses',
    cardinality: 'many',
    handler: async (messages, context) => await NewRelicLogForwarder(messages, context)
});
