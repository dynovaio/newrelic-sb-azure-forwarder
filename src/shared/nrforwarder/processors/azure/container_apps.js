const allowsTracing = false

/**
 * Process logs for Azure Container Apps
 */
function logProcessor(log, context, settings) {
    console.log('log', log)

    let { properties, ...meta } = log

    if (properties !== undefined) {
        if (typeof properties === 'object' && properties !== null) {
            let structuredLog = {}

            let { Log, ...otherProperties } = properties

            if (typeof Log === 'string') {
                try {
                    Log = JSON.parse(Log)
                } catch (error) {
                    context.warn('Can not parse Log to JSON')
                }
            }

            if (typeof Log === 'object' || Log !== null) {
                let { message, ...otherLogProperties } = Log

                let newrelicDecorationProperties = Object.fromEntries(
                    Object.entries(otherLogProperties).filter((item) => settings.decorationProperties.includes(item[0]))
                )

                otherLogProperties = Object.fromEntries(
                    Object.entries(otherLogProperties).filter(
                        (item) => !settings.decorationProperties.includes(item[0])
                    )
                )

                Log = {
                    message,
                    ...otherLogProperties
                }

                Log = JSON.stringify(Log)

                structuredLog = {
                    ...structuredLog,
                    ...newrelicDecorationProperties
                }
            }

            structuredLog = {
                ...structuredLog,
                [`${settings.customPropertiesPrefix}`]: otherProperties,
                [`${settings.customPropertiesPrefix}.meta`]: meta,
                message: `Message::${Log}`
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
    logProcessor
}
