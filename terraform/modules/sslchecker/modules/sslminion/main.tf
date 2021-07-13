variable "name" { description="Monitor name"}
variable "frequency" { description="Monitor frequency"}
variable "locations" { description="Monitor locations"}
variable "insertKeyName" { description = "Insert key name"}
variable "insertKeyValue" { description = "Insert key valye"}
variable "targetDataJS" { description = "JS code to set target data"}
variable "nameSpace" { description = "Namespace for the app, usually SSLCHKR, provide a different one if deploying this app more than once to an account" }

resource "newrelic_synthetics_monitor" "monitor" {
  name = "${var.nameSpace}-${var.name}"
  type = "SCRIPT_API"
  frequency = var.frequency
  status = "ENABLED"
  locations = var.locations
}

resource "newrelic_synthetics_secure_credential" "metricsInsertKey" {
  key = "${var.nameSpace}_MetricInsertKey_${replace(newrelic_synthetics_monitor.monitor.id,"-","_")}"
  value = var.insertKeyValue
  description = "API key for inserting metrics data to New Relic"
}

data "local_file" "base_js" {
    filename = "${path.module}/src/base_script.js"
}

data "local_file" "utils_js" {
    filename = "${path.module}/src/utils_script.js"
}

data "template_file" "header_js" {
    template = templatefile(
               "${path.module}/src/header_script.js",
               {
                monitorName = var.name
                monitorId = newrelic_synthetics_monitor.monitor.id
                nameSpace = var.nameSpace
                insertKeyName = newrelic_synthetics_secure_credential.metricsInsertKey.key
               }
        )
}

resource "newrelic_synthetics_monitor_script" "main" {
  monitor_id = newrelic_synthetics_monitor.monitor.id
  text = "${data.template_file.header_js.rendered} ${data.local_file.utils_js.content} ${var.targetDataJS} ${data.local_file.base_js.content}"
  depends_on = [newrelic_synthetics_secure_credential.metricsInsertKey]
}
