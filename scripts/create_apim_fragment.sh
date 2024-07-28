#! /bin/bash
# -----------------------------------------------------------------------------
# File:
# create_apim_fragment.sh
#
# Authors:
# * Martin Vuelta <zodiacfireworks@softbutterfly.io>
# * SoftButterfly Dev Team <dev@softbutterfly.io>
#
# Description:
# This script will create Azure API Management logger
#
# Usage:
# ./create_apim_fragment.sh \
#    $apim_name \
#    $resource_group_name
#
# Parameters:
# * $apim_name               : Azure API Management name.
# * $resource_group_name     : Name of the resource group.
#
# Example:
# ./create_apim_fragment.sh \
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

# Check if Azure API Management name is provided
if [ -z "$1" ]; then
    echo "[ERR] Azure API Management name is not provided."
    exit 1
else
    APIM_NAME="$1"
fi

# Check if resource group name is provided
if [ -z "$2" ]; then
    echo "[ERR] Resource group name is not provided."
    exit 1
else
    RESOURCE_GROUP_NAME="$2"
fi

# -----------------------------------------------------------------------------
# Execution:
# ----------
# Read content from policies/nr-log-to-eventhub-fragment.xml
if [ ! -f "policies/nr-log-to-eventhub-fragment.xml" ]; then
    echo "[ERR] File 'policies/nr-log-to-eventhub-fragment.xml' not found."
    exit 1
else
    POLICY_CONTENT=$(cat policies/nr-log-to-eventhub-fragment.xml)
fi

# Define the policy name
POLICY_NAME="pf-nr-log-to-eventhub"

# Ceate a bicep file to deploy the apim fragment
cat > apim-fragment.bicep <<EOF
param apimName string

param policyName string

param policyContent string

resource nrApim 'Microsoft.ApiManagement/service@2023-09-01-preview' existing = {
    name: apimName
}

resource nrPolicy 'Microsoft.ApiManagement/service/policyFragments@2023-09-01-preview' = {
    name: policyName
    parent: nrApim
    properties: {
        description: 'Send logs to EventHub for New Relic log forwarder'
        format: 'rawxml'
        value: policyContent
    }
}

output nrApimName string = nrApim.name
output policyName string = nrPolicy.name
EOF

# Deploy the apim fragment
az deployment group create \
    --resource-group $RESOURCE_GROUP_NAME \
    --template-file apim-fragment.bicep \
    --parameters \
        apimName=$APIM_NAME \
        policyName=$POLICY_NAME \
        policyContent="$POLICY_CONTENT" > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo "[ERR] Failed to create Azure API Management fragment."
    rm -rf apim-fragment.bicep

    exit 1
else
    echo "[INFO] Azure API Management fragment '${POLICY_NAME}' created successfully."
    echo "[INFO] Use it with the following policy statement:"
    echo "[INFO] <include-fragment fragment-id=\"${POLICY_NAME}\" />"
fi

rm -rf apim-fragment.bicep
