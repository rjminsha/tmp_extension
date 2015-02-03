#!/bin/bash

#********************************************************************************
# Copyright 2014 IBM
#
#   Licensed under the Apache License, Version 2.0 (the "License");
#   you may not use this file except in compliance with the License.
#   You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
#   Unless required by applicable law or agreed to in writing, software
#   distributed under the License is distributed on an "AS IS" BASIS,
#   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#   See the License for the specific language governing permissions and
#********************************************************************************

#############################################
# Print information about my environment    #
#############################################
if [ -z $PRODUCTION_NAME ]; then 
    export PRODUCTION_NAME="${APPLICATION_NAME}production"
fi 

echo "********************* REST based  Deploy Script ******************************"
echo "Registry URL: $REGISTRY_URL"
echo "Registry Server: $REGISTRY_SERVER"
echo "My repository: $REPOSITORY"
echo "APPLICATION_VERSION: $APPLICATION_VERSION"
echo "APPLICATION_NAME: $APPLICATION_NAME"
echo "APPLICATION_NAME: $STAGING_NAME"
echo "BUILDER: $BUILDER"
echo "WORKSPACE: $WORKSPACE"
echo "ARCHIVE_DIR: $ARCHIVE_DIR"
echo "EXT_DIR: $EXT_DIR"
echo "PATH: $PATH"
echo "******************************************************************************"

# Look in build.properties for the IMAGE_URL
if [ -z $IMAGE_NAME ]; then
    if [ -f "build.properties" ]; then
        . build.properties 
    else 
        echo "could not find build.properties"
    fi  
    if [ -z $IMAGE_NAME ]; then
        echo "${red}IMAGE_URL not set.  Set the IMAGE_URL in the environment or provide a Docker build job as input to this deploy job ${no_label}"
        exit 1
    fi 
else 
    echo "IMAGE_URL: ${IMAGE_NAME}"
fi 
    
#########################
# Deploy Container      #
#########################
# The following will invoke the REST API for the IBM Container Service
# The commands are packaged as a set of mocha tests
npm install --silent
node_modules/mocha/bin/mocha --reporter=spec --grep="for production" --timeout=120000
RESULT=$?
if [ $RESULT -ne 0 ]; then
    echo -e "${red}Failed to stage application successfully"
    exit $RESULT
fi 

#########################
# Archive any results   #
#########################
