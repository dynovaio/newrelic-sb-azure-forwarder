#! pwsh
# -----------------------------------------------------------------------------
# File:
# create_apim_logger.ps1
#
# Authors:
# * Martin Vuelta <zodiacfireworks@softbutterfly.io>
# * SoftButterfly Dev Team <dev@softbutterfly.io>
#
# Description:
# This script will create Azure API Management logger
#
# Usage:
# ./create_apim_logger.ps1 \
#   -loggerId <loggerId> \
#   -apimServiceName <apimServiceName> \
#   -resourceGroup <resourceGroup>
#
# Parameters:
# -loggerId          : The id of the logger
# -apimServiceName   : The name of the Azure API Management service
# -resourceGroup     : The name of the resource group
#
# Example:
# ./create_apim_logger.ps1 \
#     -loggerId "my-logger" \
#     -apimServiceName "my-apim-service" \
#     -resourceGroup "my-resource-group"
# -----------------------------------------------------------------------------

# -----------------------------------------------------------------------------
# Preamble
# --------

# Define parameters
param (
    [Parameter(Mandatory = $true)]
    [string] $loggerId,

    [Parameter(Mandatory = $true)]
    [string] $apimServiceName,

    [Parameter(Mandatory = $true)]
    [string] $resourceGroup
)

# Set strict mode
Set-StrictMode -Version Latest

# Set error action preference
$ErrorActionPreference = "Stop"

# Global variables
$PROJECT_NAME="nr-logforwarder"

# -----------------------------------------------------------------------------
# Execution:
# ----------

# Get Random suffix from .random_suffix file, if file does not exist, throw error
try {
    $RANDOM_SUFFIX = Get-Content .random_suffix
} catch {
    "[ERR] Random suffix file not found."
}

$EVENT_HUB_NAMESPACE_NAME="ehns-$PROJECT_NAME-$RANDOM_SUFFIX"
$EVENT_HUB_NAME="eh-log-collector"

# Get the eventhub connection string
$eventHubConnectionString = (
    Get-AzEventHubKey `
        -ResourceGroupName "$resourceGroup" `
        -Namespace "$EVENT_HUB_NAMESPACE_NAME" `
        -AuthorizationRuleName "RootManageSharedAccessKey"
).PrimaryConnectionString

# Create the APIM context
$apimContext = (
    New-AzApiManagementContext `
        -ServiceName "$apimServiceName" `
        -ResourceGroupName "$resourceGroup"
)

# Create the logger
New-AzApiManagementLogger `
    -Context $apimContext `
    -LoggerId "$loggerId" `
    -Name "$EVENT_HUB_NAME" `
    -ConnectionString "$eventHubConnectionString"
