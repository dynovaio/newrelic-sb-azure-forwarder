const azAPIManagementService = require('./azure/api_management_service')
const azFunctionApp = require('./azure/function_app')
const azDataFactory = require('./azure/data_factory')
const azContainerApps = require('./azure/container_apps')

module.exports = {
    '@azure/APIManagementService': azAPIManagementService,
    '@azure/FunctionApp': azFunctionApp,
    '@azure/DataFactory': azDataFactory,
    '@azure/ContainerApps': azContainerApps
}
