var express = require('express');
var bodyParser = require('body-parser')
const rp = require('request-promise');
var router = express.Router();
const http = require('http');
const https = require('https');


router.get('/', function (req, res, next) {    
    res.send('Successfully connected to ideas');
});

const app = new App({
  token: process.env.TOKEN,
  signingSecret: process.env.SIGNING_TOKEN,  
  logLevel: LogLevel.DEBUG
});


router.post('/', function (req, res, next) {
 var intentName = req.body.queryResult.intent.displayName;
    console.log(intentName);
     console.log('hello!');	
    try {
        switch (intentName) {	
	     case "JIRA-NewIdea":                
                addNewIdeaWithName(req, res, next);
                break;		
	     case "BuzzWord":
                // corporate buzz word generator
                buzzWordHandler(req, res, next);
                break;
	    case "Help":                
                helpHandler(req, res, next);
                break;
	    case "orderCafeteria":
                orderCafeteriaHandler(req, res, next);
                break;		
	    case "MathFacts":
                mathFactsHandler(req, res, next);
                break;
		default:
               // logError("Unable to match intent. Received: " + intentName, req.body.originalDetectIntentRequest.payload.data.event.user, 'UNKNOWN', 'IDEA POST CALL');
                res.send("Your request wasn't found and has been logged. Thank you!");
                break;
		  }
	} catch (err) {
        console.log(err);
        res.send(err);
    }
});


/*** Jira NewIdea  Handler Functions ***/
function addNewIdeaWithName(req, res, next) {
	try {	 
	   // Call the chat.postMessage method using the built-in WebClient
	    const result = app.client.chat.postMessage({
	      // The token you used to initialize your app
	      token: process.env.TOKEN,
	      channel: 'D01ERH0GTBQ',	  
	      text:'Note: Idea has changed...',	  		 
	      attachments:'[{"color": "#3AA3E3","attachment_type": "default","text":"Idea has been replaced with a slash command and is accessable by typing\n/idea","fallback": "Idea has been replaced with a slash command and is accessable by typing\n/idea"}]',
		
	    });
		return res.json({});
	  }
	  catch (error) {
	    return res.json({
			fulfillmentText: 'Could not get results at this time',
			source: 'JIRA-NewIdea'
		})
	  }
}
     
/*** buzzword handler function ***/
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
   
/**** Maths Facts Handler function ***/

function mathFactsHandler(req, res, next) {	
	http.get(
		'http://numbersapi.com/random/math',
		responseFromAPI => {
			let completeResponse = ''
			responseFromAPI.on('data', chunk => {
				completeResponse += chunk
			})
			responseFromAPI.on('end', () => {
				
				console.log(completeResponse);
				
				//const mymath = JSON.parse(completeResponse.text);
				
				const mymath = completeResponse;

				let dataToSend ;
				dataToSend = `The Question is ${mymath}`

				return res.json({
					fulfillmentText: dataToSend,
					source: 'MathFacts'
				})
			})
		},
		error => {
			return res.json({
				fulfillmentText: 'Could not get results at this time',
				source: 'MathFacts'
			})
		}
	)
		
}


module.exports = router;
