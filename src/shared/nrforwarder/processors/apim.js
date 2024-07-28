

/**
 * Process logs for API Management
 */
function logProcessor (log, prefix, context) {
    const { properties, ...meta } = log;

    if (properties !== undefined) {
        if (typeof properties === 'object' && properties !== null) {
            console.log(properties)
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

            let structuredLog = {
                [`${prefix}`]: properties,
                [`${prefix}.meta`]: meta,
            };

            if (meta.time !== undefined) {
                structuredLog.timestamp = new Date(meta.time).getTime();
            }

            if (meta.serviceName !== undefined) {
                structuredLog.serviceName = meta.serviceName;
            }

            return structuredLog
        }
    }

    return log
}

module.exports = { logProcessor };
