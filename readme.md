# Bulk SSL Checker

This application allows you to check SSL certificate expiry in bulk. The application is a nodejs script that can run within the New Relic Synthetics minion. The terraform package allows you to easily deploy the application to your account, it automates provisioning of of the synthetic, secure credentials, posture dashboards. You may also simply copy and paste the [script](./copy-paste-example.js) if you do not want to use terraform.

## Defining targets
The targets to test are provided by calling the function getTargets(). You can provide the payload of this function which may return static data or if you like you can request dynamic data to be used via an API call. Targets are expected to be in the following JSON format:

```json
[
    {
        "name":"BBC News"
        "domain":"news.bbc.co.uk"
    },
    {
        "domain":"foo.com",
        "hosts": [
            "111.222.333.444",
            "555.666.777.888",
        ]
    },
    {
        "domain":"bam.com",
        "timeout": 10000,
        "hosts": [
            "111.222.333.444",
            "555.666.777.888",
        ]
    },
    {
        "domain":"self-signed-cert.com",
        "allowUnauthorized": true
    },
    {...}
]
```

* `name`: Optional - Friendly Name of the site being tested
* `domain`: Required - The domain name to test
* `hosts`: Optional - An array of IP addresses to test, skipping DNS
* `timeout`: Optional - miiliseconds timeout (default 5000)
* `allowUnauthorized`: Optional - if `true` then cert will not be validated against CA (useful for self-signed)


## Getting started (Terraform)

1. Checkout the repo
2. Copy `runtf.sh.sample` to `runtf.sh` and add your API keys
3. `terraform init` to initialise
4. `./runtf.sh apply` to deploy to New Relic.

### Configuration

* API Keys - `./terraform/runtf.sh`
* Target Data Sources - `./terraform/main.tf`
* Thresholds and timeouts - `./terraform/modules/sslchecker/modules/sslminion/src/synthetic.js` (built)

The boilerplate example references [static_small.js](./terraform/targetdata/static_small.js) from `main.tf` which is a small java script funciton that defines the SSL (TLS) domains to test. There are some other exmaples here of how to specify these. You can event query an API to drive the configuration as demonstrated in [api-driven.js](./terraform/targetdata/api-driven.js).

### Dashboard

The application comes with a built in dashboard. Set up alerts as you require.

![dashboard-example](dashboard.png)

## Getting started (Copy and Paste)
Simply copy and paste the [`copy-paste-example.js`](./copy-paste-example.js) into a Scripted API synthetic monitor. You will need to provide an ingest API key (prefereably via a secure credential) and define your getTargets() function. Refer to the [example scripts](./terraform/targetdata/) for configuration ideas.


## Alerting
You may wish to be alerted if your certificates are about to expire. The script will assert a failure if the number of days remaining for any target is below that configured by the WARNING or CRITICAL thresholds specified in the script.

## Exploring the data
If you deployed using terraform you will find a dashbaord that lets you explore the data easily. If not you may explore the data manually using NRQL. The following data is available:

**Synthetic Check Data**
The summary information about each run of the script is stored as custom attributes against the SyntheticCheck event type. This includes the total number of critical and warning errors amongths other useful meta data. You can query this for example: `SELECT latest(custom.criticalErrors), latest(custom.warningErrors) from SyntheticCheck where monitorName = 'your-monitor-name'

**Target Data**
Data about each target is recorded as a metric in the Metric event type called  `{NAMESPACE}.days`. The name of the metric varies depending on the value set for `NAMESPACE` for which the default is `SSLCHKR`. The data includes dimensional meta attributes for each target including issuer and expir date. You can query the data as follows: `SELECT getField(SSLCHKR.days, 'latest') as 'Days Left', * from Metric where tool='SSLCHKR'`
