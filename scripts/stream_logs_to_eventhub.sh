#! /bin/bash
# -----------------------------------------------------------------------------
# File:
# stream_logs_to_eventhub.sh
#
# Authors:
# * Martin Vuelta <zodiacfireworks@softbutterfly.io>
# * SoftButterfly Dev Team <dev@softbutterfly.io>
#
# Description:
# This script will configure a given resource to stream logs to an Event Hub.
#
# Usage:
# ./stream_logs_to_eventhub.sh \
#     $resource_id \
#     $resource_group_name \
#     $log_configuration \
#     $metrics_configuration
#
# Parameters:
# * $resource_id           : Resource ID of the resource to stream logs.
# * $resource_group_name   : Name of the resource group.
# * $log_configuration     : Log configuration.
# * $metrics_configuration : Metrics configuration.
#
# Example:
# ./stream_logs_to_eventhub.sh \
#     /subscriptions/12345678-1234-1234-1234-1234567890abcdef/resourceGroups/myResourceGroup/providers/Microsoft.Web/sites/myFunctionApp \
#     myResourceGroup \
#     '[{"category": "FunctionAppLogs", "enabled": true}]' \
#     '[{"category": "AllMetrics", "enabled": true}]'
# -----------------------------------------------------------------------------

# -----------------------------------------------------------------------------
# Preamble:
# ---------

# Global variables
PROJECT_NAME="nr-logforwarder"

# -----------------------------------------------------------------------------
# Input validation:
# -----------------

# Check if resource id is provided
if [ -z "$1" ]; then
    echo "[ERR] Resource ID is not provided."
    exit 1
else
    RESOURCE_ID="$1"
fi

# Check if resource group name is provided
if [ -z "$2" ]; then
    echo "[ERR] Resource group name is not provided."
    exit 1
else
    RESOURCE_GROUP_NAME="$2"
fi

# Check if log configuration is provided
if [ -z "$3" ]; then
    echo "[ERR] Log configuration is not provided."
    exit 1
else
    LOG_CONFIGURATION="$3"
fi

# Check if metrics configuration is provided
if [ -z "$4" ]; then
    echo "[WARN] Metrics configuration is not provided."
    exit 1
else
    METRICS_CONFIGURATION="$4"
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

# Get Eventhub Access Shared Key ID
EVENT_HUB_NAMESPACE_NAME="ehns-${PROJECT_NAME}-${RANDOM_SUFFIX}"
EVENT_HUB_NAMESPACE_ACCESS_KEY_NAME="sak-${PROJECT_NAME}-${RANDOM_SUFFIX}"
EVENT_HUB_NAME="eh-log-collector"

EVENT_HUB_NAMESPACE_ACCESS_KEY_ID=$(
    az eventhubs namespace authorization-rule show \
        --authorization-rule-name "${EVENT_HUB_NAMESPACE_ACCESS_KEY_NAME}" \
        --namespace-name "${EVENT_HUB_NAMESPACE_NAME}" \
        --resource-group "${RESOURCE_GROUP_NAME}" \
        --query "id" \
        --output tsv
)

# Setup function app diagnostics settings
DIAGNOSTIC_SETTING_NAME="ds-${PROJECT_NAME}-${RANDOM_SUFFIX}"

echo az monitor diagnostic-settings create \
    --name "${DIAGNOSTIC_SETTING_NAME}" \
    --resource "${RESOURCE_ID}" \
    --resource-group "${RESOURCE_GROUP_NAME}" \
    --logs ${LOG_CONFIGURATION} \
    --metrics ${METRICS_CONFIGURATION} \
    --event-hub "${EVENT_HUB_NAME}" \
    --event-hub-rule "${EVENT_HUB_NAMESPACE_ACCESS_KEY_ID}"

if [ $? -eq 0 ]; then
    echo "[INFO] Diagnostic settings '${DIAGNOSTIC_SETTING_NAME}' created successfully."
else
    echo "[ERR] Failed to create diagnostic settings '${DIAGNOSTIC_SETTING_NAME}'."
    exit 1
fi
