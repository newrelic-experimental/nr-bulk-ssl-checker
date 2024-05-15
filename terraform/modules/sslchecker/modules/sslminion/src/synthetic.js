const getSSLExpiration=function(i,o,n){return"timeout"in i||(i.timeout=DEFAULT_TIMEOUT),i.followRedirect=!1,new Promise((s,a)=>{$http(i,function(t,r,e){t?a(n(`Connection error on url '${i.url}'`)):(t=r.socket.getPeerCertificate())&&t.valid_to?(r={valid_to:t.valid_to,issuer:t.issuer&&t.issuer.O?t.issuer.O:"Unkown"},s(o(r))):a(n("Expiration date missing"))})})};async function run(){var t=await getTargets(),t=flat(t.map(r=>{const e=r.name||r.domain;return r.hosts&&r.hosts.length?r.hosts.map(t=>({name:t+" | "+e,domain:r.domain,host:t,url:"https://"+t})):{name:e,domain:r.domain,host:r.domain,url:"https://"+r.domain}})),r=t.length,e=(setAttribute("expectedTargets",r),chunk_arr(t,BATCH_SIZE));await asyncForEach(e,async(t,r)=>{let e=[];t.forEach(s=>{var t={url:s.url,method:"HEAD",headers:{host:s.domain}};e.push(getSSLExpiration(t,t=>{var r=new Date(t.valid_to),r=moment(r),e=moment();s.valid_to=t.valid_to,s.issuer=t.issuer,s.expirationDate=r.format("YYYY-MM-DD HH:mm:ss Z"),s.expirationDateUTC=r.utc().format("YYYY-MM-DD HH:mm:ss"),s.expirationDateUnix=r.valueOf(),s.expirationDaysAway=Math.floor(moment.duration(r.diff(e)).asDays()),s.state="OK",s.expirationDaysAway<=0?(s.state="OVERDUE",criticalErrors.push(s)):s.expirationDaysAway<=CRITICAL_THRESHOLD?(s.state="CRITICAL",criticalErrors.push(s)):s.expirationDaysAway<=WARNING_THRESHOLD&&(s.state="WARNING",warningErrors.push(s))},t=>{s.error=t,s.state="ERROR",scriptErrors.push(`Target '${s.name}' (${s.url} failed cert info lookup)`)}))}),await allSettled(e);var s={attributes:{}};s.attributes[NAMESPACE+".monitorName"]=MONITOR_NAME,s.attributes.tool=NAMESPACE;let a=Math.round(Date.now()/1e3);t=t.map(t=>{var r={name:NAMESPACE+".days",type:"gauge",value:t.expirationDaysAway||0,timestamp:a,attributes:{}};return r.attributes[NAMESPACE+".name"]=t.name,r.attributes[NAMESPACE+".url"]=t.url,r.attributes[NAMESPACE+".host"]=t.host,r.attributes[NAMESPACE+".domain"]=t.domain,r.attributes[NAMESPACE+".valid_to"]=t.valid_to,r.attributes[NAMESPACE+".issuer"]=t.issuer,r.attributes[NAMESPACE+".expirationDate"]=t.expirationDate,r.attributes[NAMESPACE+".expirationDateUTC"]=t.expirationDateUTC,r.attributes[NAMESPACE+".expirationDateUnix"]=t.expirationDateUnix,r.attributes[NAMESPACE+".state"]=t.state,r.attributes[NAMESPACE+".location"]=$env.LOCATION,t.error?(r.attributes[NAMESPACE+".error"]=!0,r.attributes[NAMESPACE+".errorMessage"]=t.error):(r.attributes[NAMESPACE+".error"]=!1,r.attributes[NAMESPACE+".errorMessage"]=""),r});!0!==await sendDataToNewRelic([{common:s,metrics:t}])&&(scriptErrors.push["Metric post to New Relic API failed for batch "+r],console.log("NR Post failed"))});let s=0;t.forEach(t=>{t.state&&(s+=1)}),setAttribute("completedTargets",s),s<r&&scriptErrors.push("Not all targets were processed"),console.log("-----------------------"),console.log("Expected targets: "+t.length),console.log("Completed targets: "+s),console.log("Script errors: "+scriptErrors.length),console.log("Warnings: "+warningErrors.length),console.log("Critical: "+criticalErrors.length),console.log("-----------------------");e=[];setAttribute("scriptErrors",scriptErrors.length),0<scriptErrors.length&&(setAttribute("scriptErrorMsg",scriptErrors.join("|")),console.log("Script errors:",JSON.stringify(scriptErrors)),e.push("SSL checker script error or some targets are in ERROR state")),setAttribute("criticalErrors",criticalErrors.length),0<criticalErrors.length&&(setAttribute("criticalErrorsMsg",criticalErrors.map(t=>t.url+":"+t.expirationDaysAway).join("|")),console.log("Critical errors:",JSON.stringify(criticalErrors)),e.push(`${criticalErrors.length} targets are in CRITICAL state (<${CRITICAL_THRESHOLD})`)),setAttribute("warningErrors",warningErrors.length),0<warningErrors.length&&(setAttribute("warningErrorsMsg",warningErrors.map(t=>t.url+":"+t.expirationDaysAway).join("|")),console.log("Warning errors:",JSON.stringify(warningErrors)),e.push(`${warningErrors.length} targets are in WARNING state (<${WARNING_THRESHOLD})`)),setAttribute("scriptCompleted","COMPLETE"),0<e.length?(console.log("Asserting failure: ",JSON.stringify(e)),assert.fail(e.join("|"))):assert.ok("All targets passed checks"),console.log("---END---")}run();
/*
* Utils and common settings
*/

const moment = require("moment")
let assert = require('assert')

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

got = require('got')

RUNNING_LOCALLY=false;
const IS_LOCAL_ENV = typeof $http === 'undefined';
if (IS_LOCAL_ENV) {  
  RUNNING_LOCALLY=true
  var $http=require('got');
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
          console.log("Request error:",error)
          console.log("Response:",response)
          console.log("Body:",body)
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
      headers :{
          "Api-Key": INSERT_KEY
      },
      body: JSON.stringify(data)
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

/* 
* Chunk array 
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
* Flattens an array
*/
function flat(arr, depth = 1) {
  return arr.reduce(function (flat, toFlatten) {
    return flat.concat((Array.isArray(toFlatten) && (depth>1)) ? flat(toFlatten, depth-1) : toFlatten);
  }, []);
};


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

