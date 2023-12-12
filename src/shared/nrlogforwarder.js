/**
 * New Relic Log forwarder for Azure B2C
 *
 * Developed by Atentus Peru Development Team:
 * - Martin Vuelta <mavuelta@atentus.com>
 * - Eduardo Yallico <eduardo.yallico@atentusinternacional.com>
 * - Luis Factor <luis.factor@atentusinternacional.com>
 */

'use strict';


/**
 * Imports
 */
const https = require('https');
const url = require('url');
const zlib = require('zlib');

/**
 * Global constants and configuration variables
 */

// Versioning
const VERSION = '0.0.1';

// New Relic constants
const NR_LOGS_SOURCE = 'azure';
const NR_MAX_PAYLOAD_SIZE = 1000 * 1024;

const NR_DEFAULT_ENDPOINT = 'https://log-api.newrelic.com/log/v1';
const NR_DEFAULT_RETRY_INTERVAL = 2000; // 2 seconds
const NR_DEFAULT_MAX_RETRIES = 3;

const NR_DEFAULT_CUSTOM_PROPERTIES_PREFIX = 'custom'
const NR_DEFAULT_ENVIRONMENT = 'dev'
const NR_DEFAULT_SERVICE_NAME = null

// New Relic configuration variables
const NR_LICENSE_KEY = process.env.NR_LICENSE_KEY;
const NR_ENDPOINT = process.env.NR_ENDPOINT || NR_DEFAULT_ENDPOINT;
const NR_TAGS = process.env.NR_TAGS; // Semicolon-seperated tags
const NR_MAX_RETRIES = process.env.NR_MAX_RETRIES || NR_DEFAULT_MAX_RETRIES;
const NR_RETRY_INTERVAL = process.env.NR_RETRY_INTERVAL || NR_DEFAULT_RETRY_INTERVAL;

const NR_CUSTOM_PROPERTIES_PREFIX = process.env.NR_CUSTOM_PROPERTIES_PREFIX || NR_DEFAULT_CUSTOM_PROPERTIES_PREFIX;
const NR_ENVIRONMENT = process.env.NR_ENVIRONMENT || NR_DEFAULT_ENVIRONMENT;

const NR_SERVICE_NAME = process.env.NR_SERVICE_NAME || NR_DEFAULT_SERVICE_NAME

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
        /**
         * zlib.gzip method is used to compress the input data using gzip algorithm.
         * @param {Buffer | string} data - The data to be compressed.
         * @param {function} callback - The callback function to handle compression result.
         * @param {Error} callback.error - An error object if compression fails, null otherwise.
         * @param {Buffer} callback.compressedData - The compressed data as a Buffer if compression succeeds.
         */
        zlib.gzip(data, (error, compressedData) => {
            if (!error) {
                resolve(compressedData);
            } else {
                /**
                 * If compression fails, the Promise is rejected with an error object.
                 * @typedef {Object} CompressionError
                 * @property {Error} error - The error object containing details of the compression failure.
                 * @property {Buffer} res - The compressed data (null in case of failure).
                 */
                reject({ error, res: null });
            }
        });
    });
}


/**
 * Generates payloads containing logs with common attributes and metadata.
 *
 * @param {Array} logs - An array of log lines to be included in the payloads.
 * @param {Object} context - The context object containing information about the current execution context.
 * @param {string} context.functionName - The name of the AWS Lambda function.
 * @param {string} context.invocationId - The unique identifier for the current invocation.
 * @returns {Array<Array<Object>>} An array of payloads, where each payload contains logs with common attributes and metadata.
 *
 * @example
 * const logs = ['log line 1', 'log line 2', 'log line 3'];
 * const context = {
 *   functionName: 'myLambdaFunction',
 *   invocationId: '12345',
 * };
 * const payloads = generatePayloads(logs, context);
 * // payloads is an array of arrays, each containing logs with common attributes and metadata.
 */
function generatePayloads (logs, context) {
    let serviceDetails = {}

    if (NR_SERVICE_NAME !== null) {
        serviceDetails = {
            serviceName: NR_SERVICE_NAME
        }
    }

    const common = {
        attributes: {
            plugin: {
                type: NR_LOGS_SOURCE,
                version: VERSION,
            },
            azure: {
                forwardername: context.functionName,
                invocationid: context.invocationId,
            },
            tags: getTags(),
            environment: NR_ENVIRONMENT,
            ...serviceDetails
        },
    };
    let payload = [
        {
            common: common,
            logs: [],
        },
    ];
    let payloads = [];

    logs.forEach((logLine) => {
        const log = addMetadata(logLine);
        if (
            JSON.stringify(payload).length + JSON.stringify(log).length <
            NR_MAX_PAYLOAD_SIZE
        ) {
            payload[0].logs.push(log);
        } else {
            payloads.push(payload);
            payload = [
                {
                    common: common,
                    logs: [],
                },
            ];
            payload[0].logs.push(log);
        }
    });
    payloads.push(payload);
    return payloads;
}

/**
 * Parses the NR_TAGS global variable and returns an object representing tags.
 *
 * @returns {Object} An object representing tags parsed from the NR_TAGS global variable.
 *                  The keys and values are extracted from the colon-separated key-value pairs in NR_TAGS.
 *
 * @example
 * // If NR_TAGS global variable is set to "environment:production;app:myApp",
 * // getTags() will return the following object:
 * // { environment: 'production', app: 'myApp' }
 */
function getTags () {
    const tagsObj = {};
    if (NR_TAGS) {
        const tags = NR_TAGS.split(';');
        tags.forEach((tag) => {
            const keyValue = tag.split(':');
            if (keyValue.length > 1) {
                /**
                 * Extracts key-value pairs from the colon-separated string and populates the tagsObj.
                 * @param {string} keyValue[0] - The key of the tag.
                 * @param {string} keyValue[1] - The value of the tag.
                 */
                tagsObj[keyValue[0]] = keyValue[1];
            }
        });
    }
    return tagsObj;
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
    /**
     * Check if the logEntry has a valid resourceId property and extract metadata from it.
     * @param {string} logEntry.resourceId - The Azure Resource Manager (ARM) resourceId.
     */
    if (
        logEntry.resourceId !== undefined &&
        typeof logEntry.resourceId === 'string' &&
        logEntry.resourceId.toLowerCase().startsWith('/subscriptions/')
    ) {
        let resourceId = logEntry.resourceId.toLowerCase().split('/');
        if (resourceId.length > 2) {
            logEntry.metadata = {};
            /**
             * Extracts subscriptionId from the ARM resourceId and adds it to the log entry metadata.
             * @param {string} resourceId[2] - The subscriptionId part of the ARM resourceId.
             */
            logEntry.metadata.subscriptionId = resourceId[2];
        }
        if (resourceId.length > 4) {
            /**
             * Extracts resourceGroup from the ARM resourceId and adds it to the log entry metadata.
             * @param {string} resourceId[4] - The resourceGroup part of the ARM resourceId.
             */
            logEntry.metadata.resourceGroup = resourceId[4];
        }
        if (resourceId.length > 6 && resourceId[6]) {
            /**
             * Extracts source from the ARM resourceId and adds it to the log entry metadata,
             * replacing 'microsoft.' with 'azure.' in the source name.
             * @param {string} resourceId[6] - The source part of the ARM resourceId.
             */
            logEntry.metadata.source = resourceId[6].replace('microsoft.', 'azure.');
        }
    }
    return logEntry;
}


/**
 * Transforms the input logs into a consistent format suitable for processing.
 *
 * @param {Array|string|Object} logs - The input logs to be transformed, which can be an array, string, or object.
 * @param {Object} context - The context object containing information about the current execution context.
 * @param {function} context.log - The logging function provided by the execution environment.
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
    let buffer = [];

    // parsedLogs is the result of parsing the input logs using the parseData function.
    let parsedLogs = parseData(logs, context);

    /**
     * Check the type of parsedLogs and transform it into a consistent log format.
     */
    if (
        !Array.isArray(parsedLogs) &&
        typeof parsedLogs === 'object' &&
        parsedLogs !== null
    ) {
        if (parsedLogs.records !== undefined) {
            context.log('Type of logs: records Object');
            // Extract records and push them into the buffer.
            parsedLogs.records.forEach((log) => buffer.push(log));
            return buffer;
        }
        context.log('Type of logs: JSON Object');
        // Push the entire JSON object into the buffer.
        buffer.push(parsedLogs);
        return buffer;
    }

    // Handle bad format by returning an empty buffer.
    if (!Array.isArray(parsedLogs)) {
        return buffer;
    }

    if (typeof parsedLogs[0] === 'object' && parsedLogs[0] !== null) {
        // type JSON records
        if (parsedLogs[0].records !== undefined) {
            context.log('Type of logs: records Array');
            // Extract records from each message and push them into the buffer.
            parsedLogs.forEach((message) => {
                message.records.forEach((log) => buffer.push(log));
            });
            return buffer;
        } // type JSON array
        context.log('Type of logs: JSON Array');
        // Convert each array element to an object with a 'message' property and push it into the buffer.
        parsedLogs.forEach((log) => {
            const { properties, ...meta } = log;

            if (properties !== undefined) {
                if (typeof properties === 'object' && properties !== null) {
                    let structuredLog = {
                        [`${NR_CUSTOM_PROPERTIES_PREFIX}`]: properties,
                        [`${NR_CUSTOM_PROPERTIES_PREFIX}.meta`]: meta,
                    };

                    if (meta.time !== undefined) {
                        structuredLog.timestamp = new Date(meta.time).getTime();
                    }

                    buffer.push(structuredLog);
                }
            }
            else {
                buffer.push({ message: log });
            }
        });
        // Our API can parse the data in "log" to a JSON and ignore "message", so we are good!
        return buffer;
    }
    if (typeof parsedLogs[0] === 'string') {
        // type string array
        context.log('Type of logs: string Array');
        // Convert each string element to an object with a 'message' property and push it into the buffer.
        parsedLogs.forEach((logString) => buffer.push({ message: logString }));
        return buffer;
    }
    return buffer;
}


/**
 * Parses input logs into a consistent format, attempting to convert strings and arrays to objects.
 *
 * @param {Array|string} logs - The input logs to be parsed, which can be an array or a string.
 * @param {Object} context - The context object containing information about the current execution context.
 * @param {function} context.warn - The warning function provided by the execution environment.
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
    let newLogs = logs;

    // If logs is not an array, attempt to parse it into an object.
    if (!Array.isArray(logs)) {
        try {
            newLogs = JSON.parse(logs); // for strings, attempt to parse it into an object
        } catch {
            context.warn('Cannot parse logs to JSON');
        }
    } else {
        // If logs is an array, attempt to parse each element into an object.
        newLogs = logs.map((log) => {
            try {
                return JSON.parse(log); // for arrays, attempt to parse each element into an object
            } catch {
                return log;
            }
        });
    }
    return newLogs;
}


/**
 * Sends data to a specified HTTP endpoint using a POST request with gzip compression.
 *
 * @param {Buffer} data - The data to be sent, compressed as a Buffer.
 * @param {Object} context - The context object containing information about the current execution context.
 * @param {function} context.log - The logging function provided by the execution environment.
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
function httpSend (data, context) {
    return new Promise((resolve, reject) => {
        const urlObj = url.parse(NR_ENDPOINT);
        const options = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname,
            protocol: urlObj.protocol,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Encoding': 'gzip',
                'X-License-Key': NR_LICENSE_KEY
            },
        };

        var req = https.request(options, (res) => {
            var body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                body += chunk; // don't really do anything with body
            });
            res.on('end', () => {
                context.log('Got response:' + res.statusCode);
                if (res.statusCode === 202) {
                    resolve(body);
                } else {
                    reject({ error: null, res: res });
                }
            });
        });

        req.on('error', (e) => {
            reject({ error: e, res: null });
        });
        req.write(data);
        req.end();
    });
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
        return retry > 1
            ? wait(interval).then(() => retryMax(fn, retry - 1, interval, fnParams))
            : Promise.reject(err);
    });
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
        setTimeout(fulfill, delay || 0);
    });
}

const NewRelicLogForwarder = async (blob, context) => {
    context.log(`Storage blob function processed blob "${context.triggerMetadata.blobTrigger}" with size ${blob.length} bytes`);

    if (!NR_LICENSE_KEY) {
        context.error(
            'You have to configure either your LICENSE key or insights insert key. ' +
            'Please follow the instructions in README'
        );
        return;
    }

    let logs;
    if (typeof blob === 'string') {
        logs = blob.trim().split('\n');
    } else if (Buffer.isBuffer(blob)) {
        logs = blob.toString('utf8').trim().split('\n');
    } else {
        logs = JSON.stringify(blob).trim().split('\n');
    }

    let buffer = transformData(logs, context);
    if (buffer.length === 0) {
        context.warn('logs format is invalid');
        return;
    }

    let compressedPayload;
    let payloads = generatePayloads(buffer, context);
    for (const payload of payloads) {
        try {
            compressedPayload = await compressData(JSON.stringify(payload));
            try {
                await retryMax(httpSend, NR_MAX_RETRIES, NR_RETRY_INTERVAL, [
                    compressedPayload,
                    context,
                ]);
                context.log('Logs payload successfully sent to New Relic.');
            } catch (e) {
                context.error('Max retries reached: failed to send logs payload to New Relic');
                context.error('Exception: ', JSON.stringify(e));
            }
        } catch (e) {
            context.error('Error during payload compression.');
            context.error('Exception: ', JSON.stringify(e));
        }
    }
}

module.exports = {
    NewRelicLogForwarder
}
