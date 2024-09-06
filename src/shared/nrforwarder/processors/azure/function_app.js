const allowsTracing = false

/**
 * Get log level from levelId reported by Azure Function App logger.
 *
 * @param {*} levelId
 * @returns string
 *
 */
const getLogLevel = (levelId) => {
    switch (levelId) {
        case 0:
            return 'trace'
        case 1:
            return 'debug'
        case 2:
            return 'info'
        case 3:
            return 'warn'
        case 4:
            return 'error'
        case 5:
            /**
             * According to Azure Function App documentation,
             * levelId 5 is not used corresponding to 'critical' level
             * https://learn.microsoft.com/en-us/azure/azure-functions/configure-monitoring?tabs=v2#configure-log-levels
             */
            return 'error'
        default:
            return 'info'
    }
}

/**
 * Process logs for Azure Function App
 */
function logProcessor (log, context, settings) {
    let { properties, ...meta } = log

    if (properties !== undefined) {
        if (typeof properties === 'string') {
            try {
                properties = JSON.parse(properties.replace(/'/g, '"'))
            } catch (error) {
                context.warn('Can not parse properties to JSON')
            }
        }

        if (typeof properties === 'object' && properties !== null) {
            let structuredLog = {}

            try {
                properties.message = JSON.parse(properties.message.replace(/'/g, '"'))
            } catch (error) {
                context.warn('Can not parse properties.message to JSON')
            }

            if (typeof properties.message === 'object' && properties.message !== null) {
                let { message, ...otherProperties } = properties.message
                delete properties.message

                let newrelicDecorationProperties = Object.fromEntries(
                    Object.entries(otherProperties).filter((item) => settings.decorationProperties.includes(item[0]))
                )

                otherProperties = Object.fromEntries(
                    Object.entries(otherProperties).filter((item) => !settings.decorationProperties.includes(item[0]))
                )

                structuredLog = {
                    ...structuredLog,
                    ...newrelicDecorationProperties
                }

                properties = {
                    ...properties,
                    ...otherProperties,
                    message
                }
            } else if (typeof properties.message === 'string' && properties.message !== '') {
                let { message, ...otherProperties } = properties

                structuredLog = {
                    ...structuredLog,
                    message
                }

                properties = {
                    ...otherProperties
                }
            }

            structuredLog = {
                ...structuredLog,
                [`${settings.customPropertiesPrefix}`]: properties,
                [`${settings.customPropertiesPrefix}.meta`]: meta
            }

            if (meta.time !== undefined) {
                structuredLog.timestamp = new Date(meta.time).getTime()
            }

            if (meta.level !== undefined) {
                structuredLog.level = getLogLevel(meta.level)
            }

            if (properties.appName !== undefined) {
                structuredLog.serviceName = properties.appName
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
