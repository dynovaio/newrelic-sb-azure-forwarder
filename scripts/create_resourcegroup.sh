#! /bin/bash
# -----------------------------------------------------------------------------
# File:
# create_resourcegroup.sh
#
# Authors:
# * Martin Vuelta <zodiacfireworks@softbutterfly.io>
# * SoftButterfly Dev Team <dev@softbutterfly.io>
#
# Description:
# This script will create a resource group in Azure.
#
# Usage:
# ./create_resourcegroup.sh \
#     $resource_group_name \
#     $location
#
# Parameters:
# * $resource_group_name : Name of the resource group.
# * $location            : Location of the resource group.
#
# Example:
# ./create_resourcegroup.sh \
#     myResourceGroup \
#     eastus
# -----------------------------------------------------------------------------

# -----------------------------------------------------------------------------
# Preamble:
# ---------

# Global variables
DEFAULT_LOCATION="eastus"

# -----------------------------------------------------------------------------
# Input validation:
# -----------------

# Check if resource group name is provided
if [ -z "$1" ]; then
    echo "[ERR] Resource group name is not provided. Using default resource group name."
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

# Check if resource group already exists
az group show \
    --name "${RESOURCE_GROUP_NAME}" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "[WARN] Resource group '${RESOURCE_GROUP_NAME}' already exists."
    exit 1
fi

# Create resource group
az group create \
    --name "${RESOURCE_GROUP_NAME}" \
    --location "${LOCATION}" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "[INFO] Resource group '${RESOURCE_GROUP_NAME}' created successfully."
    exit 0
else
    echo "[ERR] Failed to create resource group '${RESOURCE_GROUP_NAME}'."
    exit 1
fi
