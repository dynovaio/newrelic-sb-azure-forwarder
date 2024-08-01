const NR_DEFAULT_CUSTOM_PROPERTIES_PREFIX = 'custom'
const NR_CUSTOM_PROPERTIES_PREFIX = process.env.NR_CUSTOM_PROPERTIES_PREFIX || NR_DEFAULT_CUSTOM_PROPERTIES_PREFIX;

const LogKind = {
    request: 'request',
    response: 'response',
    error: 'error',
};
/**
 * Process logs for API Management
 */
function logProcessor (log, context) {
    const { properties, ...meta } = log;

    if (properties !== undefined) {
        if (typeof properties === 'object' && properties !== null) {
            let structuredLog = {};

            if (properties.request?.body !== undefined) {
                try {
                    const requestBody = JSON.stringify(JSON.parse(properties.request.body));
                    properties.request.body = "RequestBody::" + requestBody;
                } catch (error) {
                    context.warn("Can't process request body.");
                }
            }

            if (properties.request?.headers !== undefined) {
                try {
                    const requestBeaders = JSON.stringify(JSON.parse(properties.request.headers));
                    properties.request.headers = "RequestHeaders::" + requestBeaders;
                } catch (error) {
                    context.warn("Can't process request headers.");
                }
            }

            if (properties.response?.body !== undefined) {
                try {
                    const responseBody = JSON.stringify(JSON.parse(properties.response.body));
                    properties.response.body = "ResponseBody::" + responseBody;
                } catch (error) {
                    context.warn("Can't process response body.");
                }
            }

            if (properties.response?.headers !== undefined && properties.response?.headers !== '{}') {
                try {
                    const responseBeaders = JSON.stringify(JSON.parse(properties.response.headers));
                    properties.response.headers = "ResponseHeaders::" + responseBeaders;
                } catch (error) {
                    context.warn("Can't process response headers.");
                }
            }


            if (meta.traceId !== undefined && meta.spanId !== undefined) {
                structuredLog = {
                    ...structuredLog,
                    "trace.id": meta.traceId,
                    "span.id": meta.spanId,
                };

                if (meta.parentSpanId !== undefined) {
                    structuredLog['parent.id'] = meta.parentSpanId;
                }
            }

            delete meta.traceId;
            delete meta.spanId;
            delete meta.parentSpanId;

            structuredLog = {
                ...structuredLog,
                [`${NR_CUSTOM_PROPERTIES_PREFIX}`]: properties,
                [`${NR_CUSTOM_PROPERTIES_PREFIX}.meta`]: meta,
            };

            if (meta.time !== undefined) {
                structuredLog.timestamp = new Date(meta.time).getTime();
            }

            if (meta.serviceName !== undefined) {
                structuredLog.serviceName = meta.serviceName;
            }

            let level = 'info'

            if (meta.kind === LogKind.error) {
                level = 'error'
            } else if (properties.response?.status?.code !== undefined && properties.response.status.code >= 400) {
                level = 'error'
            }

            structuredLog.level = level;

            return structuredLog
        }
    }

    return log
}

/**
 * Extract trace information from logs
*/
function tracingExtractor (buffer, context) {
    function getHttpUrl (log) {
        const scheme = log[`${NR_CUSTOM_PROPERTIES_PREFIX}`].request.url.scheme;
        const host = log[`${NR_CUSTOM_PROPERTIES_PREFIX}`].request.url.host;
        const path = log[`${NR_CUSTOM_PROPERTIES_PREFIX}`].request.url.path;

        return `${scheme}://${host}${path}`
    }

    let spans = buffer.map(log => {
        const kind = log[`${NR_CUSTOM_PROPERTIES_PREFIX}.meta`].kind;

        if (kind === LogKind.response || kind === LogKind.error) {
            let span = {
                'trace.id': log['trace.id'],
                'id': log['span.id'],
                'timestamp': log[`${NR_CUSTOM_PROPERTIES_PREFIX}.meta`].time,
                'attributes': {
                    'duration.ms': log[`${NR_CUSTOM_PROPERTIES_PREFIX}.meta`].timespan,
                    'duration': log[`${NR_CUSTOM_PROPERTIES_PREFIX}.meta`].timespan / 1000,
                    'name': log[`${NR_CUSTOM_PROPERTIES_PREFIX}`].request.originalUrl.path,
                    'host': log[`${NR_CUSTOM_PROPERTIES_PREFIX}`].request.originalUrl.host,
                    'http.method': log[`${NR_CUSTOM_PROPERTIES_PREFIX}`].request.method,
                    'http.url': getHttpUrl(log)
                }
            };

            if (log['parent.id'] !== undefined && log['parent.id'] !== null) {
                span.attributes['parent.id'] = log['parent.id'];
            }

            if (log.serviceName !== undefined && log.serviceName !== null) {
                span.attributes['service.name'] = log.serviceName;
            }

            if (log[`${NR_CUSTOM_PROPERTIES_PREFIX}`].response?.status?.code !== undefined) {
                span.attributes['http.statusCode'] = log[`${NR_CUSTOM_PROPERTIES_PREFIX}`].response.status.code;

                if (span.attributes['http.statusCode'] >= 400) {
                    span.attributes['error'] = true;
                    span.attributes['error.message'] = log[`${NR_CUSTOM_PROPERTIES_PREFIX}`].response.status.reason;
                    span.attributes['error.class'] = log[`${NR_CUSTOM_PROPERTIES_PREFIX}`].response.status.reason;
                }
            }

            if (log[`${NR_CUSTOM_PROPERTIES_PREFIX}`].response?.status?.reason !== undefined) {
                span.attributes['http.statusText'] = log[`${NR_CUSTOM_PROPERTIES_PREFIX}`].response.status.reason;
            }

            if (typeof log[`${NR_CUSTOM_PROPERTIES_PREFIX}`].error === 'object' && log[`${NR_CUSTOM_PROPERTIES_PREFIX}`].error !== null) {
                span.attributes['error'] = true;
                span.attributes['error.message'] = log[`${NR_CUSTOM_PROPERTIES_PREFIX}`].error.message;
                span.attributes['error.class'] = log[`${NR_CUSTOM_PROPERTIES_PREFIX}`].error.reason;
                span.attributes['error.source'] = log[`${NR_CUSTOM_PROPERTIES_PREFIX}`].error.source;
                span.attributes['error.section'] = log[`${NR_CUSTOM_PROPERTIES_PREFIX}`].error.section;
            }

            return span
        }

        return null
    }).filter(span => span !== null)

    if (spans.length === 0) {
        context.warn('No spans found in the logs.');
    }

    return spans
}

module.exports = { logProcessor, tracingExtractor };
