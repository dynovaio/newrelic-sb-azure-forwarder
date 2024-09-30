#! /bin/bash
# -----------------------------------------------------------------------------
# File:
# configure_function.sh
#
# Authors:
# * Martin Vuelta <zodiacfireworks@softbutterfly.io>
# * SoftButterfly Dev Team <dev@softbutterfly.io>
#
# Description:
# This script will configure the necessary environment variables for the
# function app to stream logs to New Relic from an Event Hub.
#
# Usage:
# ./configure_function.sh \
#     $resource_group_name \
#     $source_service_type \
#     $new_relic_license_key
#
# Parameters:
# * $resource_group_name   : Name of the resource group.
# * $source_service_type   : Source service type.
# * $new_relic_license_key : New Relic license key.
#
# Example:
# ./configure_function.sh \
#     myResourceGroup \
#     @azure/AzureFunctionApp \
#     1234567890abcdef
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

# Check if New Relic license key is provided
if [ -z "$1" ]; then
    echo "[ERR] Resource group name is not provided."
    exit 1
else
    RESOURCE_GROUP_NAME="$1"
fi

# Check if source service type is provided
if [ -z "$2" ]; then
    echo "[ERR] New Relic license key is not provided."
    exit 1
else
    SOURCE_SERVICE_TYPE="$2"
fi

# Check if new relic license name is provided
if [ -z "$3" ]; then
    echo "[ERR] New Relic license key is not provided."
    exit 1
else
    NEW_RELIC_LICENSE_KEY="$3"
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

# Get Eventhub Connection string
EVENT_HUB_NAMESPACE_NAME="ehns-${PROJECT_NAME}-${RANDOM_SUFFIX}"
# EVENT_HUB_NAMESPACE_ACCESS_KEY_NAME="sak-${PROJECT_NAME}-${RANDOM_SUFFIX}"
EVENT_HUB_NAMESPACE_ACCESS_KEY_NAME="RootManageSharedAccessKey"
EVENT_HUB_NAME="eh-log-collector"

EVENT_HUB_CONNECTION_STRING=$(
    az eventhubs namespace authorization-rule keys list \
        --authorization-rule-name "${EVENT_HUB_NAMESPACE_ACCESS_KEY_NAME}" \
        --namespace-name "${EVENT_HUB_NAMESPACE_NAME}" \
        --resource-group "${RESOURCE_GROUP_NAME}" \
        --query primaryConnectionString \
        --output tsv
)

# Configure function app settings
FUNCTION_APP_NAME="fn-${PROJECT_NAME}-${RANDOM_SUFFIX}"

az functionapp config appsettings set \
    --name "${FUNCTION_APP_NAME}" \
    --resource-group "${RESOURCE_GROUP_NAME}" \
    --settings \
        "eventHubName=${EVENT_HUB_NAME}" \
        "NR_LICENSE_KEY=${NEW_RELIC_LICENSE_KEY}" \
        "NR_TRIGGER_CONNECTION_STRING=${EVENT_HUB_CONNECTION_STRING}" \
        "NR_CUSTOM_PROPERTIES_PREFIX=sb" \
        "NR_SOURCE_SERVICE_TYPE=${SOURCE_SERVICE_TYPE}" \
        "NR_ENVIRONMENT=dev" > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo "[ERR] Failed to configure function app '${FUNCTION_APP_NAME}'."
    exit 1
else
    echo "[INFO] Function app '${FUNCTION_APP_NAME}' configured successfully."
fi
