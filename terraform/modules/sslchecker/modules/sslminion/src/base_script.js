/*
* ----------------------------------------------------------------------------------
*/
const tls = require('tls');

const starttime= Date.now()
let socketErrorTriggered=false;
const getSSLExpiration = function(connectionConfig,success,fail) {
    return new Promise((resolve, reject) => {
        const sd = tls.connect(connectionConfig.port,connectionConfig.host, {servername: connectionConfig.domain, rejectUnauthorized: connectionConfig.rejectUnauthorized,}, () => {
            const certDetails = sd.getPeerCertificate(true);

            sd.end();
            sd.destroy();
            if(certDetails && certDetails.valid_to) {
                let certData={ 
                    valid_to: certDetails.valid_to,
                    issuer: (certDetails.issuer && certDetails.issuer.O) ? certDetails.issuer.O : "Unkown",
                    subjectaltname: certDetails.subjectaltname
                }      
               // console.log(`${connectionConfig.host} ${connectionConfig.domain} data:`,certData)
                resolve(success(certData))
            } else {
                reject(fail(`Expiration date missing`))
            }

        });
        sd.setTimeout(connectionConfig.timeout);
        sd.on('timeout', () => {
          sd.end();
          sd.destroy();
          reject(fail(`Error timeout to ${connectionConfig.host}:${connectionConfig.domain}`));
        });
        sd.on('error', function (err) {
          socketErrorTriggered=true;
          reject(fail(`Socket error ${connectionConfig.host}:${connectionConfig.domain} ${err.code? '['+err.code+']' : ''}`));
        });
    })
}

async function run() {

    const sourceData = await getTargets();

    const targets = flat(sourceData.map((x) => {
        const name = x.name || x.domain;

        //if config contains a hosts array then we run a test for each
        if (x.hosts && x.hosts.length) {
            return x.hosts.map((y) => ({
                name: `${y} | ${name}`,
                domain: x.domain,
                host: y,
                url: `https://${y}`,
                timeout: x.timeout ? x.timeout : DEFAULT_TIMEOUT,
                allowUnauthorized: x.allowUnauthorized
            }))
        } else {
            return {
                name: name,
                domain: x.domain,
                host: x.domain,
                url: `https://${x.domain}`,
                timeout: x.timeout ? x.timeout : DEFAULT_TIMEOUT,
                allowUnauthorized: x.allowUnauthorized
            }
        }
    }));
    
    let expectedTargets=targets.length
    setAttribute("expectedTargets",expectedTargets)

    let batches=chunk_arr(targets,BATCH_SIZE)

    await asyncForEach(batches,async (batch,batchIdx)=>{
        let promises=[]

        batch.forEach((target)=>{
            let connectionConfig = {
                host: target.host,
                port: 443,
                domain: target.domain,
                timeout: target.timeout,
                rejectUnauthorized: target.allowUnauthorized === undefined ? true : target.allowUnauthorized === true ? false : true // allow domain's to be self cert: the server certificate is verified against the list of supplied CAs. An 'error' event is emitted if verification fails; err.code contains the OpenSSL error code. Default: false, will be checked). https://nodejs.org/docs/latest/api/tls.html#tlssocketrenegotiateoptions-callback 
            }
            promises.push(getSSLExpiration(connectionConfig,
                (certData)=>{
                    let expirationDate = new Date(certData.valid_to)
                    let expirationMoment=moment(expirationDate)
                    let nowMoment=moment()
                    target.valid_to = certData.valid_to             
                    target.issuer = certData.issuer              
                    target.expirationDate=expirationMoment.format('YYYY-MM-DD HH:mm:ss Z')
                    target.expirationDateUTC=expirationMoment.utc().format('YYYY-MM-DD HH:mm:ss')
                    target.expirationDateUnix=expirationMoment.valueOf()
                    target.expirationDaysAway = Math.floor(moment.duration(expirationMoment.diff(nowMoment)).asDays())
                    target.state="OK"

                    if(target.expirationDaysAway <= 0 ) {
                        target.state="OVERDUE"
                        criticalErrors.push(target)
                    } else if(target.expirationDaysAway <= CRITICAL_THRESHOLD) {
                        target.state="CRITICAL"
                        criticalErrors.push(target)
                    } else if (target.expirationDaysAway <= WARNING_THRESHOLD) {
                        target.state="WARNING"
                        warningErrors.push(target)
                    }
                },
                (error)=>{
                    target.error=error
                    target.state="ERROR"
                    scriptErrors.push(`Target '${target.name}' failed cert info lookup: ${target.error}`)
                }
            ))
        })
    
        await allSettled(promises)

        //Construct metric payload
        let commonMetricBlock={"attributes": {}}
        commonMetricBlock.attributes[`${NAMESPACE}.monitorName`]=MONITOR_NAME
        commonMetricBlock.attributes[`tool`]=NAMESPACE 

        let unixTimeNow=Math.round(Date.now()/1000)
        let metricsInnerPayload=batch.map((target)=>{
            let metricPayload =  {
                name: `${NAMESPACE}.days`,
                type: "gauge",
                value: target.expirationDaysAway ? target.expirationDaysAway : 0,
                timestamp: unixTimeNow,
                attributes: {}
            }
            metricPayload.attributes[`${NAMESPACE}.name`]=target.name
            metricPayload.attributes[`${NAMESPACE}.url`]=target.url
            metricPayload.attributes[`${NAMESPACE}.host`]=target.host
            metricPayload.attributes[`${NAMESPACE}.domain`]=target.domain
            metricPayload.attributes[`${NAMESPACE}.valid_to`]=target.valid_to
            metricPayload.attributes[`${NAMESPACE}.issuer`]=target.issuer
            metricPayload.attributes[`${NAMESPACE}.expirationDate`]=target.expirationDate
            metricPayload.attributes[`${NAMESPACE}.expirationDateUTC`]=target.expirationDateUTC
            metricPayload.attributes[`${NAMESPACE}.expirationDateUnix`]=target.expirationDateUnix
            metricPayload.attributes[`${NAMESPACE}.state`]=target.state
            metricPayload.attributes[`${NAMESPACE}.location`]=$env.LOCATION
            if(target.error) {
                metricPayload.attributes[`${NAMESPACE}.error`]=true
                metricPayload.attributes[`${NAMESPACE}.errorMessage`]=target.error
            } else {
                metricPayload.attributes[`${NAMESPACE}.error`]=false
                metricPayload.attributes[`${NAMESPACE}.errorMessage`]=""
            }
            return metricPayload
        })

        let metricsPayLoad=[{ 
            "common" : commonMetricBlock,
            "metrics": metricsInnerPayload
        }]

        let NRPostStatus = await sendDataToNewRelic(metricsPayLoad)
        if( NRPostStatus === true ){
           // console.log("NR Post successful")   
        } else {
            scriptErrors.push[`Metric post to New Relic API failed for batch ${batchIdx}`]
            console.log("NR Post failed")   
        }
    })


    /* synthetic check custom data */

    let completedTargets=0
    targets.forEach((target)=>{if(target.state) {
        completedTargets=completedTargets+1
    }})
    setAttribute("completedTargets",completedTargets)

    if(completedTargets < expectedTargets) {
        scriptErrors.push("Not all targets were processed")
        //Note if the script is curtailed then this value might not be set, we can look for that in a dash or alert
    }

    console.log("-----------------------")
    console.log(`Expected targets: ${targets.length}`)
    console.log(`Completed targets: ${completedTargets}`)
    console.log(`Script errors: ${scriptErrors.length}`)
    console.log(`Warnings: ${warningErrors.length}`)
    console.log(`Critical: ${criticalErrors.length}`)
    console.log("-----------------------")
    console.log(`Duration:`,Date.now()-starttime)

    let assertMessage=[]
    setAttribute("scriptErrors",scriptErrors.length)
    if(scriptErrors.length > 0){
        setAttribute("scriptErrorMsg",scriptErrors.join('|'))
        console.log("Script errors:",JSON.stringify(scriptErrors))
        if(socketErrorTriggered) {
            console.log("TIP: Some domains caused a socket error. You may need to consider ignoring authorization, e.g. for self signed certs. This can be configured by providing 'allowUnauthorized:true' option for the target.")
        }
        assertMessage.push("SSL checker script error or some targets are in ERROR state")
    }
    setAttribute("criticalErrors",criticalErrors.length)
    if(criticalErrors.length > 0){
        setAttribute("criticalErrorsMsg",criticalErrors.map((err)=>{return `${err.url}:${err.expirationDaysAway}`}).join('|'))
        console.log("Critical errors:",JSON.stringify(criticalErrors))
        assertMessage.push(`${criticalErrors.length} targets are in CRITICAL state (<${CRITICAL_THRESHOLD})`)
    }
    setAttribute("warningErrors",warningErrors.length)
    if(warningErrors.length > 0){
        setAttribute("warningErrorsMsg",warningErrors.map((err)=>{return `${err.url}:${err.expirationDaysAway}`}).join('|'))
        console.log("Warning errors:",JSON.stringify(warningErrors))
        assertMessage.push(`${warningErrors.length} targets are in WARNING state (<${WARNING_THRESHOLD})`)
    }

    /* Assert failures */
    setAttribute("scriptCompleted","COMPLETE")
    if(assertMessage.length > 0) {
        console.log("Asserting failure: ",JSON.stringify(assertMessage))
        assert.fail(assertMessage.join("|"))
    } else {
        assert.ok("All targets passed checks") 
    }
    
    console.log("---END---")

}

run()
