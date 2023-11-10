# New Relic Log Forwarder for Azure B2C Logs

Conjunto de azure function para enviarloslogsdeazure B2C hacia New Relic.

## Requerimientos

* Node.js v18.x

## Configuración

Azure Storeage Account Life cycle policy

```json
{
  "rules": [
    {
      "enabled": true,
      "name": "",
      "type": "Lifecycle",
      "definition": {
        "actions": {
          "baseBlob": {
            "delete": {
              "daysAfterModificationGreaterThan": 1
            }
          }
        }
      }
    }
  ]
}
```

## Desarrollo
