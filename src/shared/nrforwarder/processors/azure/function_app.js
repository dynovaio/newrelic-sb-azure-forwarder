const NR_DEFAULT_CUSTOM_PROPERTIES_PREFIX = 'custom'
const NR_CUSTOM_PROPERTIES_PREFIX = process.env.NR_CUSTOM_PROPERTIES_PREFIX || NR_DEFAULT_CUSTOM_PROPERTIES_PREFIX

const allowsTracing = false

/**
 * Process logs for Azure Function App
 */
function logProcessor(log, context) {
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
                    Object.entries(otherProperties).filter((item) => NR_DECORATION_PROPERTIES.includes(item[0]))
                )

                otherProperties = Object.fromEntries(
                    Object.entries(otherProperties).filter((item) => !NR_DECORATION_PROPERTIES.includes(item[0]))
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
                [`${NR_CUSTOM_PROPERTIES_PREFIX}`]: properties,
                [`${NR_CUSTOM_PROPERTIES_PREFIX}.meta`]: meta
            }

            if (meta.time !== undefined) {
                structuredLog.timestamp = new Date(meta.time).getTime()
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
