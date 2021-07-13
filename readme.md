# Bulks SSL Checker

This application allows you to check SSL certificate expiry in bulk. The application is a nodejs script that can runs within the New Relic Synthetics minion. The terraform package allows you to easily deploy the applciation to your account, it automates provisiojing of of the synthetic, secure credentials, posture dashboards and alerts.

## Defining targets
The targets to test are provided by calling the function getTargets(). You can provide the payload of this function which may return static data or if you like you can request dynamic data to be used via an API call. Targets are expected to be in the following JSON format:

```json
[
    {
        "name","BBC News",
        "url","news.bbc.co.uk"
    },
    {
        "name","Site Name Here",
        "url","Domain name here"
    },
    {...}
]
```

## Getting started

Checkout the repo, copy `runtf.sh.sample` to `runtf.sh` and add your API keys. Then run `terraform init` to initialise and `./runtf.sh apply` to deploy to New Relic.