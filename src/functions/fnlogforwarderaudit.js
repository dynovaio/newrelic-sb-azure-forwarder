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

app.storageBlob('fnlogforwarderaudit', {
    path: 'insights-logs-auditlogs/{name}',
    connection: 'NR_BLOB_STORAGE_TRIGGER_CONNECTION_STRING',
    handler: async (blob, context) => await NewRelicLogForwarder(blob, context)
});
