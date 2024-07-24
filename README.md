![Community-Project](https://gitlab.com/softbutterfly/open-source/open-source-office/-/raw/master/assets/dynova/dynova-open-source--banner--community-project.png)

[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-v2.0%20adopted-ff69b4.svg)](code_of_conduct.md)
[![License](https://img.shields.io/badge/License-BSD_3--Clause-blue.svg)](LICENSE.txt)

# New Relic Log Forwarder

This project is a simple log forwarder that reads logs from a file and sends
them to New Relic.

The purpose of this project is to provide a simple way to forward logs to
New Relic from Azure services. This project is heavily inspired by the
[New Relic Log Forwarder ↗][href:nrlogforwarder] but contains modifications to
handle specific use cases in Azure in order to provide logs in context within
the New Relic platform.

## Requirements

In order to run locally or deploy the samples in this repository, you will need the following tools:

* nvm ([↗][href:nvm])
* Azure Functions Core Tools ([↗][href:azfct])
* Azure CLI ([↗][href:azcli])
* New Relic account ([↗][href:newrelic])
* Visual Studio Code ([VSCode ↗][href:vscode]) with the Azure Functions
extension

Read the [REQUIREMENTS.md ↗][href:requirements] file for more information.

## Directory Structure

The principal components of this repository are organized as follows:

```
.
├── scripts
└── src
```

* `scripts`: Contains scripts to automate the deployment to Azure.
* `src`: Contains the source code for the Log Forwarder.

## Usage

To use this project, you will need to follow these steps:

1. Clone this repository to your local machine.

    ```bash
    git clone https://github.com/dynovaio/newrelic-log-forwarder.git
    ```

2. Open a terminal and navigate to the root of the repository.

    ```bash
    cd newrelic-log-forwarder
    ```

3. Read the `REQUIREMENTS.md` file and meet the requirements.

4. Deploy the sample to azure using the scripts provided in the `scripts`
   directory. This scripts can be run using the following command:

    ```bash
    # Modify the values of the variables according to your requirements
    location="eastus"
    resource_group_name="my-resource-group"
    function_app_runtime_version="20"
    new_relic_license_key="YOUR_NEW_RELIC_LICENSE_KEY"

    ./scripts/create_resourcegroup.sh \
        $resource_group_name \
        $location

    ./scripts/create_functionapp.sh \
        $function_app_runtime_version \
        $resource_group_name \
        $location

    ./scripts/create_eventhub.sh \
        $resource_group_name \
        $location

    ./scripts/configure_functionapp.sh \
        $function_app_name \
        $resource_group_name \
        $new_relic_license_key

    ./scripts/publish_functionapp.sh \
        $function_app_name \
        $function_app_runtime \
        $resource_group_name
    ```
5. Configure your target Azure component to send logs to the Azure Event Hub
    using the following command:

    ```bash
    # Modify the values of the variables according to your requirements
    $resource_id = "my-resource-id"
    $resource_group_name = "my-resource-group"
    $log_configuration = "my-log-configuration"
    $metrics_configuration = "my-metrics-configuration"

    ./scripts/stream_logs_to_event_hub.sh \
        $resource_id \
        $resource_group_name \
        $log_configuration \
        $metrics_configuration
    ```

    The variables must be replaced with the correct values according to your
    target resource. The `resource_id` is the id of the resource that you want
    to stream logs from. The `log_configuration` and `metrics_configuration`
    are the log and metrics configurations that you want to stream to the Event
    Hub.

    For example, in the case of azure functions, you can use the following

    ```bash
    resource_id=$(
        az functionapp show
            --name $function_app_name
            --resource-group $function_app_resource_group_name
            --query id
            --output tsv
    )
    log_configuration="'[{\\\"category\\\": \\\"FunctionAppLogs\\\", \\\"enabled\\\": true}]'"
    metrics_configuration="'[{\\\"category\\\": \\\"AllMetrics\\\", \\\"enabled\\\": true}]'"
    ```

6. Check the logs in New Relic.

7. Clean up the resources using the following command:

   ```bash
   az group delete --name $resource_group_name --yes
   ```

## Contributing

Sugestions and contributions are welcome!

> Please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

For more information, please refer to the [Code of Conduct ↗][href:code_of_conduct].

## License

This project is licensed under the terms of the [BSD-3-Clause
↗][href:license] license.

[href:nrlogforwarder]: https://github.com/newrelic/newrelic-azure-functions/tree/master
[href:nvm]: https://github.com/nvm-sh/nvm
[href:azfct]: https://github.com/Azure/azure-functions-core-tools
[href:azcli]: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli
[href:newrelic]: https://newrelic.com/signup
[href:requirements]: REQUIREMENTS.md
[href:license]: LICENSE.txt
[href:code_of_conduct]: CODE_OF_CONDUCT.md
[href:vscode]: https://code.visualstudio.com
