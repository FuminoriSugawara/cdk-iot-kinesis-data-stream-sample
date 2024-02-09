#!/bin/bash
set -e

AWS_PROFILE=$1

if [ -z $AWS_PROFILE ]; then
  echo "Usage: $0 <AWS_PROFILE>"
  exit 1
fi

echo "AWS_PROFILE: $AWS_PROFILE"

cd ./cdk

cdk destroy --profile $AWS_PROFILE
