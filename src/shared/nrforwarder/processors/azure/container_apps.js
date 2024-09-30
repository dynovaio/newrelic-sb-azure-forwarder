const allowsTracing = false

/**
 * Process logs for Azure Container Apps
 */
function processLog (log, context, settings) {
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
                properties.Log = JSON.parse(properties.Log)
            } catch (error) {
                context.warn('Can not parse properties.Log to JSON')
            }

            if (typeof properties.Log === 'object' && properties.Log !== null) {
                let { message, ...otherProperties } = properties.Log
                delete properties.Log

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

            if (properties.appName !== undefined) {
                structuredLog.serviceName = properties.appName
            }

            return structuredLog
        }
    }

    return log
}

module.exports = {
    allowsTracing,
    processLog
}
