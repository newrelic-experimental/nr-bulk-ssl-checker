# Bulk SSL Checker

This application allows you to check SSL certificate expiry in bulk. The application is a nodejs script that can run within the New Relic Synthetics minion. The terraform package allows you to easily deploy the application to your account, it automates provisioning of of the synthetic, secure credentials, posture dashboards.

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
    {...}
]
```

* `name`: Optional
* `domain`: Required
* `hosts`: Optional

## Getting started

1. Checkout the repo
2. copy `runtf.sh.sample` to `runtf.sh` and add your API keys
3. `terraform init` to initialise
4. `./runtf.sh apply` to deploy to New Relic.

## Configuration

* API Keys - `./terraform/runtf.sh`
* Target Data Sources - `./terraform/main.tf`
* Thresholds and timeouts - `./terraform/modules/sslchecker/modules/sslminion/src/utils_script.js`

## Dashboard

The application comes with a built in dashboard. Set up alerts as you require.

![dashboard-example](dashboard.png)