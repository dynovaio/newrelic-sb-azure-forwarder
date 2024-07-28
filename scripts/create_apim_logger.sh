#! /bin/bash
# -----------------------------------------------------------------------------
# File:
# create_apim_logger.sh
#
# Authors:
# * Martin Vuelta <zodiacfireworks@softbutterfly.io>
# * SoftButterfly Dev Team <dev@softbutterfly.io>
#
# Description:
# This script will create Azure API Management logger
#
# Usage:
# ./create_apim_logger.sh \
#    $logger_id \
#    $apim_name \
#    $resource_group_name
#
# Parameters:
# * $logger_id               : Logger ID.
# * $apim_name               : Azure API Management name.
# * $resource_group_name     : Name of the resource group.
#
# Example:
# ./create_apim_logger.sh \
#    myLogger \
#    myApim \
#    myResourceGroup
# -----------------------------------------------------------------------------

# -----------------------------------------------------------------------------
# Preamble:
# ---------

# Global variables
DEFAULT_LOCATION="eastus"
PROJECT_NAME="nr-logforwarder"

# -----------------------------------------------------------------------------
# Input validation:
# -----------------

# Check if logger ID is provided
if [ -z "$1" ]; then
    echo "[ERR] Logger ID is not provided."
    exit 1
else
    LOGGER_ID="$1"
fi

# Check if Azure API Management name is provided
if [ -z "$2" ]; then
    echo "[ERR] Azure API Management name is not provided."
    exit 1
else
    APIM_NAME="$2"
fi

# Check if resource group name is provided
if [ -z "$3" ]; then
    echo "[ERR] Resource group name is not provided."
    exit 1
else
    RESOURCE_GROUP_NAME="$3"
fi

# -----------------------------------------------------------------------------
# Execution:
# ----------
# Get random suffix from .random_sufix file
if [ -f .random_suffix ]; then
    RANDOM_SUFFIX=$(cat .random_suffix)
else
    echo "[ERR] Random suffix file not found."
    exit 1
fi

# Get EventHub namespace connection string
EVENT_HUB_NAME="eh-log-collector"
EVENT_HUB_NAMESPACE_NAME="ehns-${PROJECT_NAME}-${RANDOM_SUFFIX}"

EVENTHUB_NAMESPACE_CONNECTION_STRING=$(
    az eventhubs namespace authorization-rule keys list \
        --resource-group $RESOURCE_GROUP_NAME \
        --namespace-name $EVENT_HUB_NAMESPACE_NAME \
        --name RootManageSharedAccessKey \
        --query primaryConnectionString \
        --output tsv
)


# Ceate a bicep file to deploy the logger
cat > logger.bicep <<EOF
param loggerId string

param apimName string

param eventHubName string

param eventHubNamespaceConnectionString string

resource nrApim 'Microsoft.ApiManagement/service@2023-09-01-preview' existing = {
    name: apimName
}

resource nrLogger 'Microsoft.ApiManagement/service/loggers@2020-06-01-preview' = {
    name: loggerId
    parent: nrApim
    properties: {
        loggerType: 'azureEventHub'
        description: 'Logger for New Relic log forwarder'
        credentials: {
            name: eventHubName
            connectionString: eventHubNamespaceConnectionString
        }
        isBuffered: true
    }
}


output nrApimName string = nrApim.name
output loggerId string = nrLogger.name
output loggerType string = nrLogger.properties.loggerType

EOF

# Deploy the logger
az deployment group create \
    --resource-group $RESOURCE_GROUP_NAME \
    --template-file logger.bicep \
    --parameters \
        loggerId=$LOGGER_ID \
        apimName=$APIM_NAME \
        eventHubName=$EVENT_HUB_NAME \
        eventHubNamespaceConnectionString=$EVENTHUB_NAMESPACE_CONNECTION_STRING > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo "[ERR] Failed to create Azure API Management logger."
    rm -rf logger.bicep

    exit 1
else
    echo "[INFO] Azure API Management logger '${LOGGER_ID}' created successfully."
fi

rm -rf logger.bicep
