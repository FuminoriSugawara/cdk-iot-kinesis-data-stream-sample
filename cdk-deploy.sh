#!/bin/bash
set -e

AWS_PROFILE=$1

if [ -z $AWS_PROFILE ]; then
  echo "Usage: $0 <AWS_PROFILE>"
  exit 1
fi

echo "AWS_PROFILE: $AWS_PROFILE"

cd ./cdk

npm install

npm run build

cdk deploy --profile $AWS_PROFILE --require-approval never --outputs-file ./outputs.json

echo "Deployed"
