
const METRIC_API = "https://metric-api.newrelic.com/metric/v1" // US data center accounts
//const METRIC_API = "metric-api.eu.newrelic.com" // EU data center accounts

const CRITICAL_THRESHOLD = 14 // number of days left to trigger critical state
const WARNING_THRESHOLD = 28  // number of days left to trigger warning state

const BATCH_SIZE = 50; // number of checks to run at once
const DEFAULT_TIMEOUT = 5000; //TLS handshake timeout default (can be overdiden in config)

let RUNNING_LOCALLY = false; // for testing purposes


// End header config ----- don not edit below here ---
let tls=require("tls"),starttime=Date.now(),socketErrorTriggered=!1,getSSLExpiration=function(a,i,s){return new Promise((r,e)=>{let o=tls.connect(a.port,a.host,{servername:a.domain,rejectUnauthorized:a.rejectUnauthorized},()=>{var t=o.getPeerCertificate(!0);o.end(),o.destroy(),t&&t.valid_to?(t={valid_to:t.valid_to,issuer:t.issuer&&t.issuer.O?t.issuer.O:"Unkown",subjectaltname:t.subjectaltname},r(i(t))):e(s("Expiration date missing"))});o.setTimeout(a.timeout),o.on("timeout",()=>{o.end(),o.destroy(),e(s(`Error timeout to ${a.host}:`+a.domain))}),o.on("error",function(t){socketErrorTriggered=!0,e(s(`Socket error ${a.host}:${a.domain} `+(t.code?"["+t.code+"]":"")))})})};async function run(){var t=await getTargets(),t=flat(t.map(r=>{let e=r.name||r.domain;return r.hosts&&r.hosts.length?r.hosts.map(t=>({name:t+" | "+e,domain:r.domain,host:t,url:"https://"+t,timeout:r.timeout||DEFAULT_TIMEOUT,allowUnauthorized:r.allowUnauthorized})):{name:e,domain:r.domain,host:r.domain,url:"https://"+r.domain,timeout:r.timeout||DEFAULT_TIMEOUT,allowUnauthorized:r.allowUnauthorized}})),r=t.length,e=(setAttribute("expectedTargets",r),chunk_arr(t,BATCH_SIZE));await asyncForEach(e,async(t,r)=>{let e=[];t.forEach(o=>{var t={host:o.host,port:443,domain:o.domain,timeout:o.timeout,rejectUnauthorized:void 0===o.allowUnauthorized||!0!==o.allowUnauthorized};e.push(getSSLExpiration(t,t=>{var r=new Date(t.valid_to),r=moment(r),e=moment();o.valid_to=t.valid_to,o.issuer=t.issuer,o.expirationDate=r.format("YYYY-MM-DD HH:mm:ss Z"),o.expirationDateUTC=r.utc().format("YYYY-MM-DD HH:mm:ss"),o.expirationDateUnix=r.valueOf(),o.expirationDaysAway=Math.floor(moment.duration(r.diff(e)).asDays()),o.state="OK",o.expirationDaysAway<=0?(o.state="OVERDUE",criticalErrors.push(o)):o.expirationDaysAway<=CRITICAL_THRESHOLD?(o.state="CRITICAL",criticalErrors.push(o)):o.expirationDaysAway<=WARNING_THRESHOLD&&(o.state="WARNING",warningErrors.push(o))},t=>{o.error=t,o.state="ERROR",scriptErrors.push(`Target '${o.name}' failed cert info lookup: `+o.error)}))}),await allSettled(e);var o={attributes:{}};o.attributes[NAMESPACE+".monitorName"]=MONITOR_NAME,o.attributes.tool=NAMESPACE;let a=Math.round(Date.now()/1e3);t=t.map(t=>{var r={name:NAMESPACE+".days",type:"gauge",value:t.expirationDaysAway||0,timestamp:a,attributes:{}};return r.attributes[NAMESPACE+".name"]=t.name,r.attributes[NAMESPACE+".url"]=t.url,r.attributes[NAMESPACE+".host"]=t.host,r.attributes[NAMESPACE+".domain"]=t.domain,r.attributes[NAMESPACE+".valid_to"]=t.valid_to,r.attributes[NAMESPACE+".issuer"]=t.issuer,r.attributes[NAMESPACE+".expirationDate"]=t.expirationDate,r.attributes[NAMESPACE+".expirationDateUTC"]=t.expirationDateUTC,r.attributes[NAMESPACE+".expirationDateUnix"]=t.expirationDateUnix,r.attributes[NAMESPACE+".state"]=t.state,r.attributes[NAMESPACE+".location"]=$env.LOCATION,t.error?(r.attributes[NAMESPACE+".error"]=!0,r.attributes[NAMESPACE+".errorMessage"]=t.error):(r.attributes[NAMESPACE+".error"]=!1,r.attributes[NAMESPACE+".errorMessage"]=""),r});!0!==await sendDataToNewRelic([{common:o,metrics:t}])&&(scriptErrors.push["Metric post to New Relic API failed for batch "+r],console.log("NR Post failed"))});let o=0;t.forEach(t=>{t.state&&(o+=1)}),setAttribute("completedTargets",o),o<r&&scriptErrors.push("Not all targets were processed"),console.log("-----------------------"),console.log("Expected targets: "+t.length),console.log("Completed targets: "+o),console.log("Script errors: "+scriptErrors.length),console.log("Warnings: "+warningErrors.length),console.log("Critical: "+criticalErrors.length),console.log("-----------------------"),console.log("Duration:",Date.now()-starttime);e=[];setAttribute("scriptErrors",scriptErrors.length),0<scriptErrors.length&&(setAttribute("scriptErrorMsg",scriptErrors.join("|")),console.log("Script errors:",JSON.stringify(scriptErrors)),socketErrorTriggered&&console.log("TIP: Some domains caused a socket error. You may need to consider ignoring authorization, e.g. for self signed certs. This can be configured by providing 'allowUnauthorized:true' option for the target."),e.push("SSL checker script error or some targets are in ERROR state")),setAttribute("criticalErrors",criticalErrors.length),0<criticalErrors.length&&(setAttribute("criticalErrorsMsg",criticalErrors.map(t=>t.url+":"+t.expirationDaysAway).join("|")),console.log("Critical errors:",JSON.stringify(criticalErrors)),e.push(`${criticalErrors.length} targets are in CRITICAL state (<${CRITICAL_THRESHOLD})`)),setAttribute("warningErrors",warningErrors.length),0<warningErrors.length&&(setAttribute("warningErrorsMsg",warningErrors.map(t=>t.url+":"+t.expirationDaysAway).join("|")),console.log("Warning errors:",JSON.stringify(warningErrors)),e.push(`${warningErrors.length} targets are in WARNING state (<${WARNING_THRESHOLD})`)),setAttribute("scriptCompleted","COMPLETE"),0<e.length?(console.log("Asserting failure: ",JSON.stringify(e)),assert.fail(e.join("|"))):assert.ok("All targets passed checks"),console.log("---END---")}run();
let moment=require("moment"),assert=require("assert"),scriptErrors=[],criticalErrors=[],warningErrors=[],IS_LOCAL_ENV=(got=require("got"),RUNNING_LOCALLY=!1,void 0===$http);var $http;IS_LOCAL_ENV&&(RUNNING_LOCALLY=!0,$http=require("got"),console.log("Running in local mode"));let setAttribute=function(e,t){RUNNING_LOCALLY?console.log(`[FAUX] Set attribute '${e}' to `+t):$util.insights.set(e,t)},genericServiceCall=function(e,l,s){"timeout"in l||(l.timeout=DEFAULT_TIMEOUT);let i="number"==typeof e?[e]:e;return new Promise((o,n)=>{$http(l,function(e,t,r){e?(console.log("Request error:",e),console.log("Response:",t),console.log("Body:",r),n(`Connection error on url '${l.url}'`)):i.includes(t.statusCode)?o(s(r,t,e)):(r=`Expected [${i}] response code but got '${t.statusCode}' from url '${l.url}'`,n(r))})})},sendDataToNewRelic=async e=>{e={url:METRIC_API,method:"POST",headers:{"Api-Key":INSERT_KEY},body:JSON.stringify(e)};return genericServiceCall([200,202],e,(e,t,r)=>!r||(console.log(`NR Post failed : ${r} `),!1))};async function asyncForEach(t,r){for(let e=0;e<t.length;e++)await r(t[e],e,t)}function chunk_arr(e,t){return e.reduce((e,t,r)=>{r=Math.floor(r/2);return e[r]=[].concat(e[r]||[],t),e},[])}function flat(e,r=1){return e.reduce(function(e,t){return e.concat(Array.isArray(t)&&1<r?e(t,r-1):t)},[])}let allSettled=e=>Promise.all(e.map(e=>e.then(e=>({status:"fulfilled",value:e})).catch(e=>({status:"rejected",reason:e}))));
