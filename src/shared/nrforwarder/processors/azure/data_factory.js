const NR_DEFAULT_CUSTOM_PROPERTIES_PREFIX = 'custom'
const NR_CUSTOM_PROPERTIES_PREFIX = process.env.NR_CUSTOM_PROPERTIES_PREFIX || NR_DEFAULT_CUSTOM_PROPERTIES_PREFIX

const allowsTracing = true

const LogKind = {
    request: 'request',
    response: 'response',
    error: 'error'
}

/**
 * Process logs for Azure API Management Service
 */
function logProcessor (log, context) {
    const { properties, ...meta } = log

    if (properties !== undefined) {
        if (typeof properties === 'object' && properties !== null) {
            let structuredLog = {}

            structuredLog = {
                ...structuredLog,
                [`${NR_CUSTOM_PROPERTIES_PREFIX}`]: properties,
                [`${NR_CUSTOM_PROPERTIES_PREFIX}.meta`]: meta
            }

            if (meta.time !== undefined) {
                structuredLog.timestamp = new Date(meta.time).getTime()
            }

            if (meta.resourceId !== undefined) {
                structuredLog.serviceName = meta.resourceId.split('/').at(-1).toLowerCase();
            }

            return structuredLog
        }
    }

    return log
}

module.exports = {
    logProcessor,
    tracingExtractor,
    allowsTracing
}
