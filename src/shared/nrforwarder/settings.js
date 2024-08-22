/**
 * New Relic Forwarder for Azure Services
 *
 * Developed by Dynova Development Team:
 * - Martin Vuelta <mavuelta@atentus.com>
 * - Eduardo Yallico <eduardo.yallico@atentusinternacional.com>
 * - Luis Factor <luis.factor@atentusinternacional.com>
 */

'use strict'

// New Relic constants
const NR_LOGS_SOURCE = 'azure'
const NR_MAX_PAYLOAD_SIZE = 1000 * 1024

// New Relic settings default values
const NR_DEFAULT_LOG_ENDPOINT = 'https://log-api.newrelic.com/log/v1'
const NR_DEFAULT_TRACE_ENDPOINT = 'https://trace-api.newrelic.com/trace/v1'
const NR_DEFAULT_RETRY_INTERVAL = 2000 // 2 seconds
const NR_DEFAULT_MAX_RETRIES = 3
const NR_DEFAULT_ENVIRONMENT = 'dev'
const NR_DEFAULT_SERVICE_NAME = null
const NR_DEFAULT_SOURCE_SERVICE_TYPE = null
const NR_DEFAULT_FORWARD_TRACING = false
const NR_DEFAULT_CUSTOM_PROPERTIES_PREFIX = 'custom'

// New Relic settings Required settings
const NR_LICENSE_KEY = process.env.NR_LICENSE_KEY

// New Relic Settings with default values
const NR_LOG_ENDPOINT = process.env.NR_LOG_ENDPOINT || NR_DEFAULT_LOG_ENDPOINT
const NR_TRACE_ENDPOINT = process.env.NR_TRACE_ENDPOINT || NR_DEFAULT_TRACE_ENDPOINT
const NR_MAX_RETRIES = parseInt(process.env.NR_MAX_RETRIES) || NR_DEFAULT_MAX_RETRIES
const NR_RETRY_INTERVAL = parseInt(process.env.NR_RETRY_INTERVAL) || NR_DEFAULT_RETRY_INTERVAL
const NR_ENVIRONMENT = process.env.NR_ENVIRONMENT || NR_DEFAULT_ENVIRONMENT
const NR_SERVICE_NAME = process.env.NR_SERVICE_NAME || NR_DEFAULT_SERVICE_NAME
const NR_SOURCE_SERVICE_TYPE = process.env.NR_SOURCE_SERVICE_TYPE || NR_DEFAULT_SOURCE_SERVICE_TYPE
const NR_FORWARD_TRACING = /true/i.test(process.env.NR_FORWARD_TRACING) || NR_DEFAULT_FORWARD_TRACING
const NR_CUSTOM_PROPERTIES_PREFIX = process.env.NR_CUSTOM_PROPERTIES_PREFIX || NR_DEFAULT_CUSTOM_PROPERTIES_PREFIX

// Optional New Relic Settings
const NR_TAGS = process.env.NR_TAGS // Semicolon-seperated tags

// Create configuration class using environment variables as provider for properties
class ForwarderSettings {
    constructor () {
        this.licenseKey = NR_LICENSE_KEY
        this.logEndpoint = NR_LOG_ENDPOINT
        this.traceEndpoint = NR_TRACE_ENDPOINT
        this.maxRetries = NR_MAX_RETRIES
        this.retryInterval = NR_RETRY_INTERVAL
        this.environment = NR_ENVIRONMENT
        this.serviceName = NR_SERVICE_NAME
        this.sourceServiceType = NR_SOURCE_SERVICE_TYPE
        this.forwardTracing = NR_FORWARD_TRACING
        this.customPropertiesPrefix = NR_CUSTOM_PROPERTIES_PREFIX
        this.tags = NR_TAGS
        this.logsSource = NR_LOGS_SOURCE
        this.maxPayloadSize = NR_MAX_PAYLOAD_SIZE
    }

    validate (throwException = false) {
        if (!this.licenseKey) {
            const message = 'You have to configure your New Relic license key.'
            if (throwException) {
                throw new TypeError(message)
            } else {
                context.error(message)
            }

            return false
        }

        if (!this.sourceServiceType) {
            message = 'You have to configure your source service type.'
            if (raiseError) {
                throw new TypeError(message)
            } else {
                context.error(message)
            }

            return false
        }

        if (this.serviceName) {
            message = `You have to configure your service name ${this.serviceName}.`
            context.warn(message)
        }

        return true
    }
}

const settings = new ForwarderSettings()

module.exports = {
    settings
}
