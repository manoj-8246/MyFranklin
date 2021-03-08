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
	     case "IncidentMgt":
                // Returns incident management info
                incidentMgtHandler(req, res, next);
                break;
	    case "J2":
                joke2Handler(req, res, next);
                break;		
	    case "lawyerJokes":
                // random lawyer joke
                lawyerJokesHandler(req, res, next);
                break;	
	     case "PExcuses":
                // speeding excuses
                speedingExcuseHandler(req, res, next);
                break;
	    case "Excuses":
                // Why I can't go to work... more excuses
                excuseHandler(req, res, next);
                break;	
	    case "Poem":
                // random poem
                poemHandler(req, res, next);
                break;	
	    case "mytest":
                mytestHandler(req, res, next);
                break;		
	     case "MathFacts":
                mathFactsHandler(req, res, next);
                break;
	    case "changemgt":
                changeMgtHandler(req, res, next);
                break;		
	   case "gant":
                gantHandler(req, res, next);
                break;
	   case "gchart":
                gchartHandler(req, res, next);
                break;	
	    case "GenesysSalesforce":
                genesysSalesforceHandler(req, res, next);
                break;	
	    case "HowFranklinWorks":
                howFranklinWorksHandler(req, res, next);
                break;	
	   case "NetworkState":
		networkStateHandler(req, res, next);
		break;	
	   case "okta":
		oktaHandler(req, res, next);
		break;
	   case "roomLocation":
		roomLocationHandler(req, res, next);
		break;
	  case "Sacremento":
		sacramentoHandler(req, res, next);
		break;	
          case "sanmateoweather":
		sanmateoWeatherHandler(req, res, next);
		break;	
	  case "TempeWeather":
		tempeWeatherHandler(req, res, next);
		break;
	  case "TwilioDomoReports":
		twilioDomoReports(req, res, next);
		break;	
	  case "UnclearedPaymentsProcess":
		unclearedPmtsProcessHandler(req, res, next);
		break;	
	  case "brightIdea":
		brightIdeaHandler(req, res, next);
		break;
	  case "fdrSalesIntake":
		fdrSalesIntakeHandler(req, res, next);
		break;	
	  case "todoTest":
                todoTestHandler(req, res, next);
                break;
	 case "franklinStatistics":
                franklinStatsHandler(req, res, next);
                break;	
	 case "managerReport":
                managerReportHandler(req, res, next);
                break;
	 case "taskManager":
                taskManagerHandler(req, res, next);
                break;	
	  case "actionExample":
                actionExampleHandler(req, res, next);
                break;
	  case "JIRA-SpecProj":
		jiraSearchITProj(req, res, next);
		break;
	   case "MyTask":
                // Top IT Projects
                jiraMyTasksHandler(req, res, next);
                break;	
	  case "StockQuote":
                stockQuoteHandler(req, res, next);
                break;	
	  case "CalculateGrossIncome":
                calculateGrossIncome(req, res, next);
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

				//let dataToSend ;
				//dataToSend = `Cool Corporate Buzz Word: ${msg.phrase}`
				dataToSend='Hello :slightly_smiling_face:'				 
				 
				console.log('data come here!');
				
				
				return res.json({
					fulfillmentText: dataToSend,
					attachment:[{color: '#2c963f'}]
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
