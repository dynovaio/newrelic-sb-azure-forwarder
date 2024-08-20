const azAPIManagementService = require('./azure/api_management_service')
const azFunctionApp = require('./azure/function_app')
const azDataFactory = require('./azure/data_factory')

module.exports = {
    '@azure/APIManagementService': azAPIManagementService,
    '@azure/FunctionApp': azFunctionApp,
    '@azure/DataFactory': azDataFactory
}
