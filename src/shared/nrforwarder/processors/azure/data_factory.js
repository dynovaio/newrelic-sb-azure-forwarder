const allowsTracing = false

/**
 * Get log level from levelId reported by Azure Data Factory logger.
 *
 * @param {*} levelId
 * @returns string
 *
 */
const getLogLevel = (level) => {
    switch (level) {
        case 'Informational':
            return 'info'
        case 'Warning':
            return 'warn'
        case 'Error':
            return 'error'
        case 'Critical':
            return 'error'
        default:
            return 'info'
    }
}

/**
 * Process logs for Azure Data Factory
 */
function logProcessor(log, context, settings) {
    const { properties, ...meta } = log

    if (properties !== undefined) {
        if (typeof properties === 'object' && properties !== null) {
            let structuredLog = {}

            structuredLog = {
                ...structuredLog,
                [`${settings.customPropertiesPrefix}`]: properties,
                [`${settings.customPropertiesPrefix}.meta`]: meta
            }

            if (meta.time !== undefined) {
                structuredLog.timestamp = new Date(meta.time).getTime()
            }

            if (meta.resourceId !== undefined) {
                structuredLog.serviceName = meta.resourceId.split('/').at(-1).toLowerCase()
            }

            if (meta.level !== undefined) {
                structuredLog.level = getLogLevel(meta.level)
            }

            return structuredLog
        }
    }

    return log
}

module.exports = {
    logProcessor,
    allowsTracing
}
