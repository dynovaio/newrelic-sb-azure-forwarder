const azAPIManagementService = require('./azure/api_management_service')
const azFunctionApp = require('./azure/function_app')

module.exports = {
    '@azure/APIManagementService': azAPIManagementService,
    '@azure/FunctionApp': azFunctionApp
}
