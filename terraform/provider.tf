variable terraformNRAccountId {}
variable terraformAPIKey {}

# Configure the terraform and New Relic provider versions
# More details: https://www.terraform.io/docs/configuration/provider-requirements.html
terraform {
  required_version = "> 1.0.1"
  required_providers {
    newrelic = {
      source  = "newrelic/newrelic"
      version = ">=3.36.0"
    }
  }
}


# Configure the New Relic provider with your API key details
# More details: https://registry.terraform.io/providers/newrelic/newrelic/latest/docs/guides/getting_started

provider "newrelic" {
  account_id = var.terraformNRAccountId       # Your New Relic account ID
  api_key = var.terraformAPIKey               # Usually prefixed with 'NRAK'
  region = "US"                               # Valid regions are US and EU
}


# Example S3 remote state
# Uncomment and set to your own configuration.
# More details: https://www.terraform.io/docs/backends/types/s3.html

# terraform {
#   backend "s3" {
#     bucket = "your-s3-bucket-name"
#     key    = "some-folder-of-your-choice/terrafrom.tfstate"
#     region = "eu-west-2"
#     profile = "name-of-your-aws-profile"
#   }
# }