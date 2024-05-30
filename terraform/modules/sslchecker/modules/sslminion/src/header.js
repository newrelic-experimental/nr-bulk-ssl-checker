
const METRIC_API = "https://metric-api.newrelic.com/metric/v1" //US data center accounts
//const METRIC_API = "metric-api.eu.newrelic.com" // EU data center accounts

const CRITICAL_THRESHOLD = 14 // number of days left to trigger critical state
const WARNING_THRESHOLD = 28  // number of days left to trigger warning state

const BATCH_SIZE = 50; // number of checks to run at once
const DEFAULT_TIMEOUT = 5000; //TLS handshake timeout default (can be overdiden in config)
const REJECTUNAUTHORIZED = false // If not false, the server certificate is verified against the list of supplied CAs. An 'error' event is emitted if verification fails; err.code contains the OpenSSL error code. Default: true. https://nodejs.org/docs/latest/api/tls.html#tlssocketrenegotiateoptions-callback 

let RUNNING_LOCALLY = false; // for testing purposes


// End header config ----- don not edit below here ---
