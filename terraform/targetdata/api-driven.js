/*
* Example of API driven getTargets()
*
* Note how we add to the scriptErrors array if the API fetch fails!
*/

const getTargets=async ()=>{

    let request = {
        url: "https://run.mocky.io/v3/a4963a74-9b5d-4b1c-9175-fc064ab9c4eb",
        method: 'GET'
    }

    try {
        let data = await genericServiceCall([200],request,(body,response,error)=>{
            if(error) {
                console.log(`API Target collection failed : ${error}`)
                scriptErrors.push(`API Target collection failed`)
                return false
            } else {
                try {
                    let jsonData=JSON.parse(body)
                    return jsonData
                } catch(error) {
                    console.log(`API Target collection failed : ${error}`)
                    scriptErrors.push(`API Target collection failed JSON parse`)
                    return false
                }
            }
        })
        if(data) {
            return data
        } else {
            return []
        } 
    } catch(e) {
        scriptErrors.push(`Target collector failed: ${e}`)
        return []
    }
}


