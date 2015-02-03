/**
*  Copyright 2014 IBM
*
*   Licensed under the Apache License, Version 2.0 (the "License");
*   you may not use this file except in compliance with the License.
*   You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
*   Unless required by applicable law or agreed to in writing, software
*   distributed under the License is distributed on an "AS IS" BASIS,
*   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
*   See the License for the specific language governing permissions and
*   limitations under the License.
*/

var http = require('http');
var assert = require('assert');
var fs = require('fs');
var nconf = require('nconf');
var request = require('request');
var requestjson = require('request-json');
var assert = require('assert');

var today = Date.now();
nconf.argv().env().file({ file: './containerservice.config.json'});

var API_KEY = nconf.get('API_KEY');
var API_URL = nconf.get('API_URL');
var IMAGE_NAME = nconf.get('IMAGE_NAME');
var STAGING_NAME = nconf.get('STAGING_NAME');
var PRODUCTION_NAME = nconf.get('PRODUCTION_NAME');
var DEBUG = nconf.get('DEBUG');
var DEBUG_LOG = nconf.get('DEBUG_LOG');


describe('Pipeline Service can leverage the Container Service', function () {	
	this.timeout(100000)
	var token=undefined;
	var base_container_name=undefined;

	before(function(done){
		assert.notEqual(API_KEY, undefined, "API_KEY for Container service must be set in the environment.");
		assert.notEqual(IMAGE_NAME, undefined, "The name of the docker image containing application must be set in the environment as IMAGE_NAME.");

		IMAGE_NAME_COMP = IMAGE_NAME.split('/');
		assert(IMAGE_NAME_COMP.length = 3, "anticipating the " + IMAGE_NAME + " would have 3 elements");
		base_container_name = IMAGE_NAME_COMP[2]; 

		var auth_url=API_URL+"/containers/tokens";
		var auth_data='{"auth":{"key":"' + API_KEY + '"}}';
		request.post(
			{
				url: auth_url,
				body : auth_data,
				headers: {'Content-Type': 'application/json'}
			},
			function (error, response, body) {        
			    assert.equal(error, undefined ,"could not get token from " + auth_url);
			    assert.equal(response.statusCode, 200, "expected 200 return code from " + auth_url);
		        token = body;
		        assert.notEqual(token, undefined, "expected non null token from " + auth_url);
		        done();
			}
		);
	});

	getContainer = function(name, callback){
		var url=API_URL+"/containers/" + name + "/json";
		request.get(
		{
			url: url,
			headers: {
				'Content-Type': 'application/json', 
				'X-Auth-Token': token
			}
		},
		function (error, response, body) {      
			callback(error, response, body);
		});			
	}

	wait_for_container_removal = function(containername, done){
		getContainer(containername, function(error, response, body){
			if (response.statusCode == 404){
				done();
			}else{
				setTimeout(function(){ wait_for_container_removal(containername,done) }, 10000);
			}
		});	
	}

	check_container_started = function(containername, done){
		getContainer(containername, function(error, response, body){
			assert.equal(error, undefined, "unexpected error " + error + ", when checking on container " + containername + " : " + body);
			containerstatus = JSON.parse(body).State.Status;
			console.log("                                    " + containername + " container status is " + containerstatus);
			assert.notEqual(containerstatus,"Failed", "container " + containername + " could not be started from image " + IMAGE_NAME);
			if(containerstatus == "Running"){
				done();
			}else{
				setTimeout(function(){ check_container_started(containername, done) }, 10000);
			}
		});
	}

	start_container = function(containername, done){
		var url= API_URL+"/containers/create?name="+containername;
		var options = {
		  url: url,
		  body: "{\"Memory\": 256,\"CpuShares\": 1024,\"NumberCpus\": 1,\"Env\":null,\"Image\":\"" + IMAGE_NAME + "\"}",
		  headers: {"Content-Type": "application/json", "Accept": "application/json", 'X-Auth-Token': token},
		  method: "POST"
		} 	
		if(DEBUG == "1"){ 
			console.log("starting container using " + url ); 
			console.log("options: " + JSON.stringify(options));
		}

		callback = 	function (error, response, body) {      
		    assert.equal(error, undefined ,"error " + error + " returned when creating container " + url);
		    assert.equal(response.statusCode, 201, "expected 201 return code from " + url + " but got " + response.statusCode + ", " + body);
	        check_container_started(containername, done);
		}
		request(options,callback);
	}

	delete_container = function(containername, done){
		var url= API_URL+"/containers/"+containername;
		var options = {
		  url: url,
		  headers: {"Content-Type": "application/json", "Accept": "application/json", 'X-Auth-Token': token},
		  method: "DELETE"
		} 	
		callback = 	function (error, response, body) {      
		    assert.equal(error, undefined ,"error " + error + " returned when deleting container " + url);
		    assert.equal(response.statusCode, 204, "expected 204 return code from " + url + " but got " + response.statusCode + ", " + body);
	        done();
		}
		request(options,callback);
	}

	describe('for continous testing', function(){
		var containerid=undefined 
		it('has valid token', function(){
			assert.notEqual(token, undefined, "expected a valid token");
		});
		it('by getting a list of images', function(done){
			var url=API_URL+"/containers/images/json";
			request.get(
			{
				url: url,
				headers: {
					'Content-Type': 'application/json', 
					'X-Auth-Token': token
				}
			},
			function (error, response, body) {      
			    assert.equal(error, undefined ,"error returned when getting list of images" + url);
			    assert.equal(response.statusCode, 200, "expected 200 return code from " + url);
		        var images = JSON.parse(body);
		        assert(images.length > 2, "expected there to be at least two images in the registry");
		        var found = false;
				for (var i = 0; i < images.length; i++) {
					anImage=images[i];
		        	if (anImage.Image == IMAGE_NAME){
		        		found = true;
		        	} 	
				}
				assert(found,"did not find " + IMAGE_NAME + "in " + images);
		        done();
			}
			);
		});

		it('and starting a container for my application', function(done){
			start_container(base_container_name, done);
		});

		it('and starting container with my automated functional regression');
		it('confirming that the container has successfully started');
		it('and testing my container by passing environment information to the test container about the applciation container');
		it('then finially deleting my container used for automated testing', function(done){
			delete_container(base_container_name,done);
		});
		it('and testing my container');
		it('then finially deleting the container');
	});

	describe('for staging', function(){
		var floating_ip_staging = undefined;	
		before(function(done){
			done();
		});

		it('identify floating IP addressed used by staging', function(done){
			assert.notEqual(STAGING_NAME, undefined, "The name of the container in staging must be defined as STAGING_NAME in the environment.");
			getContainer(STAGING_NAME, function(error, response, body){
				assert.notEqual(response.statusCode, 404, 'Could not find existing staging instance called ' + STAGING_NAME + ' to replace: ' + body);
				assert.equal(response.statusCode, 200, 'expected to find staging instance');
				floating_ip_staging = JSON.parse(body).NetworkSettings.PublicIpAddress;
				assert.notEqual(floating_ip_staging, undefined, "could not find Network Address for " + body);
				done();
			});
		});

		it('then deleting previous staging instance', function(done){
			delete_container(STAGING_NAME, done);
		});

		describe('can start a new instance for staging', function(){
			before(function( done ){
    			wait_for_container_removal(STAGING_NAME, done );
  			});

			it('then deploy a new container with the new version of the application', function(done){
				start_container(STAGING_NAME, done);
			});
			describe('assign a public IP address and test the application', function(){
				before(function( done ){
	    			check_container_started(STAGING_NAME, done);
	  			});
				it('binding IP address to the new instance', function(done){
					var url= API_URL+"/containers/"+STAGING_NAME+"/floating-ips/"+floating_ip_staging+"/bind";
					var options = {
					  url: url,
					  headers: {"Content-Type": "application/json", "Accept": "application/json", 'X-Auth-Token': token},
					  method: "POST"
					} 	
					callback = 	function (error, response, body) {      
					    assert.equal(error, undefined ,"error " + error + " returned when binding " + floating_ip_staging + " to container " + STAGING_NAME + " using " + url);
					    assert.equal(response.statusCode, 204, "expected 204 return code from " + url + " but got " + response.statusCode + ", " + body);

						getContainer(STAGING_NAME, function(error, response, body){
							networkIP = JSON.parse(body).NetworkSettings.PublicIpAddress;
							console.log("                                    Container Public IP Address is:" + networkIP);
							assert.equal(networkIP, floating_ip_staging,"expected for network id of " + JSON.stringify(body) + " to be " + floating_ip_staging);
							done();
						});
					}
					request(options,callback);
				});
				describe('validate the application is running correctly', function(){
					
					before(function( done ){
						setTimeout(done, 5000);
	  				});

					it('testing application is available on public IP and port 80', function(done){
						var url= "http://" + floating_ip_staging;
						var options = {
						  url: url,
						  method: "GET"
						};
						request(options, function(error, response, body){
							assert.equal(error, undefined, "received an unexpected error from " + url + ":" + error);
							assert.equal(response.statusCode, 200, "expected 200 return code from " + url + " but got " + response.statusCode + ", " + body);
							done();
						});
					});
					it('run application regression suite and health check');
				});
			});
		});
	});


	describe('for production', function(){
		var floating_ip_production = undefined;	
		before(function(done){
			assert.notEqual(PRODUCTION_NAME, undefined, "The name of the container in staging must be defined as PRODUCTION_NAME in the environment.");
			done();
		});

		it('identify floating IP addressed used by production', function(done){
			getContainer(PRODUCTION_NAME, function(error, response, body){
				assert.notEqual(response.statusCode, 404, 'Could not find existing production instance called ' + PRODUCTION_NAME + ' to replace: ' + body);
				assert.equal(response.statusCode, 200, 'expected to find production instance');
				floating_ip_production = JSON.parse(body).NetworkSettings.PublicIpAddress;
				assert.notEqual(floating_ip_production, undefined, "could not find Network Address for " + body);
				done();
			});
		});

		it('then deleting previous production instance', function(done){
			delete_container(PRODUCTION_NAME, done);
		});

	describe('can start a new instance for production', function(){
			before(function( done ){
    			wait_for_container_removal(PRODUCTION_NAME, done );
  			});

			it('then deploy a new container with the new version of the application', function(done){
				start_container(PRODUCTION_NAME, done);
			});
			describe('assign a public IP address and test the application', function(){
				before(function( done ){
	    			check_container_started(PRODUCTION_NAME, done);
	  			});
				it('binding IP address to the new instance', function(done){
					var url= API_URL+"/containers/"+PRODUCTION_NAME+"/floating-ips/"+floating_ip_production+"/bind";
					var options = {
					  url: url,
					  headers: {"Content-Type": "application/json", "Accept": "application/json", 'X-Auth-Token': token},
					  method: "POST"
					} 	
					callback = 	function (error, response, body) {      
					    assert.equal(error, undefined ,"error " + error + " returned when binding " + floating_ip_production + " to container " + PRODUCTION_NAME + " using " + url);
					    assert.equal(response.statusCode, 204, "expected 204 return code from " + url + " but got " + response.statusCode + ", " + body);

						getContainer(PRODUCTION_NAME, function(error, response, body){
							networkIP = JSON.parse(body).NetworkSettings.PublicIpAddress;
							console.log("                                    Container Public IP Address is:" + networkIP);
							assert.equal(networkIP, floating_ip_production,"expected for network id of " + JSON.stringify(body) + " to be " + floating_ip_production);
							done();
						});
					}
					request(options,callback);
				});
				describe('validate the application is running correctly', function(){
					before(function( done ){
						setTimeout(done, 5000);
	  				});
					it('testing application is available on public IP and port 80', function(done){
						var url= "http://" + floating_ip_production;
						var options = {
						  url: url,
						  method: "GET"
						}
						request(options, function(error, response, body){
							assert.equal(response.statusCode, 200, "expected 200 return code from " + url + " but got " + response.statusCode + ", " + body);
							done();
						});
					});
					it('run application regression suite and health check');
				});
			});
		});
	});
});