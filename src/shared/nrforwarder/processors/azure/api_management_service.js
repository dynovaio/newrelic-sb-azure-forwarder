const allowsTracing = true

const LogKind = {
    request: 'request',
    response: 'response',
    error: 'error'
}

/**
 * Process logs for Azure API Management Service
 */
function logProcessor (log, context, settings) {
    const { properties, ...meta } = log

    if (properties !== undefined) {
        if (typeof properties === 'object' && properties !== null) {
            let structuredLog = {}

            if (properties.request?.body !== undefined) {
                try {
                    const requestBody = JSON.stringify(JSON.parse(properties.request.body))
                    properties.request.body = 'RequestBody::' + requestBody
                } catch (error) {
                    context.warn("Can't process request body.")
                }
            }

            if (properties.request?.headers !== undefined) {
                try {
                    const requestBeaders = JSON.stringify(JSON.parse(properties.request.headers))
                    properties.request.headers = 'RequestHeaders::' + requestBeaders
                } catch (error) {
                    context.warn("Can't process request headers.")
                }
            }

            if (properties.response?.body !== undefined) {
                try {
                    const responseBody = JSON.stringify(JSON.parse(properties.response.body))
                    properties.response.body = 'ResponseBody::' + responseBody
                } catch (error) {
                    context.warn("Can't process response body.")
                }
            }

            if (properties.response?.headers !== undefined && properties.response?.headers !== '{}') {
                try {
                    const responseBeaders = JSON.stringify(JSON.parse(properties.response.headers))
                    properties.response.headers = 'ResponseHeaders::' + responseBeaders
                } catch (error) {
                    context.warn("Can't process response headers.")
                }
            }

            if (meta.traceId !== undefined && meta.spanId !== undefined) {
                structuredLog = {
                    ...structuredLog,
                    'trace.id': meta.traceId,
                    'span.id': meta.spanId
                }

                if (meta.parentSpanId !== undefined) {
                    structuredLog['parent.id'] = meta.parentSpanId
                }
            }

            delete meta.traceId
            delete meta.spanId
            delete meta.parentSpanId

            structuredLog = {
                ...structuredLog,
                [`${settings.customPropertiesPrefix}`]: properties,
                [`${settings.customPropertiesPrefix}.meta`]: meta
            }

            if (meta.time !== undefined) {
                structuredLog.timestamp = new Date(meta.time).getTime()
            }

            if (meta.serviceName !== undefined) {
                structuredLog.serviceName = meta.serviceName
            }

            let level = 'info'

            if (meta.kind === LogKind.error) {
                level = 'error'
            } else if (properties.response?.status?.code !== undefined && properties.response.status.code >= 400) {
                level = 'error'
            }

            structuredLog.level = level

            return structuredLog
        }
    }

    return log
}

/**
 * Extract tracing informacion from logs for Azure API Management Service
 */
function tracingExtractor (buffer, context, settings) {
    function getHttpUrl (log) {
        const scheme = log[`${settings.customPropertiesPrefix}`].request.url.scheme
        const host = log[`${settings.customPropertiesPrefix}`].request.url.host
        const path = log[`${settings.customPropertiesPrefix}`].request.url.path

        return `${scheme}://${host}${path}`
    }

    let spans = buffer
        .map((log) => {
            const kind = log[`${settings.customPropertiesPrefix}.meta`].kind

            if (kind === LogKind.response || kind === LogKind.error) {
                let span = {
                    'trace.id': log['trace.id'],
                    id: log['span.id'],
                    timestamp: log[`${settings.customPropertiesPrefix}.meta`].time,
                    attributes: {
                        'duration.ms': log[`${settings.customPropertiesPrefix}.meta`].timespan,
                        duration: log[`${settings.customPropertiesPrefix}.meta`].timespan / 1000,
                        name: log[`${settings.customPropertiesPrefix}`].request.originalUrl.path,
                        host: log[`${settings.customPropertiesPrefix}`].request.originalUrl.host,
                        'http.method': log[`${settings.customPropertiesPrefix}`].request.method,
                        'http.url': getHttpUrl(log)
                    }
                }

                if (log['parent.id'] !== undefined && log['parent.id'] !== null) {
                    span.attributes['parent.id'] = log['parent.id']
                }

                if (log.serviceName !== undefined && log.serviceName !== null) {
                    span.attributes['service.name'] = log.serviceName
                }

                if (log[`${settings.customPropertiesPrefix}`].response?.status?.code !== undefined) {
                    span.attributes['http.statusCode'] = log[`${settings.customPropertiesPrefix}`].response.status.code

                    if (span.attributes['http.statusCode'] >= 400) {
                        span.attributes['error'] = true
                        span.attributes['error.message'] = log[`${settings.customPropertiesPrefix}`].response.status.reason
                        span.attributes['error.class'] = log[`${settings.customPropertiesPrefix}`].response.status.reason
                    }
                }

                if (log[`${settings.customPropertiesPrefix}`].response?.status?.reason !== undefined) {
                    span.attributes['http.statusText'] = log[`${settings.customPropertiesPrefix}`].response.status.reason
                }

                if (
                    typeof log[`${settings.customPropertiesPrefix}`].error === 'object' &&
                    log[`${settings.customPropertiesPrefix}`].error !== null
                ) {
                    span.attributes['error'] = true
                    span.attributes['error.message'] = log[`${settings.customPropertiesPrefix}`].error.message
                    span.attributes['error.class'] = log[`${settings.customPropertiesPrefix}`].error.reason
                    span.attributes['error.source'] = log[`${settings.customPropertiesPrefix}`].error.source
                    span.attributes['error.section'] = log[`${settings.customPropertiesPrefix}`].error.section
                }

                return span
            }

            return null
        })
        .filter((span) => span !== null)

    if (spans.length === 0) {
        context.warn('No spans found in the logs.')
    }

    return spans
}

module.exports = {
    logProcessor,
    tracingExtractor,
    allowsTracing
}
