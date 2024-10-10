const allowsTracing = false

/**
 * Process logs for Azure Container Apps
 */
function logProcessor (log, context, settings) {
    console.log('log', log)

    let { properties, ...meta } = log

    if (properties !== undefined) {
        if (typeof properties === 'object' && properties !== null) {
            let structuredLog = {}

            try {
                properties.Log = JSON.parse(properties.Log)
            } catch (error) {
                context.warn('Can not parse properties.Log to JSON')
            }

            let { Log, ...otherProperties } = properties.Log
            delete properties.Log

            structuredLog = {
                ...structuredLog,
                [`${settings.customPropertiesPrefix}`]: {
                    ...otherProperties,
                    ...properties
                },
                [`${settings.customPropertiesPrefix}.meta`]: meta,
                message: "Message::" + JSON.stringify(Log)
            }

            /*
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
            }

            if (typeof properties.Log === 'string' && properties.Log !== '') {
                structuredLog = {
                    ...structuredLog,
                    message: properties.Log
                }
            }

            let { message, ...otherProperties } = properties

            if (typeof message === 'string' && message !== '') {
                structuredLog = {
                    ...structuredLog,
                    message
                }

                properties = otherProperties
            } else if (typeof message === 'object' && message !== null) {
                structuredLog = {
                    ...structuredLog,
                    message: 'Message::' + JSON.stringify(message)
                }

                properties = otherProperties
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
            */

            return structuredLog
        }
    }

    return log
}

module.exports = {
    allowsTracing,
    logProcessor
}
