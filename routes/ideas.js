var express = require('express');
var bodyParser = require('body-parser')
const rp = require('request-promise');
var router = express.Router();
const http = require('http');
const https = require('https');
const axios = require('axios');
const { App, LogLevel } = require("@slack/bolt");

router.get('/', function (req, res, next) {    
    res.send('Successfully connected to ideas');
});

const app = new App({
  token: process.env.TOKEN,
  signingSecret: process.env.SIGNING_TOKEN,
  // LogLevel can be imported and used to make debugging simpler
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


/**** orderCafeteriaHandler handler function ***/
function orderCafeteriaHandler(req,res,next){	
	try {	 
	   // Call the chat.postMessage method using the built-in WebClient
	    const result = app.client.chat.postMessage({
	      // The token you used to initialize your app
	      token: process.env.TOKEN,
	      channel:process.env.ChannelId,	  
	      text:'',	  		 
	      attachments:'[{"color": "#f2c744","blocks":[{"type": "section","text": {"type": "mrkdwn","text": "*Order Food Online from the Rio 2 Cafeteria*"}},{"type": "actions","elements": [{"type": "button","text": {"type": "plain_text","emoji": true,"text": "Order Food"},"url": "https://orders.freedomfinancialcafe.com","style": "primary","value": "click_do_nothing"}]}]}]', 
	    });

	    // Print result, which includes information about the message (like TS)
	    //console.log(result);
		return res.json({});
	  }
	  catch (error) {
	    return res.json({
			fulfillmentText: 'Could not get results at this time',
			source: 'orderCafeteria'
		})
	  }
}

/*** help Handler functions **/
function helpHandler(req,res,next){
	try{
	     const result = app.client.chat.postMessage({
	      // The token you used to initialize your app
	      token: process.env.TOKEN,
	      channel: process.env.ChannelId,	  
	      text:'HELP...',	  		 
	      attachments:'[{"color": "#3AA3E3","attachment_type": "default","text":"*Order Food Rio 1 Cafeteria*\nType any of the following:\nfood\nhungry\norder food\norder food cafeteria\n\n*FDR Intake Requests*\nType any of the following:\nfdr intake\nintake\n\n*View Franklin Statistics and Metrics*\nType: stats\n\n*Submit an idea*\nType: bright idea\n\n*View My Asigned JIRA Tasks*\nType:\nmy tasks\n\n*Project Status*\nType: status of [any part of the project title]\n\n*Status of All Projects*\nType any of the following:\ntop 10\nall projects\njira project status\ntop it projects\n\n*People Lookup*\nType: who is first lastname\nwho is lastname\n\n*Salesforce Knowledge Search*\nType any of the following:\n sf\nsf [key words to search for]\n\n*Search Knowledge Articles*\nType any of the following:\nsearch for [some key words to search for]\nsearch [key words to search for]\n\n*ServiceNow Knowledge Search (same search used in SNOW)*\nType any of the following:\nknowledge [keywords to search]\nkb [keywords to search]\nkb\n\n*Create Idea*\nType the following:\n*Updated*\n/idea\n\n*ServiceNow* Type the following:\n servicenow\nservicenow stats\n\n*Twilio SMS delivered today, by hour* you can type the following:\nTwilio\nsms stats\nGive me the twilio stats\n\n*Weather*\nTempe weather\nSan Mateo weather\n\n*For weather you can type the following*: \nweather in [city]\ncurrent weather\nwhat is weather in tempe, az\n\n*CCP Network Monitor Map* by typing the following:\nccp network map\nproduction alarms\nNetwork status\n\n*Okta status* type the following:\nokta\n\n*View the uncleared payments process* type:\nuncleared\nuncleared payments\n\n*Jokes*:\nType any of the following:\njoke\ndo you know any jokes\ntell me a joke\nj2 - IT jokes\nlj - lawyer jokes\n\n*Get Stock Quotes*\nType any of the following:\nquote: [stock symbol here]\nstock: [stock symbol here]\n\n*Current Time - Multiple time zones*:\nType any of the following:\ntime now\ntime\ndate\n\n*Add word to FFN Dictionary*\nType the following:\n\ addword\nOr use search below and click the *Add New Word* button to add new word.\n\n*FFN Dictionary Search*\nType any of the following:\ndefine: [word or acronym] or define [word or acronym]\nlookup: [word or acronym] or lookup [word or acronym]\nmeaning: [word or acronym] or meaning [word or acronym]\nwhat is: [word or acronym] or what is [word or acronym]\n\n*List All Entries in FFN Dictionary*\nType any of the following\nall acronyms\nall words\nshow dictionary\n\n*eBook Search*:\nType any of the following:\nbook: [any part of title of book or an author]\nsearch book: [any part of title of book or an author]\n","fallback": "detailed help info"}]',
		 
	    });
	}
	catch(error){
		 return res.json({
			fulfillmentText: 'Could not get results at this time',
			source: 'HELP'
		})
	}
}
    
/*** Jira NewIdea  Handler Functions ***/
function addNewIdeaWithName(req, res, next) {
	try {	 
	   // Call the chat.postMessage method using the built-in WebClient
	    const result = app.client.chat.postMessage({
	      // The token you used to initialize your app
	      token: process.env.TOKEN,
	      channel: process.env.ChannelId,	  
	      text:'Note: Idea has changed...',	  		 
	      attachments:'[{"color": "#3AA3E3","attachment_type": "default","text":"Idea has been replaced with a slash command and is accessable by typing\n/idea","fallback": "Idea has been replaced with a slash command and is accessable by typing\n/idea"}]',
		 
	    });
    
	    //console.log(result);
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
