/**
 * New Relic Forwarder for Azure Services
 *
 * Developed by Dynova Development Team:
 * - Martin Vuelta <mavuelta@atentus.com>
 * - Eduardo Yallico <eduardo.yallico@atentusinternacional.com>
 * - Luis Factor <luis.factor@atentusinternacional.com>
 */

'use strict'

/**
 * Imports
 */
var https = require('https')
var zlib = require('zlib')

const processors = require('./processors')
const { VERSION } = require('./version')
const { settings } = require('./settings')

/**
 * Compresses log data and sends it to New Relic. If the compressed payload exceeds the maximum size,
 * the data is split and sent in parts.
 *
 * @param {Array<Object>} data - The array of log entries to be compressed and sent.
 * @param {Object} context - The context object containing information about the current execution context.
 * @param {function} context.log - The logging function provided by the execution environment.
 * @param {function} context.error - The error logging function provided by the execution environment.
 * @returns {Promise<void>} A Promise that resolves when the data has been successfully sent or an error occurs.
 *
 * @example
 * const data = [
 *   { message: 'Log entry 1' },
 *   { message: 'Log entry 2' }
 * ];
 * const context = {
 *   log: console.log, // Logging function
 *   error: console.error // Error logging function
 * };
 * compressAndSend(data, context)
 *   .then(() => {
 *     // Data successfully sent
 *   })
 *   .catch(error => {
 *     // Handle error during compression or sending
 *   });
 */
function compressAndSend (data, kind, endpoint, headers, context) {
    return compressData(JSON.stringify(getPayload(data, kind, context)))
        .then((compressedPayload) => {
            if (compressedPayload.length > settings.maxPayloadSize) {
                if (data.length === 1) {
                    context.error('Cannot send the payload as the size of single line exceeds the limit')
                    return
                }

                let halfwayThrough = Math.floor(data.length / 2)

                let arrayFirstHalf = data.slice(0, halfwayThrough)
                let arraySecondHalf = data.slice(halfwayThrough, data.length)

                return Promise.all([
                    compressAndSend(arrayFirstHalf, endpoint, headers, context),
                    compressAndSend(arraySecondHalf, endpoint, headers, context)
                ])
            } else {
                return retryMax(httpSend, settings.maxRetries, settings.retryInterval, [
                    compressedPayload,
                    endpoint,
                    headers,
                    context
                ])
                    .then(() => context.log('Logs payload successfully sent to New Relic.'))
                    .catch((e) => {
                        context.error('Max retries reached: failed to send logs payload to New Relic')
                        context.error('Exception: ', JSON.stringify(e))
                    })
            }
        })
        .catch((e) => {
            context.error('Error during payload compression.')
            context.error('Exception: ', JSON.stringify(e))
        })
}

/**
 * Compresses the input data using gzip compression algorithm.
 *
 * @param {Buffer | string} data - The data to be compressed, can be a Buffer or a string.
 * @returns {Promise<Buffer>} A Promise that resolves with the compressed data as a Buffer.
 * @throws {Object} An error object containing the error details if compression fails.
 *
 * @example
 * const inputBuffer = Buffer.from('Hello, World!', 'utf8');
 * compressData(inputBuffer)
 *   .then(compressedBuffer => {
 *     // Handle compressed data
 *   })
 *   .catch(error => {
 *     // Handle compression error
 *   });
 */
function compressData (data) {
    return new Promise((resolve, reject) => {
        zlib.gzip(data, (e, compressedData) => {
            if (!e) {
                resolve(compressedData)
            } else {
                reject({ error: e, res: null })
            }
        })
    })
}

/**
 * Appends metadata to each log entry in the provided array of logs.
 *
 * @param {Array<Object>} logs - The array of log entries to which metadata will be appended.
 * @returns {Array<Object>} An array of log entries with metadata appended.
 *
 * @example
 * const logs = [
 *   { message: 'Log entry 1' },
 *   { message: 'Log entry 2' }
 * ];
 * const updatedLogs = appendMetaDataToAllLogLines(logs);
 * // updatedLogs will include metadata such as subscriptionId and resourceGroup based on resourceId
 */
function appendMetaDataToAllLogLines (logs) {
    return logs.map((log) => addMetadata(log))
}

/**
 * Constructs a payload for logging, including common attributes and the provided logs.
 *
 * @param {Array} logs - The array of log entries to include in the payload.
 * @param {Object} context - The context object containing information about the current execution context.
 * @returns {Array<Object>} An array containing a single object with common attributes and logs.
 *
 * @example
 * const logs = [
 *   { message: 'Log entry 1' },
 *   { message: 'Log entry 2' }
 * ];
 * const context = {};
 * const payload = getPayload(logs, context);
 * // payload will include common attributes and the provided logs
 */
function getPayload (data, kind, context) {
    return [
        {
            common: getCommonAttributes(context),
            [`${kind}`]: data
        }
    ]
}

/**
 * Retrieves common attributes for logging, including plugin details, Azure context, tags, and environment information.
 *
 * @param {Object} context - The context object containing information about the current execution context.
 * @returns {Object} An object containing common attributes for logging.
 *
 * @example
 * const context = {
 *   functionName: 'myFunction',
 *   invocationId: '1234-5678'
 * };
 * const attributes = getCommonAttributes(context);
 * // attributes will include plugin details, Azure context, tags, and environment information
 */
function getCommonAttributes (context) {
    let serviceDetails = {}

    if (settings.serviceName !== null) {
        serviceDetails = {
            serviceName: settings.serviceName
        }
    }

    const common = {
        attributes: {
            'plugin.type': settings.logsSource,
            'plugin.version': VERSION,
            'azure.forwardername': context.functionName,
            'azure.invocationid': context.invocationId,
            environment: settings.environment,
            ...serviceDetails
        }
    }

    const tags = getTags()

    if (tags) {
        common.attributes.tags = tags
    }

    return common
}

/**
 * Parses the settings.tags global variable and returns an object representing tags.
 *
 * @returns {Object} An object representing tags parsed from the settings.tags global variable.
 *                  The keys and values are extracted from the colon-separated key-value pairs in settings.tags.
 *
 * @example
 * // If settings.tags global variable is set to "environment:production;app:myApp",
 * // getTags() will return the following object:
 * // { environment: 'production', app: 'myApp' }
 */
function getTags () {
    const tagsObj = {}
    if (settings.tags) {
        const tags = settings.tags.split(';')
        tags.forEach((tag) => {
            const keyValue = tag.split(':')
            if (keyValue.length > 1) {
                tagsObj[keyValue[0]] = keyValue[1]
            }
        })
        return tagsObj
    }

    return null
}

/**
 * Adds metadata to a log entry based on the resourceId property.
 *
 * @param {Object} logEntry - The log entry object to which metadata will be added.
 * @param {string} logEntry.resourceId - The Azure Resource Manager (ARM) resourceId.
 * @returns {Object} The log entry object with added metadata properties: subscriptionId, resourceGroup, and source.
 *
 * @example
 * const logEntry = {
 *   resourceId: '/subscriptions/12345678-90ab-cdef-ghij-klmnopqrstuv/resourceGroups/myResourceGroup/providers/microsoft.compute/virtualMachines/myVM',
 *   // ... other log entry properties
 * };
 * const logEntryWithMetadata = addMetadata(logEntry);
 * // logEntryWithMetadata will have additional metadata properties based on the resourceId.
 */
function addMetadata (logEntry) {
    if (
        logEntry.resourceId !== undefined &&
        typeof logEntry.resourceId === 'string' &&
        logEntry.resourceId.toLowerCase().startsWith('/subscriptions/')
    ) {
        let resourceId = logEntry.resourceId.toLowerCase().split('/')
        if (resourceId.length > 2) {
            logEntry.metadata = {}
            logEntry.metadata.subscriptionId = resourceId[2]
        }
        if (resourceId.length > 4) {
            logEntry.metadata.resourceGroup = resourceId[4]
        }
        if (resourceId.length > 6 && resourceId[6]) {
            logEntry.metadata.source = resourceId[6].replace('microsoft.', 'azure.')
        }
    }
    return logEntry
}

/**
 * Transforms the input logs into a consistent format suitable for processing.
 *
 * @param {Array|string|Object} logs - The input logs to be transformed, which can be an array, string, or object.
 * @param {Object} context - The context object containing information about the current execution context.
 * @returns {Array<Object>} An array of log objects in a consistent format suitable for processing.
 *
 * @example
 * const logs = ['log line 1', 'log line 2', 'log line 3'];
 * const context = {
 *   log: console.log // or any other logging function
 * };
 * const transformedLogs = transformData(logs, context);
 * // transformedLogs is an array of log objects suitable for further processing.
 */
function transformData (logs, context) {
    // buffer is an array of JSON objects
    let buffer = []

    let parsedLogs = parseData(logs, context)

    let processor = processors[settings.sourceServiceType].logProcessor
    // type JSON object
    if (!Array.isArray(parsedLogs) && typeof parsedLogs === 'object' && parsedLogs !== null) {
        if (parsedLogs.records !== undefined) {
            context.log('Type of logs: records Object')
            parsedLogs.records.forEach((log) => buffer.push(processor(log, context)))
            return buffer
        }
        context.log('Type of logs: JSON Object')
        buffer.push(parsedLogs)
        return buffer
    }

    // Bad Format
    if (!Array.isArray(parsedLogs)) {
        return buffer
    }

    if (typeof parsedLogs[0] === 'object' && parsedLogs[0] !== null) {
        // type JSON records
        if (parsedLogs[0].records !== undefined) {
            context.log('Type of logs: records Array')
            parsedLogs.forEach((message) => {
                message.records.forEach((log) => buffer.push(processor(log, context)))
            })
            return buffer
        } // type JSON array
        context.log('Type of logs: JSON Array')
        // normally should be "buffer.push(log)" but that will fail if the array mixes JSON and strings
        parsedLogs.forEach((log) => buffer.push(processor(log, context)))
        // Our API can parse the data in "log" to a JSON and ignore "message", so we are good!
        return buffer
    }

    if (typeof parsedLogs[0] === 'string') {
        // type string array
        context.log('Type of logs: string Array')
        parsedLogs.forEach((logString) => buffer.push({ message: logString }))
        return buffer
    }
    return buffer
}

/**
 * Parses input logs into a consistent format, attempting to convert strings and arrays to objects.
 *
 * @param {Array|string} logs - The input logs to be parsed, which can be an array or a string.
 * @param {Object} context - The context object containing information about the current execution context.
 * @returns {Array|Object|string} Parsed logs in a consistent format: array, object, or string.
 *
 * @example
 * const logsString = '{"key": "value"}';
 * const parsedString = parseData(logsString, context);
 * // parsedString is the parsed object: { key: 'value' }
 *
 * const logsArray = ['{"key": "value"}', 'not a JSON string'];
 * const parsedArray = parseData(logsArray, context);
 * // parsedArray is an array with the first element parsed: [ { key: 'value' }, 'not a JSON string' ]
 */
function parseData (logs, context) {
    if (!Array.isArray(logs)) {
        try {
            return JSON.parse(logs) // for strings let's see if we can parse it into Object
        } catch {
            context.warn('Cannot parse logs to JSON')
            return logs
        }
    }

    try {
        // If logs is an array, attempt to parse each element into an object.
        return logs.map((log) => {
            try {
                return JSON.parse(log) // for arrays, attempt to parse each element into an object
            } catch {
                return log
            }
        })
    } catch (e) {
        // for both of the above exception cases, return logs would be fine.
        return logs
    }
}

/**
 * Sends data to a specified HTTP endpoint using a POST request with gzip compression.
 *
 * @param {Buffer} data - The data to be sent, compressed as a Buffer.
 * @param {Object} context - The context object containing information about the current execution context.
 * @returns {Promise<string>} A Promise that resolves with the response body if the request is successful (HTTP 202),
 *                            or rejects with an error object if the request fails.
 *
 * @example
 * const data = compressedDataBuffer; // compressed data as a Buffer
 * const context = {
 *   log: console.log // or any other logging function
 * };
 * httpSend(data, context)
 *   .then(response => {
 *     // Handle successful response
 *   })
 *   .catch(error => {
 *     // Handle error
 *   });
 */
function httpSend (data, endpoint, headers, context) {
    return new Promise((resolve, reject) => {
        const url = new URL(endpoint)
        const options = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname,
            protocol: url.protocol,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Encoding': 'gzip',
                'X-License-Key': settings.licenseKey,
                ...headers
            }
        }

        var req = https.request(options, (res) => {
            var body = ''
            res.setEncoding('utf8')
            res.on('data', (chunk) => {
                body += chunk // don't really do anything with body
            })
            res.on('end', () => {
                context.log('Got response:' + res.statusCode)
                if (res.statusCode === 202) {
                    resolve(body)
                } else {
                    reject({ error: null, res: res })
                }
            })
        })

        req.on('error', (e) => {
            reject({ error: e, res: null })
        })
        req.write(data)
        req.end()
    })
}

/**
 * Retries the provided function with specified parameters a maximum number of times,
 * waiting for a specified interval between retries.
 *
 * @param {function} fn - The function to retry.
 * @param {number} retry - The number of retries to attempt.
 * @param {number} interval - The interval in milliseconds between retries.
 * @param {Array} fnParams - List of parameters to pass to the function.
 * @returns {Promise} A Promise that resolves to the final result if successful or rejects with the last encountered error.
 *
 * @example
 * function fetchData(url) {
 *   // Function to fetch data from the specified URL
 * }
 * const url = 'https://example.com/data';
 * const maxRetries = 3;
 * const retryInterval = 1000; // 1 second
 * const params = [url]; // Parameters to pass to fetchData function
 * retryMax(fetchData, maxRetries, retryInterval, params)
 *   .then(data => {
 *     // Handle fetched data
 *   })
 *   .catch(error => {
 *     // Handle error after maximum retries
 *   });
 */
function retryMax (fn, retry, interval, fnParams) {
    return fn.apply(this, fnParams).catch((err) => {
        return retry > 1 ? wait(interval).then(() => retryMax(fn, retry - 1, interval, fnParams)) : Promise.reject(err)
    })
}

/**
 * Returns a Promise that resolves after the specified delay.
 *
 * @param {number} delay - The delay in milliseconds before the Promise resolves (default: 0).
 * @returns {Promise} A Promise that resolves after the specified delay.
 *
 * @example
 * const delay = 2000; // 2 seconds
 * wait(delay)
 *   .then(() => {
 *     // Code to be executed after 2 seconds
 *   })
 *   .catch(error => {
 *     // Handle error if Promise is rejected (unlikely in this case)
 *   });
 */
function wait (delay) {
    return new Promise((fulfill) => {
        setTimeout(fulfill, delay || 0)
    })
}

async function NewRelicForwarder (messages, context) {
    context.log('New Relic Forwarder')
    if (settings.validate()) {
        context.error('Invalid settings')
        return
    }

    let logs
    if (typeof messages === 'string') {
        logs = messages.trim().split('\n')
    } else if (Buffer.isBuffer(messages)) {
        logs = messages.toString('utf8').trim().split('\n')
    } else if (!Array.isArray(messages)) {
        logs = JSON.stringify(messages).trim().split('\n')
    } else {
        logs = messages
    }

    context.log(`Procesing ${logs.length} messages`)
    context.log(JSON.stringify(logs))

    let buffer = transformData(logs, context)
    if (buffer.length === 0) {
        context.warn('logs format is invalid')
        return
    }

    let logLines = appendMetaDataToAllLogLines(buffer)

    if (settings.forwardTracing) {
        if (processors[settings.sourceServiceType].allowsTracing) {
            let spans = processors[settings.sourceServiceType].tracingExtractor(buffer, context)

            if (spans.length > 0) {
                context.log('Sending spans and logs to New Relic.')
                await Promise.all([
                    compressAndSend(logLines, 'logs', settings.logEndpoint, {}, context),
                    compressAndSend(
                        spans,
                        'spans',
                        settings.traceEndpoint,
                        { 'Data-Format': 'newrelic', 'Data-Format-Version': '1' },
                        context
                    )
                ])
                return
            }
        } else {
            context.warn(`Tracing is not allowed for this service type ${settings.sourceServiceType}`)
        }
    }

    context.log('Sending logs to New Relic.')
    await compressAndSend(logLines, 'logs', settings.logEndpoint, {}, context)
    return
}

module.exports = {
    NewRelicForwarder
}
