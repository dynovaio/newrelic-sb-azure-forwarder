#! /bin/bash
# -----------------------------------------------------------------------------
# File:
# create_eventhub.sh
#
# Authors:
# * Martin Vuelta <zodiacfireworks@softbutterfly.io>
# * SoftButterfly Dev Team <dev@softbutterfly.io>
#
# Description:
# Creates an Event Hub namespace and an Event Hub in Azure.
#
# Usage:
# ./create_eventhub.sh \
#    $resource_group_name \
#    $location
#
# Parameters:
# * $resource_group_name : Name of the resource group.
# * $location            : Location of the resource group.
#
# Example:
# ./create_eventhub.sh \
#    myResourceGroup \
#    eastus
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

# Check if resource group name is provided
if [ -z "$1" ]; then
    echo "[ERR] Resource group name is not provided."
    exit 1
else
    RESOURCE_GROUP_NAME="$1"
fi

# Check if location is provided
if [ -z "$2" ]; then
    echo "[WARN] Location is not provided. Using default location '${DEFAULT_LOCATION}'."
    LOCATION="${DEFAULT_LOCATION}"
else
    LOCATION="$2"
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

# Create event hub namespace
EVENT_HUB_NAMESPACE_NAME="ehns-${PROJECT_NAME}-${RANDOM_SUFFIX}"

az eventhubs namespace create \
    --name "${EVENT_HUB_NAMESPACE_NAME}" \
    --resource-group "${RESOURCE_GROUP_NAME}" \
    --location "${LOCATION}" > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo "[ERR] Failed to create Event Hub namespace."
    exit 1
else
    echo "[INFO] Event Hub namespace '${EVENT_HUB_NAMESPACE_NAME}' created successfully."
fi

# Create an event hub
EVENT_HUB_NAME="eh-log-collector"

az eventhubs eventhub create \
    --name "${EVENT_HUB_NAME}" \
    --namespace-name "${EVENT_HUB_NAMESPACE_NAME}" \
    --resource-group "${RESOURCE_GROUP_NAME}" > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo "[ERR] Failed to create Event Hub."
    exit 1
else
    echo "[INFO] Event Hub '${EVENT_HUB_NAME}' created successfully."
fi

# Create Event Hub Shared Access Keys
EVENT_HUB_NAMESPACE_ACCESS_KEY_NAME="sak-${PROJECT_NAME}-${RANDOM_SUFFIX}"

az eventhubs namespace authorization-rule create \
    --name "${EVENT_HUB_NAMESPACE_ACCESS_KEY_NAME}" \
    --namespace-name "${EVENT_HUB_NAMESPACE_NAME}" \
    --resource-group "${RESOURCE_GROUP_NAME}" \
    --rights "Manage" "Listen" "Send" > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo "[ERR] Failed to create Event Hub Shared Access Keys."
    exit 1
else
    echo "[INFO] Event Hub Shared Access Keys '${EVENT_HUB_NAMESPACE_ACCESS_KEY_NAME}' created successfully."
fi
