const express = require('express')
const http = require('http')
const https = require('https')

var router = express.Router();

router.get('/', function (req, res, next) {    
    res.send('Router is come here!');
});

router.post('/',(req, res,next) => {    
   
    var intentName = req.body.queryResult.intent.displayName;
  
    console.log(intentName);
    try {
		  switch (intentName) {			
			case "BuzzWord":
                // corporate buzz word generator
                buzzWordHandler(req, res, next);
                break;	           			
			default:
                logError("Unable to match intent. Received: " + intentName, req.body.originalDetectIntentRequest.payload.data.event.user, 'UNKNOWN', 'IDEA POST CALL');
                res.send("Your request wasn't found and has been logged. Thank you!");
                break;
		  }
	} catch (err) {
        console.log(err);
        res.send(err);
    }
});

function buzzWordHandler(req, res, next) {	
	https.get(
		'https://corporatebs-generator.sameerkumar.website/',
		responseFromAPI => {
			let completeResponse = ''
			responseFromAPI.on('data', chunk => {
				completeResponse += chunk
			})
			responseFromAPI.on('end', () => {
				
				console.log(completeResponse);
				
				//const mymath = JSON.parse(completeResponse.text);
				
				const msg = JSON.parse(completeResponse);

				let dataToSend ;
				dataToSend = `Cool Corporate Buzz Word: ${msg.phrase}`
				return res.json({
					fulfillmentText: dataToSend,
					source: 'BuzzWord'
				})
			})
		},
		error => {
			return res.json({
				fulfillmentText: 'Could not get results at this time',
				source: 'BuzzWord'
			})
		}
	)
		
}

module.exports = router;
