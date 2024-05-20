variable "name" { description="Monitor name"}
variable "frequency" { description="Monitor frequency"}
variable "locations" { description="Monitor locations"}
variable "insertKeyName" { description = "Insert key name"}
variable "insertKeyValue" { description = "Insert key valye"}
variable "targetDataJS" { description = "JS code to set target data"}
variable "nameSpace" { description = "Namespace for the app, usually SSLCHKR, provide a different one if deploying this app more than once to an account" }


resource "newrelic_synthetics_script_monitor" "monitor" {
  status               = "ENABLED"
  name                 = "${var.nameSpace}_${var.name}"
  type                 = "SCRIPT_API"
  locations_public     = var.locations
  period               = var.frequency

  script               = "const MONITOR_NAME=\"${var.nameSpace}-${var.name}\"\nconst NAMESPACE=\"${var.nameSpace}\" \nlet INSERT_KEY=$secure.${newrelic_synthetics_secure_credential.metricsInsertKey.key}\n${var.targetDataJS}\n${data.local_file.synthetic_js.content}"

  script_language      = "JAVASCRIPT"
  runtime_type         = "NODE_API"
  runtime_type_version = "16.10"
}

resource "newrelic_synthetics_secure_credential" "metricsInsertKey" {
  key = "${var.nameSpace}_${random_string.random.result}"
  value = var.insertKeyValue
  description = "API key for inserting metrics data to New Relic"
}

resource "random_string" "random" {
  length           = 6
  special          = false
  override_special = "/@£$_-"
}

data "local_file" "synthetic_js" {
    filename = "${path.module}/src/synthetic.js"
}
