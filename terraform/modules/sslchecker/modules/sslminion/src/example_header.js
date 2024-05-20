/*
Example copy and paste version of script if you do not wish to use terraform
*/

const MONITOR_NAME="Example Boilerplate"
const NAMESPACE="SSLCHKR" 

let INSERT_KEY=$secure.YOUR_SECURE_CREDENTIAL; //Your ingest API key

/*
Add your targets here!
*/
const getTargets=async ()=>{
    return [
        {name: "New Relic", "domain": "newrelic.com"},
        {name: "Terraform", "domain": "www.terraform.io"},
        {name: "Developer NR ", "domain": "developer.newrelic.com"},
    ]
}
