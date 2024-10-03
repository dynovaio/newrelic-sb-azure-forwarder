const allowsTracing = true

const Status = {
    QUEUED: 'Queued',
    IN_PROGRESS: 'InProgress',
    FAILED: 'Failed',
    SUCCEEDED: 'Succeeded',
    CANCELLED: 'Cancelled'
}

const Category = {
    PIPELINE_RUNS: 'PipelineRuns',
    ACTIVITY_RUNS: 'ActivityRuns'
}

/**
 * Get log level from levelId reported by Azure Data Factory logger.
 *
 * @param {*} levelId
 * @returns string
 *
 */
const getLogLevel = (level) => {
    switch (level) {
        case 'Informational':
            return 'info'
        case 'Warning':
            return 'warn'
        case 'Error':
            return 'error'
        case 'Critical':
            return 'error'
        default:
            return 'info'
    }
}

/**
 * Process logs for Azure Data Factory
 */
function logProcessor(log, context, settings) {
    let { properties, ...meta } = log

    if (properties !== undefined) {
        if (typeof properties === 'object' && properties !== null) {
            let structuredLog = {}

            if (typeof meta.end !== 'undefined' && typeof meta.start !== 'undefined') {
                const endTime = new Date(meta.end).getTime()
                const startTime = new Date(meta.start).getTime()

                if (endTime > startTime) {
                    meta.duration = endTime - startTime
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

            if (meta.resourceId !== undefined) {
                structuredLog.serviceName = meta.resourceId.split('/').at(-1).toLowerCase()
            }

            if (meta.level !== undefined) {
                structuredLog.level = getLogLevel(meta.level)
            }

            if (
                meta.category !== undefined &&
                (meta.category === Category.PIPELINE_RUNS || meta.category === Category.ACTIVITY_RUNS)
            ) {
                structuredLog['trace.id'] = meta.correlationId.replace(/-/g, '')

                if (meta.category === Category.PIPELINE_RUNS) {
                    structuredLog['span.id'] = structuredLog['trace.id'].slice(0, 16)
                }

                if (meta.category === Category.ACTIVITY_RUNS) {
                    structuredLog['span.id'] = meta.env_dt_spanId
                    structuredLog['parent.id'] = structuredLog['trace.id'].slice(0, 16)
                }
            }

            return structuredLog
        }
    }

    return log
}

/**
 * Extract tracing informacion from logs for Azure Data Factory
 */
function tracingExtractor(buffer, context, settings) {
    let spans = buffer
        .map((log) => {
            let status = log[`${settings.customPropertiesPrefix}.meta`].status
            context.warn('*** *** ***')
            context.warn(status)
            context.warn(status === Status.FAILED || status === Status.SUCCEEDED || status === Status.CANCELLED)

            if (status === Status.FAILED || status === Status.SUCCEEDED || status === Status.CANCELLED) {
                context.warn('processing span ...')

                let category = log[`${settings.customPropertiesPrefix}.meta`].category

                let span = {
                    'trace.id': log[`${settings.customPropertiesPrefix}.meta`].correlationId.replace(/-/g, ''),
                    timestamp: new Date(log[`${settings.customPropertiesPrefix}.meta`].start).getTime(),
                    attributes: {
                        'duration.ms': log[`${settings.customPropertiesPrefix}.meta`].duration,
                        duration: log[`${settings.customPropertiesPrefix}.meta`].duration / 1000
                    }
                }

                if (category === Category.PIPELINE_RUNS) {
                    span.id = span['trace.id'].slice(0, 16)
                    span.attributes.name = 'Pipeline/' + log[`${settings.customPropertiesPrefix}.meta`].pipelineName
                }

                if (category === Category.ACTIVITY_RUNS) {
                    span.id = log[`${settings.customPropertiesPrefix}.meta`].env_dt_spanId
                    span.attributes['parent.id'] = span['trace.id'].slice(0, 16)
                    span.attributes.name = 'Activity/' + log[`${settings.customPropertiesPrefix}.meta`].activityName
                }

                let error = log[`${settings.customPropertiesPrefix}`].Error

                if (error !== undefined && error.message !== undefined && error.message !== '') {
                    span.attributes['error'] = true
                    span.attributes['error.message'] = error.message
                    span.attributes['error.class'] = error.failureType
                    span.attributes['error.code'] = error.errorCode
                    if (typeof error.details === 'object') {
                        span.attributes['error.details'] = JSON.stringify(error.details)
                    } else {
                        span.attributes['error.details'] = error.details
                    }
                }

                if (log.serviceName !== undefined && log.serviceName !== null) {
                    span.attributes['service.name'] = log.serviceName
                }

                context.warn(`Stringified Log: ${JSON.stringify([{ span: span }])}`)
                context.warn('*** *** ***')

                return span
            }
            context.warn('*** *** ***')

            return null
        })
        .filter((span) => span !== null)

    if (spans.length === 0) {
        context.warn('No spans found in logs.')
    }

    return spans
}
module.exports = {
    logProcessor,
    tracingExtractor,
    allowsTracing
}
