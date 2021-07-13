/*
* Utils and common settings
*/

const moment = require("moment")
const assert = require('assert')

const DEFAULT_TIMEOUT = 5000  
const BATCH_SIZE = 50
const METRIC_API = "https://metric-api.newrelic.com/metric/v1" //US DC accounts

const CRITICAL_THRESHOLD = 14
const WARNING_THRESHOLD = 28

let RUNNING_LOCALLY = false
let scriptErrors = []
let criticalErrors = []
let warningErrors = []

/*
*  ========== LOCAL TESTING CONFIGURATION ===========================
*  This section allows you to run the script from your local machine
*  mimicking it running in the new relic environment. Much easier to develop!
*/


const IS_LOCAL_ENV = typeof $http === 'undefined';
if (IS_LOCAL_ENV) {  
  RUNNING_LOCALLY=true
  var $http = require("request");       //only for local development testing
  var $secure = {}                      //only for local development testing
  var $env = {}
  $env.LOCATION="local"
  console.log("Running in local mode")
} 
// ========== END LOCAL TESTING CONFIGURATION ==========================


/*
* setAttribute()
* Sets a custom attribute on the synthetic record
*
* @param {string} key               - the key name
* @param {Strin|Object} value       - the value to set
*/
const setAttribute = function(key,value) {
    if(!RUNNING_LOCALLY) { //these only make sense when running on a minion
        $util.insights.set(key,value)
    } else {
        console.log(`[FAUX] Set attribute '${key}' to ${value}`)
    }
}


/*
* genericServiceCall()
* Generic service call helper for commonly repeated tasks
*
* @param {number} responseCodes  - The response code (or array of codes) expected from the api call (e.g. 200 or [200,201])
* @param {Object} options       - The standard http request options object
* @param {function} success     - Call back function to run on successfule request
*/
const  genericServiceCall = function(responseCodes,options,success) {
    !('timeout' in options) && (options.timeout = DEFAULT_TIMEOUT) //add a timeout if not already specified 
    let possibleResponseCodes=responseCodes
    if(typeof(responseCodes) == 'number') { //convert to array if not supplied as array
      possibleResponseCodes=[responseCodes]
    }
    return new Promise((resolve, reject) => {
        $http(options, function callback(error, response, body) {
        if(error) {
            reject(`Connection error on url '${options.url}'`)
        } else {
            if(!possibleResponseCodes.includes(response.statusCode)) {
                let errmsg=`Expected [${possibleResponseCodes}] response code but got '${response.statusCode}' from url '${options.url}'`
                reject(errmsg)
            } else {
                resolve(success(body,response,error))
            }
          }
        });
    })
  }


/*
* sendDataToNewRelic()
* Sends a metrics payload to New Relic
*
* @param {object} data               - the payload to send
*/
const sendDataToNewRelic = async (data) =>  {
    let request = {
        url: METRIC_API,
        method: 'POST',
        json: true,
        headers :{
            "Api-Key": INSERT_KEY
        },
        body: data
    }
    return genericServiceCall([200,202],request,(body,response,error)=>{
        if(error) {
            console.log(`NR Post failed : ${error} `)
            return false
        } else {
            return true
        }
        })
}


/*
* asyncForEach()
*
* A handy version of forEach that supports await.
* @param {Object[]} array     - An array of things to iterate over
* @param {function} callback  - The callback for each item
*/
async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array);
    }
  }

/* Chunk array 
*/
function chunk_arr(inputArray,perChunk) {
    var perChunk = 2 // items per chunk    
    return inputArray.reduce((all,one,i) => {
        const ch = Math.floor(i/perChunk); 
        all[ch] = [].concat((all[ch]||[]),one); 
        return all
     }, [])
}


/* 
* Promise.allSettled polyfill
*/
const allSettled =  ((promises) => Promise.all(promises.map(p => p
    .then(value => ({
      status: 'fulfilled', value
    }))
    .catch(reason => ({
      status: 'rejected', reason
    }))
  )));


  /*
  * End Utils Section
  */

