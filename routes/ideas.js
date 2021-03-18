var express = require('express');
var bodyParser = require('body-parser')
const rp = require('request-promise');
var router = express.Router();
const http = require('http');
const https = require('https');
const axios = require('axios');
const { App, LogLevel } = require("@slack/bolt");
var mysqlPool = require('../utils/database');

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
	case "listAllFFNDictionary":
                listAllFFNDictionaryHandler(req, res, next);
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

/*** calculate gross income handler function ***/

function calculateGrossIncome(req, res, next){

    var netIncomeDesired = req.body.queryResult.parameters.netIncomeSeeking;
    var netIncomeValue = parseFloat(netIncomeDesired);
    // lets calculate married file jointly first 
    var netIncomeMarriedFileJoint = 0.0;
    var netIncomeSingle = 0.0;
    var marriedTaxes = 0.0;
    var singleTaxes = 0.0;
    var marriedTaxRate = 0.0;
    var singleTaxRate = 0.0;

    if (netIncomeValue > 0 && netIncomeValue <= 19051) {
        var tempAmount = netIncomeValue / .90;
        if (tempAmount > 19050) {
            netIncomeMarriedFileJoint = ((netIncomeValue - 17145) / .88) + 19050;
        } else {
            netIncomeMarriedFileJoint = tempAmount;
        }
    } else if (netIncomeValue > 19051 && netIncomeValue <= 77401) {
        netIncomeMarriedFileJoint = ((netIncomeValue - 17145) / .88) + 19050;
    } else if (netIncomeValue > 77401 && netIncomeValue <= 165001) {
        netIncomeMarriedFileJoint = ((netIncomeValue - 68493) / .78) + 77400;
    } else if (netIncomeValue > 165001 && netIncomeValue <= 315001) {
        netIncomeMarriedFileJoint = ((netIncomeValue - 136821) / .76) + 165000;
    } else if (netIncomeValue > 315001 && netIncomeValue <= 400001) {
        netIncomeMarriedFileJoint = ((netIncomeValue - 250821) / .68) + 315000;
    } else if (netIncomeValue > 400001 && netIncomeValue <= 600001) {
        netIncomeMarriedFileJoint = ((netIncomeValue - 308621.00) / .65) + 400000;
    } else if (netIncomeValue > 600001) {
        netIncomeMarriedFileJoint = ((netIncomeValue - 438621.00) / .63) + 600000;
    }

    // filing single federal tax return calculations 
    if (netIncomeValue > 0 && netIncomeValue <= 9526) {
        var tempAmount = netIncomeValue / .90;
        if (tempAmount > 9525) {
            netIncomeSingle = ((netIncomeValue - 8572.50) / .88) + 9525;
        } else {
            netIncomeSingle = tempAmount;
        }
    } else if (netIncomeValue > 9526 && netIncomeValue <= 38700) {
        netIncomeSingle = ((netIncomeValue - 8572.50) / .88) + 9525;
    } else if (netIncomeValue > 38701 && netIncomeValue < 82500) {
        netIncomeSingle = ((netIncomeValue - 34246.50) / .78) + 38700;
    } else if (netIncomeValue > 82501 && netIncomeValue < 157500) {
        var tempVal = ((netIncomeValue - 68410.50) / .76) + 82500;
        if (tempVal > 157500) {
            netIncomeSingle = ((netIncomeValue - 125410.50) / .68) + 157500;
        } else {
            netIncomeSingle = tempVal;
        }
    } else if (netIncomeValue > 157501 && netIncomeValue <= 200000) {
        var tempVal = ((netIncomeValue - 125410.50) / .68) + 157500;
        if (tempVal > 200000) {
            netIncomeSingle = ((netIncomeValue - 186400) / .65) + 200000;
        } else {
            netIncomeSingle = tempVal;
        }
    } else if (netIncomeValue > 200001 && netIncomeValue <= 500000) {
        var tempVal = ((netIncomeValue - 186400) / .65) + 200000;
        if (tempVal > 500000) {
            netIncomeSingle = ((netIncomeValue - 349310.50) / .63) + 500000;
        } else {
            netIncomeSingle = tempVal;
        }
    } else if (netIncomeValue > 500001) {
        netIncomeSingle = ((netIncomeValue - 349310.50) / .63) + 500000;
    }

    singleTaxes = netIncomeSingle - netIncomeValue;
    singleTaxRate = (singleTaxes / netIncomeSingle) * 100;
    marriedTaxes = netIncomeMarriedFileJoint - netIncomeValue;
    marriedTaxRate = (marriedTaxes / netIncomeSingle) * 100;
	
try{
	const result = app.client.chat.postMessage({
	token: process.env.TOKEN,
	channel: req.body.originalDetectIntentRequest.payload.data.event.channel,
	text: "Required income to net a specific income.",
	attachments:'[{"color": "#3AA3E3","blocks":[{"type": "section","text": {"type": "mrkdwn","text": "Married: Gross Income :'+  netIncomeValue.toFixed(2).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,") +'"}},{"type": "section","text": {"type": "mrkdwn","text": "Married Fed Tax / Tax Rate % :'+  (netIncomeMarriedFileJoint - netIncomeValue).toFixed(2).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,") + " / " + marriedTaxRate.toFixed(2) +'%"}},{"type": "section","text": {"type": "mrkdwn","text": "Single Gross Income :'+  netIncomeSingle.toFixed(2).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,") +'"}},{"type": "section","text": {"type": "mrkdwn","text": "Single Fed Tax / Tax Rate %:'+  (netIncomeSingle - netIncomeValue).toFixed(2).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,") + " / " + singleTaxRate.toFixed(2) +'%"}}]}]',
    });
	console.log(result);
    }catch (error) {
    return res.json({
	fulfillmentText: 'Could not get results at this time',
	source: 'stockQuoteHandler'
	})
  }
}

/*** Stock Quote Handler function ***/
function stockQuoteHandler(req, res, next){
   var stockSymbol = '';
    if (req.body.queryResult.queryText) {
        stockSymbol = req.body.queryResult.queryText.toLowerCase().replace(/quote:/g, "").replace(/stock:/g, "").trim();
    }

    var urlYahooFinance = "https://finance.yahoo.com/quote/" + stockSymbol + "?p=" + stockSymbol + "&.tsrc=fin-srch";
  
	
 try{
	const result = app.client.chat.postMessage({
	token: process.env.TOKEN,
	channel:req.body.originalDetectIntentRequest.payload.data.event.channel,
	text: "Stock Quote",
	attachments:'[{"color": "#3AA3E3","blocks":[{"type": "section","text": {"type": "mrkdwn","text": "Stock Symbol: '+ stockSymbol +'"}},{"type": "actions","elements": [{"type": "button","text": {"type": "plain_text","text": "Yahoo Finance"},"style": "primary","url":"' + urlYahooFinance + '"}]}]}]',
    });
	console.log(result);
    }catch (error) {
    return res.json({
	fulfillmentText: 'Could not get results at this time',
	source: 'stockQuoteHandler'
	})
  }	
}


/*** My Task Handler Function ***/
function jiraMyTasksHandler(req, res, next){

 try{
	const result = app.client.chat.postMessage({
	token: process.env.TOKEN,
	channel:req.body.originalDetectIntentRequest.payload.data.event.channel,
	text: "Fetching My JIRA Tasks ...",
	attachments:'[{"color": "#3AA3E3","blocks": [{"type": "section","text": {"type": "mrkdwn","text": "Please standby as I fetch your JIRA tasks."}}]}]',
    });
	console.log(result);
    }catch (error) {
    return res.json({
	fulfillmentText: 'Could not get results at this time',
	source: 'jiraMyTasksHandler'
	})
  }
}

/**** JIRA Spec Proj ***/
function jiraSearchITProj(req, res, next){

try{
	const result = app.client.chat.postMessage({
	token: process.env.TOKEN,
	channel:req.body.originalDetectIntentRequest.payload.data.event.channel,
	text: "IT JIRA Projects ...",
	attachments:'[{"color": "#3AA3E3","blocks": [{"type": "section","text": {"type": "mrkdwn","text": "Processing your search for N.A ."}}]}]',
	});
	console.log(result);
    }catch (error) {
    return res.json({
	fulfillmentText: 'Could not get results at this time',
	source: 'jiraSearchITProj'
	})
  }
}


/*** ActionExample Handler Function ***/
function  actionExampleHandler(req, res, next){
	
 try{
	const result = app.client.chat.postMessage({
	token: process.env.TOKEN,
	channel:req.body.originalDetectIntentRequest.payload.data.event.channel,
	text: "",
	attachments:'[{"blocks": [{"type": "section","text": {"type": "mrkdwn","text": "You have a new request:\n*<fakeLink.toEmployeeProfile.com|Fred Enriquez - New device request>*"}},{"type": "section","fields":[{"type": "mrkdwn", "text": "*Type:*\nComputer (laptop)"},{"type": "mrkdwn","text": "*When:*\nSubmitted Aut 10"},{"type": "mrkdwn","text": "*Last Update:*\nMar 10, 2015 (3 years, 5 months)"},{"type": "mrkdwn","text": "*Reason:*\nAll vowel keys aren\'t working."},{"type": "mrkdwn","text": "*Specs:*\n\ Cheetah Pro 15 - Fast, really fast"}]},{"type": "actions","elements":[{"type": "button","text": {"type": "plain_text","emoji": true,"text": "Approve"},"style": "primary","value": "click_me_123"},{"type": "button","text": {"type": "plain_text","emoji": true,"text": "Deny"},"style": "danger","value": "click_me_123"}]}]}]',
	});
	console.log(result);
    }catch (error) {
    return res.json({
	fulfillmentText: 'Could not get results at this time',
	source: 'actionExampleHandler'
	})
  }
}


/*** Task Manager Handler Function ***/
function taskManagerHandler(req, res, next){
try{
	const result = app.client.chat.postMessage({
	token: process.env.TOKEN,
	channel:req.body.originalDetectIntentRequest.payload.data.event.channel,
	text: "",
	attachments:'[{"blocks":[{"type":"section","text":{"type":"mrkdwn","text":"*Daily Task Manager*\nUse to manage my daily tasks."}},{"type":"actions","elements":[{"type":"button","text":{"type":"plain_text","text":"Add New Task","emoji":true},"style":"primary","value":"todo_add_new_task"},{"type":"button","text":{"type":"plain_text","text":"View Incomplete Tasks","emoji":true},"style":"primary","value":"todo_view_incompleted_tasks"},{"type":"button","text":{"type":"plain_text","text":"View Completed Tasks","emoji":true},"style":"primary","value":"todo_view_completed_tasks"},{"type":"button","text":{"type":"plain_text","text":"View Tasks Due Today","emoji":true},"style":"primary","value":"todo_tasks_due_today"},{"type":"button","text":{"type":"plain_text","text":"View Tasks Due This Week","emoji":true},"style":"primary","value":"todo_weekly_tasks"}]}]}]',
	});
	console.log(result);
    }catch (error) {
    return res.json({
	fulfillmentText: 'Could not get results at this time',
	source: 'taskManagerHandler'
	})
  }
}

/*** manager Report Handler function ***/
function managerReportHandler(req, res, next){
 try{
	const result = app.client.chat.postMessage({
	token: process.env.TOKEN,
	channel:req.body.originalDetectIntentRequest.payload.data.event.channel,
	text: "",
	attachments:'[{"blocks":[{"type":"section","text":{"type":"mrkdwn","text":"*CREATE TEAM REPORT*\nBy date range by team member"}},{"type":"section","text":{"type":"mrkdwn","text":"Pick team member from list"},"accessory":{"type":"multi_static_select","placeholder":{"type":"plain_text","text":"Select a member","emoji":true},"options":[{"text":{"type":"plain_text","text":"Glenn","emoji":true},"value":"value-0"},{"text":{"type":"plain_text","text":"Jay","emoji":true},"value":"value-1"},{"text":{"type":"plain_text","text":"Robbie","emoji":true},"value":"value-2"},{"text":{"type":"plain_text","text":"Georgina","emoji":true},"value":"value-3"}]}},{"type":"section","text":{"type":"mrkdwn","text":"Pick a start date."},"accessory":{"type":"datepicker","initial_date":"2019-10-03","placeholder":{"type":"plain_text","text":"Select a date","emoji":true}}},{"type":"section","text":{"type":"mrkdwn","text":"Pick an end date."},"accessory":{"type":"datepicker","initial_date":"2019-10-04","placeholder":{"type":"plain_text","text":"Select a date","emoji":true}}},{"type":"section","text":{"type":"mrkdwn","text":"Pick a report template."},"accessory":{"type":"static_select","placeholder":{"type":"plain_text","text":"Select a report","emoji":true},"options":[{"text":{"type":"plain_text","text":"Productivity","emoji":true},"value":"value-0"},{"text":{"type":"plain_text","text":"View closed items","emoji":true},"value":"value-1"},{"text":{"type":"plain_text","text":"View open items","emoji":true},"value":"value-2"},{"text":{"type":"plain_text","text":"Calculate Bonuses","emoji":true},"value":"value-3"},{"text":{"type":"plain_text","text":"FTE Estimate to Execute Plan","emoji":true},"value":"value-4"},{"text":{"type":"plain_text","text":"Distribute Unasigned Work (AI)","emoji":true},"value":"value-5"},{"text":{"type":"plain_text","text":"Leaderboard","emoji":true},"value":"value-6"}]}},{"type":"actions","elements":[{"type":"button","text":{"type":"plain_text","emoji":true,"text":"VIEW REPORT"},"style":"primary","value":"click_view_mgr_report"},{"type":"button","text":{"type":"plain_text","emoji":true,"text":"CANCEL"},"style":"danger","value":"click_do_nothing"}]}]}]',
	});
	console.log(result);
    }catch (error) {
    return res.json({
	fulfillmentText: 'Could not get results at this time',
	source: 'managerReportHandler'
	})
  }
}


/*** franklinStatistics handler function ***/
function franklinStatsHandler(req, res, next){
    
  try{
		const result = app.client.chat.postMessage({
		token: process.env.TOKEN,
		channel:req.body.originalDetectIntentRequest.payload.data.event.channel,
		text: "",
		attachments:'[{"blocks":[{"type":"section","text":{"type":"mrkdwn","text":"Franklin Stats ..."}},{"type":"actions","elements":[{"type":"button","text":{"type":"plain_text","text":"View My Statistics"},"url": "https://storage.googleapis.com/ffn-images/img/frankstats.html","style":"primary"}]}]}]',
	});
	console.log(result);
    }catch (error) {
    return res.json({
	fulfillmentText: 'Could not get results at this time',
	source: 'franklinStatsHandler'
	})
  }
	
	
}



/*** todo test handler function ***/
function  todoTestHandler(req, res, next){

	try{
		const result = app.client.chat.postMessage({
		token: process.env.TOKEN,
		channel:req.body.originalDetectIntentRequest.payload.data.event.channel,
		text: "",
		attachments:'[{"blocks":[{"type":"section","text":{"type":"mrkdwn","text":"To add a new todo item click the button below."}},{"type":"actions","elements":[{"type":"button","text":{"type":"plain_text","text":"Add New Todo"},"style":"primary","value": "clickAddTodo"}]}]}]',
	});
	console.log(result);
    }catch (error) {
    return res.json({
	fulfillmentText: 'Could not get results at this time',
	source: 'todoTestHandler'
	})
  }

}

/*** fdrsales Intake handler function ***/
function fdrSalesIntakeHandler(req, res, next){

	try{
		const result = app.client.chat.postMessage({
		token: process.env.TOKEN,
		channel:req.body.originalDetectIntentRequest.payload.data.event.channel,
		text: "",
		 attachments:'[{"blocks":[{"type":"section","text":{"type":"mrkdwn","text":"FDR Intake ..."}},{"type":"actions","elements":[{"type":"button","text":{"type":"plain_text","text":"Create Request"},"url":"https://docs.google.com/forms/d/e/1FAIpQLSc4ObcOK7a5X-CeTV0MajMHcjbNpDmf1sDIfaFtZhOYqzyj7g/viewform","style":"primary"}]}]}]',	
		});
	console.log(result);
    }catch (error) {
    return res.json({
	fulfillmentText: 'Could not get results at this time',
	source: 'fdrSalesIntakeHandler'
	})
  }

}

/***  Bright Idea Handler function ***/
function brightIdeaHandler(req, res, next){

 try{
		const result = app.client.chat.postMessage({
		token: process.env.TOKEN,
		channel:req.body.originalDetectIntentRequest.payload.data.event.channel,
		text: "",
		 attachments:'[{"blocks":[{"type":"section","text":{"type":"mrkdwn","text":"Brilliant Idea..."}},{"type":"actions","elements":[{"type":"button","text":{"type":"plain_text","text":"Create Idea"},"url":"https://sites.google.com/freedomdebtrelief.com/ffn-bright-ideas/home","style":"primary"}]}]}]',	
		});
	console.log(result);
    }catch (error) {
    return res.json({
	fulfillmentText: 'Could not get results at this time',
	source: 'brightIdeaHandler'
	})
  }
	
}

/*** Uncleared Payment Process Handler function ***/
function unclearedPmtsProcessHandler(req, res, next){
	
 try{
		const result = app.client.chat.postMessage({
		token: process.env.TOKEN,
		channel:req.body.originalDetectIntentRequest.payload.data.event.channel,
		text: "*Uncleared Payments Process Diagram*",
		 attachments:'[{"blocks":[{"type":"section","text":{"type":"mrkdwn","text":"Hey check out this diagram that outlines the process."}},{"type":"actions","elements":[{"type":"button","text":{"type":"plain_text","text":"View Diagram"},"url":"https://www.lucidchart.com/documents/view/206ec397-36df-475e-a186-ba3abcebc5b3","style":"primary"}]}]}]',	
		});
	console.log(result);
    }catch (error) {
    return res.json({
	fulfillmentText: 'Could not get results at this time',
	source: 'unclearedPmtsProcessHandler'
	})
  }

}

/*** Twilio Domo Report Handler Function ***/
function twilioDomoReports(req, res, next){
 try{
		const result = app.client.chat.postMessage({
		token: process.env.TOKEN,
		channel:req.body.originalDetectIntentRequest.payload.data.event.channel,
		text: "*Twilio SMS delivered today, by hour*",
		attachments:'[{"blocks":[{"type":"section","text":{"type":"mrkdwn","text":"(View link, use the right arrow to view pages.)"}},{"type":"actions","elements":[{"type":"button","text":{"type":"plain_text","text":"View Twilio Stats"},"url":"https://freedomfinancialnetwork.domo.com/link/EVJ5clmABStJHbAs","style":"primary"}]}]}]',
			
		});
	console.log(result);
    }catch (error) {
    return res.json({
	fulfillmentText: 'Could not get results at this time',
	source: 'tempeWeatherHandler'
	})
  } 
}
/***  tempeWeatherHandler  Handler function ***/
function tempeWeatherHandler(req,res,next){
	 try{
		const result = app.client.chat.postMessage({
		token: process.env.TOKEN,
		channel:req.body.originalDetectIntentRequest.payload.data.event.channel,
		text: "*Weather in Tempe, AZ*",
		attachments:'[{"blocks":[{"type":"section","text":{"type":"mrkdwn","text":"View Tempe, AZ weather."}},{"type":"actions","elements":[{"type":"button","text":{"type":"plain_text","text":"View Tempe, AZ Weather"},"url":"https://weather.com/weather/today/l/USAZ0233:1:US","style":"primary"}]}]}]',

		});
	console.log(result);
    }catch (error) {
    return res.json({
	fulfillmentText: 'Could not get results at this time',
	source: 'tempeWeatherHandler'
	})
  } 
}

/*** sanmateoWeather Handler  function ***/
function sanmateoWeatherHandler(req, res, next){
  
 try{
		const result = app.client.chat.postMessage({
		token: process.env.TOKEN,
		channel:req.body.originalDetectIntentRequest.payload.data.event.channel,
		text: "*Weather in San Mateo, CA*",
		attachments:'[{"blocks":[{"type":"section","text":{"type":"mrkdwn","text":"View San Mateo, CA weather."}},{"type":"actions","elements":[{"type":"button","text":{"type":"plain_text","text":"View San Mateo, CA Weather"},"url":"https://weather.com/weather/today/l/USCA1005:1:US","style":"primary"}]}]}]',

		});
	console.log(result);
    }catch (error) {
    return res.json({
	fulfillmentText: 'Could not get results at this time',
	source: 'sanmateoWeatherHandler'
	})
  } 
	
  }

/** Sacremento Handler Function ***/
 function sacramentoHandler(req, res, next){
 try{
		const result = app.client.chat.postMessage({
		token: process.env.TOKEN,
		channel:req.body.originalDetectIntentRequest.payload.data.event.channel,
		text: "Escalation Plan",
		attachments:'[{"blocks":[{"type":"section","text":{"type":"mrkdwn","text":"The escalation plan for IT urgent todo items."}},{"type":"actions","elements":[{"type":"button","text":{"type":"plain_text","text":"View Escalation in JIRA"},"url":"https://billsdev.atlassian.net/browse/PLAN-279","style":"primary"}]}]}]',

		});
	console.log(result);
    }catch (error) {
    return res.json({
	fulfillmentText: 'Could not get results at this time',
	source: 'sacramentoHandler'
	})
  } 
 }


/*** Room Location Handler function ****/
function roomLocationHandler(req,res,next){
  
try{
		const result = app.client.chat.postMessage({
		token: process.env.TOKEN,
		channel:req.body.originalDetectIntentRequest.payload.data.event.channel,
		text: "Can you ask \'Alfred\' where rooms are? You will get a map to the conference room. Thank you!",
		attachments:'[{"blocks":[{"type":"section","text":{"type":"mrkdwn","text":"Room Search Request"}}]}]',
		});
	console.log(result);
    }catch (error) {
    return res.json({
	fulfillmentText: 'Could not get results at this time',
	source: 'roomLocationHandler'
	})
  } 
}


/***  okta Handler function ***/
 function oktaHandler(req,res,next){
	 
 try{
		const result = app.client.chat.postMessage({
		token: process.env.TOKEN,
		channel:req.body.originalDetectIntentRequest.payload.data.event.channel,
		text: "*OKTA*",
		attachments:'[{"blocks":[{"type":"section","text":{"type":"mrkdwn","text":"(View link, use the right arrow to view pages.)"}},{"type":"actions","elements":[{"type":"button","text":{"type":"plain_text","text":"View OKTA Data"},"url":"https://freedomfinancialnetwork.domo.com/link/IRQqVTpIo8ZvVzEl","style":"primary"}]}]}]',

		});
	console.log(result);
    }catch (error) {
    return res.json({
	fulfillmentText: 'Could not get results at this time',
	source: 'oktaHandler'
	})
  } 
 
 }


/*** Network State Handler Function ***/
function networkStateHandler(req,res,next){

  try{
		const result = app.client.chat.postMessage({
		token: process.env.TOKEN,
		channel: req.body.originalDetectIntentRequest.payload.data.event.channel,
		text: "*CCP Network Map*",
		attachments:'[{"blocks":[{"type":"section","text":{"type":"mrkdwn","text":"Used to monitor basic up/down status as well as active production alarms."}},{"type":"actions","elements":[{"type":"button","text":{"type":"plain_text","text":"View CCP Network Monitor"},"url":"https://prtg.freedomdebtrelief.com/public/mapshow.htm?id=19964&mapid=ccp-noc","style":"primary"}]}]}]',

		});
	console.log(result);
    }catch (error) {
    return res.json({
	fulfillmentText: 'Could not get results at this time',
	source: 'networkStateHandler'
	})
  } 
	
}


/*** how franklin works handler function ***/
function howFranklinWorksHandler(req, res, next){

    try{
		const result = app.client.chat.postMessage({
		token: process.env.TOKEN,
		channel:req.body.originalDetectIntentRequest.payload.data.event.channel,
		text: "*Franklin - (How Franklin Works) Diagram*",
		attachments:'[{"blocks":[{"type":"section","text":{"type":"mrkdwn","text":"Franklin is a Slack chatbot created by FFN."}},{"type":"actions","elements":[{"type":"button","text":{"type":"plain_text","text":"View Dataflow Diagram"},"url":"https://www.lucidchart.com/documents/view/a6565a46-8e2e-4516-98dd-d77b1e9f47af","style":"primary"}]}]}]',

		});
			console.log(result);
    }catch (error) {
    return res.json({
	fulfillmentText: 'Could not get results at this time',
	source: 'howFranklinWorksHandler'
	})
  } 

}

/*** salesforce handler function ***/ 
function genesysSalesforceHandler(req,res,next){
      try{
			const result = app.client.chat.postMessage({
			token: process.env.TOKEN,
			channel:req.body.originalDetectIntentRequest.payload.data.event.channel,
			text: "*Genesys Salesforce Dataflow Diagram*",
		        attachments:'[{"blocks":[{"type":"section","text":{"type":"mrkdwn","text":"Dataflow diagram for Salesforce updates required for the \'debt settlment builder\'."}},{"type":"actions","elements":[{"type":"button","text":{"type":"plain_text","text":"View Dataflow Diagram"},"url":"https://www.lucidchart.com/documents/view/8e338621-9101-4f9a-bb17-8ab61d44e73b","style":"primary"}]}]}]',
			
			});
	      console.log(result);
	    }catch (error) {
	    return res.json({
		fulfillmentText: 'Could not get results at this time',
		source: 'genesysSalesforceHandler'
		})
	  } 

}

/*** gchart Handler function ***/
function gchartHandler(req,res,next){

try{
	const result = app.client.chat.postMessage({
			token: process.env.TOKEN,
			channel:req.body.originalDetectIntentRequest.payload.data.event.channel,
			text: "A Google pie diagram example.",
		        attachments:'[{"blocks":[{"type":"actions","elements":[{"type":"button","text":{"type":"plain_text","text":"View Pie Diagram"},"url":"https://storage.googleapis.com/ffn-images/img/gpie.html","style":"primary"}]}]}]',
		});
	
	console.log(result);
	
 }catch (error) {
	    return res.json({
		fulfillmentText: 'Could not get results at this time',
		source: 'gchart'
		})
	  }
}


/**** gant handler function ***/
function gantHandler(req, res, next){
	
	try{
	     const result = app.client.chat.postMessage({
			token: process.env.TOKEN,
			channel: req.body.originalDetectIntentRequest.payload.data.event.channel,
			text: "Google Gantt Chart Example",
		        attachments:'[{"blocks":[{"type":"section","text":{"type":"mrkdwn","text":"A Google gantt chart example."}},{"type":"actions","elements":[{"type":"button","text":{"type":"plain_text","text":"View Gantt Chart"},"url":"https://storage.googleapis.com/ffn-images/img/ggant.html","style":"primary"}]}]}]',
		});	    
		console.log(result);
	    }catch (error) {
	    return res.json({
		fulfillmentText: 'Could not get results at this time',
		source: 'gant'
		})
	  }  

}

/***  Change Management Handler ***/
function changeMgtHandler(req,res,next){     

	try{
		const result = app.client.chat.postMessage({
		token: process.env.TOKEN,
		channel: req.body.originalDetectIntentRequest.payload.data.event.channel,
		text: "Change Management Diagram",
		attachments:'[{"blocks":[{"type":"actions","elements":[{"type":"button","text":{"type":"plain_text","text":"View Diagram"},"url":"https://www.lucidchart.com/documents/view/bb0c456b-e210-41e4-9ac0-fc93b901a9fa/0","style":"primary"}]}]}]'
		});		
		console.log(result);	    
	}catch (error) {
	    return res.json({
		fulfillmentText: 'Could not get results at this time',
		source: 'changemgt'
		})
	  }  
}

/**** speeding execuses Handler Function ***/
function speedingExcuseHandler(req, res, next){
	var pExcuses = ["I'm sorry officer. I know I was speeding but I thought you wanted to race.",
        "I'm sorry officer. I know I was speeding but I need to get my kid to the hospital. His nose implants are acting up and it wouldn't be good if my husband saw him like this. Then he would know that he isn't his son. Now, we don't want that to happen do we?",
        "I'm sorry officer. I know I was speeding but I just couldn't believe it wasn't butter. I just HAVE to see for my self.",
        "I'm sorry officer. I know I was speeding but to be honest, I don't think you were going the speed limit either.",
        "I'm sorry officer. I know I was speeding but I stole this car.",
        "I'm sorry officer. I know I was speeding but I thought you had to be in relatively good physical shape to be a police officer.",
        "I'm sorry officer. I know I was speeding but how can I convince you otherwise?",
        "I'm sorry officer. I know I was speeding but I know you were waiting for me so I got here as fast as I could!",
        "I'm sorry officer. I know I was speeding but I am stunt driver and we are filming a movie!",
        "I'm sorry officer. I know I was speeding but take some money. How about you go get yourself something nice.",
        "I'm sorry officer. I know I was speeding but you see, I spotted you coming and knew if you caught up you'd see I was drinking. So I had to speed to try and out run you.",
        "I'm sorry officer. I know I was speeding but I'm being stalked by 3 FBI cars and I'm trying to run away!",
        "I'm sorry officer. I know I was speeding but I'VE SEEN YOU BEFORE! Aren't you in The Village People?",
        "I'm sorry officer. I know I was speeding but I didn't want to be late for church.",
        "I'm sorry officer. I know I was speeding but I was going cuckoo for Coco puffs!",
        "I'm sorry officer. I know I was speeding but I'm a pregnant man!",
        "I'm sorry officer. I know I was speeding but there was a giant anaconda chasing me!",
        "I'm sorry officer. I know I was speeding but OH MY, aren't you a sexy officer?",
        "'m sorry officer. I know I was speeding but all the signs say 81! Apparently that was the route number...",
        "I'm sorry officer. I know I was speeding but my doctor gave me the wrong meds.",
        "I'm sorry officer. I know I was speeding but I get 10 extra in the fast lane.",
        "I'm sorry officer. I know I was speeding but my accident-prone fiance is home alone.",
        "I'm sorry officer. I know I was speeding but I ran out of lip gloss!",
        "I'm sorry officer. I know I was speeding but I had passed out after seeing flashing lights which I believed to be UFOs in the distance. The flash of the camera brought me round from my trance.",
        "I'm sorry officer. I know I was speeding but I have to get home in time for Ugly Betty!",
        "I'm sorry officer. I know I was speeding but WOW, officer, is that a V8? She looks nice, bets she goes and handles well, mind if take a look, please?",
        "I'm sorry officer. I know I was speeding but the limit was not clearly posted.",
        "I'm sorry officer. I know I was speeding but I am color blind and I thought that the speeding sign was the blue one!",
        "I'm sorry officer. I know I was speeding but I have to get ice cream before the store closes!",
        "I'm sorry officer. I know I was speeding but I have to get home quickly I left the stove on!",
        "I'm sorry officer. I know I was speeding but I had a piece of jerky fall under the gas petal and I was trying to get it with my foot."
    ];
    var pIndex = Math.random() * (30 - 0) + 0;
    var index = Math.round(pIndex);
    try{
	const result = app.client.chat.postMessage({
				      // The token you used to initialize your app
				      token: process.env.TOKEN,
				      channel: req.body.originalDetectIntentRequest.payload.data.event.channel,	  
				      text:'Excuses for speeding...',					  
				      attachments:'[{"color": "#3AA3E3","text":"'+ pExcuses[index] +'"}]',					  
				    });
		console.log(result);
					
	 }catch (error) {
	    return res.json({
			fulfillmentText: 'Could not get results at this time',
			source: 'PExcuses'
		})
	  }
}


/***  Excuses Handler Function ***/
function excuseHandler(req, res, next){
	var excuses = ["I won't be coming to work today because I'm going to take a nap!",
        "I won't be coming to work today because I am on a quest for the Holy Grail.",
        "I won't be coming to work today because I'm too sexy for this job... Along with other items like my shirt... Pants... You.",
        "I won't be coming to work today because I forgot how to get there.",
        "I won't be coming to work today because someone stole my heart.",
        "I won't be coming to work today because my llamas body is missing.",
        "I won't be coming to work today because I took one too many Viagra.",
        "I won't be coming to work today because I love Brenden Fraiser.",
        "I won't be coming to work today because my car payment, house payment, and boyfriend are three months overdue.",
        "I won't be coming to work today because I will be saving the Earth from Global warming... meaning I am not driving.",
        "I won't be coming to work today because I can't believe it's not butter.",
        "I won't be coming to work today because my vacuum ate my keys.",
        "I won't be coming to work today because my cat has a gun and is holding me hostage..",
        "I won't be coming to work today because my tootsy-rolls didn't arrive.",
        "I won't be coming to work today because I just don't care.",
        "I won't be coming to work today because I'm going out, since I'm gonna get what I want.",
        "I won't be coming to work today because my father is sick and the doctors say he might not make it.",
        "I won't be coming to work today because I have to give away kittens. Want one?",
        "I won't be coming to work today because a rhino just impaled my car.",
        "I won't be coming to work today because my hair is still wet!",
        "I won't be coming to work today because the llamas are attacking my house!",
        "I won't be coming to work today because your not delicious.",
        "I won't be coming to work today because I forgot that there was work today.",
        "I won't be coming to work today because in an attempt to kill a fly I drove into a telephone pole.",
        "I won't be coming to work today because my dog ate my car keys and we're hitch hiking to the vet.",
        "I won't be coming to work today because I have mad cow disease.",
        "I won't be coming to work today because my dog has to go to the bathroom.",
        "I won't be coming to work today because my spidey-sences are tingling and they're telling me not to come into work now or I'll be in trouble.",
        "I won't be coming to work today because the llamas are attacking my house!",
        "I won't be coming to work today because the carpool host was being creepy.",
        "I won't be coming to work today because my dog jumped to the moon and I had to get him.",
        "I won't be coming to work today because my heart is beating abnormally.",
        "I won't be coming to work today because I had a near death experience and thought I died.",
        "I won't be coming to work today because I don't have to since my understudy decided she likes going to it more than me.",
        "I won't be coming to work today because my boyfriend hit me over the head with a speaker and I'm kind of messed up.",
        "I won't be coming to work today because the voices told me to clean all the guns today.",
        "I won't be coming to work today because I'm taking your parents to school day.",
        "I won't be coming to work today because my puppy died from eating a un-blown balloon.",
        "I won't be coming to work today because I melt in the sun.",
        "I won't be coming to work today because I had to save the world from a giant piece of lint. It was a fierce and dirty battle but I truimphed over the scum lint ball with the vacuum of JUSTICE!!!",
        "I won't be coming to work today because my brother is sick and the doctors say he might not make it.",
        "I won't be coming to work today because I'm busy doing fun things in the elevator.",
        "I won't be coming to work today because a tree fell on my car.",
        "I won't be coming to work today because my mind works like lightning, one brilliant flash and it's gone.",
        "I won't be coming to work today because I'm stuck in jail.",
        "I won't be coming to work today because my mother is sick and the doctors say she might not make it.",
        "I won't be coming to work today because I'm slaying vampires.",
        "I won't be coming to work today because I'm all stressed out and I don't want to have someone to choke.",
        "I won't be coming to work today because I have to learn an interpretive dance number by noon.",
        "I won't be coming to work today because my fortune cookie said not to.",
        "I won't be coming to work today because my horoscope says avoid heavy loads.",
        "I won't be coming to work today because Dr. Phil said not to, he said it was the best for me and my family.",
        "I won't be coming to work today because I've got a horrible Herpes breakout. I'm sorry, it should be better by tomorrow.",
        "I won't be coming to work today because a pedestrian hit me and went under my car.",
        "I won't be coming to work today because I was having heat flashes.",
        "I won't be coming to work today because I'm doing a Stress Level Elimination Exercise Plan (sleep).",
        "I won't be coming to work today because it seems someone stole my car last night.",
        "I won't be coming to work today because I'm turning into the devil.",
        "I won't be coming to work today because I'm getting older, but not wiser.",
        "I won't be coming to work today because I'm too busy burning the office down.",
        "I won't be coming to work today because I stayed up all night dealing with a problem.",
        "I won't be coming to work today because I woke up to the soothing sound of water and remembered that I just bought a waterbed.",
        "I won't be coming to work today because I'm too young for work!",
        "I won't be coming to work today because I had to make myself a sandwich.",
        "I won't be coming to work today because I tripped over a lady bug.",
        "I won't be coming to work today because I was driving in my car until I got into an accident with another car so im a ghost now and im gonna go haunt the man that smashed my car.",
        "I won't be coming to work today because I was told I lost my mind, so I have to go find it.",
        "I won't be coming to work today because I have diarrhea and its very intoxicating.",
        "I won't be coming to work today because I played leap frog with a unicorn.",
        "I won't be coming to work today because constipation has made me a walking time bomb.",
        "I won't be coming to work today because a swarm of crabs is blocking my way out the door.",
        "I won't be coming to work today because I'm in a coma right now.",
        "I won't be coming to work today because I just found out I'm the Holder of the End, and I can't let the objects come together.",
        "I won't be coming to work today because I don't have to since my understudy decided she likes going to it more than me.",
        "I won't be coming to work today because my house is flooded and I need to be there when the plumber comes.",
        "I won't be coming to work today because I fell down and I can't seem to get back up.",
        "I won't be coming to work today because I was kidnapped by ninjas.",
        "I won't be coming to work today because I have an attitude and I will use it on you if I do go.",
        "I won't be coming to work today because it's a sunday.",
        "I won't be coming to work today because I have really bad gas and I don't want everyone else to suffer.",
        "I won't be coming to work today because they forgot to sterilize the needle before the lethal injection.",
        "I won't be coming to work today because my next mood swing is in six minutes.",
        "I won't be coming to work today because it's raining cats and dogs!",
        "I won't be coming to work today because I just found out I'm no longer alive.",
        "I won't be coming to work today because I have just four minutes to save the world. ",
        "I won't be coming to work today because I am too busy becoming a lesbian and practicing witchcraft. Oh wait..thats my excuse for not going to church.",
        "I won't be coming to work today because I just bought halo 3 so bug off."
    ];
    var excuseIndex = Math.random() * (86 - 0) + 0;
    var index = Math.round(excuseIndex);
	
	try{
	const result = app.client.chat.postMessage({
				      // The token you used to initialize your app
				      token: process.env.TOKEN,
				      channel: req.body.originalDetectIntentRequest.payload.data.event.channel,	  
				      text:'Excuses for not going to work ...',					  
				      attachments:'[{"color": "#3AA3E3","text":"'+ excuses[index] +'"}]',					  
				    });
		console.log(result);
					
	 }catch (error) {
	    return res.json({
			fulfillmentText: 'Could not get results at this time',
			source: 'Excuses'
		})
	  }
	
}

/*** Poem Handler Function ***/
function poemHandler(req,res,next){

 var options = {
        uri: 'https://www.poemist.com/api/v1/randompoems',
        method: 'GET',
        json: true,
        headers: {
            "Accept": "application/json"
        }
    };
	
     return rp(options)
        .then(result => {
            var returnPoem = '';

            for (var i = 0; i < result.length; i++) {
                returnPoem = '*TITLE* ' + result[i].title + '\n' + '*POEM* \n' + result[i].content + '\n\n';
            }
	     
	     try{
	        const result = app.client.chat.postMessage({
		    token: process.env.TOKEN,
		    channel:req.body.originalDetectIntentRequest.payload.data.event.channel,
		    text: "Random Poem ...",
		    attachments:'[{"color": "#3AA3E3","attachment_type": "default","text":"'+ returnPoem +'"}]',			
		});
	     }catch (error) {
	    return res.json({
		fulfillmentText: 'Could not get results at this time',
		source: 'Poem'
		})
	  }   
       })
        .catch(function (err) {
           
            console.log(err);
        });
	

}
/*** my Test Handler Function ***/
function mytestHandler(req, res, next){

	try{
		const result = app.client.chat.postMessage({
		token: process.env.TOKEN,
		channel:req.body.originalDetectIntentRequest.payload.data.event.channel,
		text: "",
		attachments:'[{"color":"#3AA3E3","blocks":[{"type":"section","text":{"type":"mrkdwn","text":"You have a new request:\n*<fakeLink.toEmployeeProfile.com|Fred Enriquez - New device request>*"}},{"type":"section","fields":[{"type":"mrkdwn","text":"\*Type:*\nComputer (laptop)"},{"type":"mrkdwn","text":"*When:*\nSubmitted Aut 10"},{"type":"mrkdwn","text":"*Last Update:*\nMar 10, 2015 (3 years, 5 months)"},{"type":"mrkdwn","text":"*Reason:*\nAll vowel keys aren\'t working."},{"type":"mrkdwn","text":"*Specs:*\nCheetah Pro 15 - Fast, really fast"}]},{"type":"actions","elements":[{"type":"button","text":{"type":"plain_text","emoji":true,"text":"Approve"},"value":"click_me_123"},{"type":"button","text":{"type":"plain_text","emoji":true,"text":"Deny"},"value":"click_me_123"}]}]}]'
		});
		console.log(result);
	    }catch (error) {
	    return res.json({
		fulfillmentText: 'Could not get results at this time',
		source: 'MyTest'
		})
	  }  


}

/****  Incident Management Handler Function ***/
function incidentMgtHandler(req,res,next){	
	try {	 
	   // Call the chat.postMessage method using the built-in WebClient
	    const result = app.client.chat.postMessage({
	      // The token you used to initialize your app
	      token: process.env.TOKEN,
	      channel: req.body.originalDetectIntentRequest.payload.data.event.channel,	  
	      text:'Incident Management (IM)',	  		 
	      attachments:'[{"blocks":[{"type":"section","text":{"type":"mrkdwn","text":"Incident Management Resources from ServiceNow below ..."}},{"type":"actions","elements":[{"type":"button","text":{"type":"plain_text","text":"Outage Email"},"url":"https://freedomfinancialnetwork.service-now.com/sp?id=kb_article_view&sys_kb_id=3f87de47dbdef240a035f97e0f9619d5","style":"primary"},{"type":"button","text":{"type":"plain_text","text":"Run an Outage"},"url":"https://freedomfinancialnetwork.service-now.com/sp?id=kb_article&sys_id=9ec9d821db7dd7007deefb5aaf961944","style":"primary"},{"type":"button","text":{"type":"plain_text","text":"IM"},"url":"https://freedomfinancialnetwork.service-now.com/sp?id=kb_article&sys_id=5b256931dbcaa3c0c4c9f06e0f9619fd","style":"primary"}]}]}]', 
	    });	   
	
		return res.json({});
	  }
	  catch (error) {
	    return res.json({
			fulfillmentText: 'Could not get results at this time',
			source: 'IncidentMgt'
		})
	  }
	
}

/*** Joke2Handler Handler Function ***/
function  joke2Handler(req,res,next){
https.get(
		'https://corporatebs-generator.sameerkumar.website/',
		responseFromAPI => {
			let completeResponse = ''
			responseFromAPI.on('data', chunk => {
				completeResponse += chunk
			})
			responseFromAPI.on('end', () => {
			
				const msg = JSON.parse(completeResponse);
				// Call the chat.postMessage method using the built-in WebClient
				    const result = app.client.chat.postMessage({
					      // The token you used to initialize your app
					      token: process.env.TOKEN,
					      channel:req.body.originalDetectIntentRequest.payload.data.event.channel,	  
					      text:'Information Technology Joke',					  
					      attachments:'[{"color":"#3AA3E3","text":"'+ msg.phrase +'"}]',					 
				    });

			    // Print result, which includes information about the message (like TS)
			    console.log(result);
			    return res.json({});
				
			})
		},
		error => {
			return res.json({
				fulfillmentText: 'Could not get results at this time',
				source: 'Joke2Handler'
			})
		}
	)
}

/**** Lawyer Joke Handler Function ***/
function lawyerJokesHandler(req,res,next){
	    var lJokes = [
        "Q: What do you call a smiling, courteous person at a bar association convention?\nA: The caterer.",
        "Q: What's the difference between a female lawyer and a pitbull?\nA: Lipstick.",
        "Q: What do you call a lawyer with an IQ of 100?\nA: Your Honor.\nQ: What do you call a lawyer with an IQ of 50\nA: Senator.",
        "Q: What's the difference between an accountant and a lawyer?\nA: Accountants know they're boring.",
        "Q: What's the one thing that never works when it's fixed?\nA: A jury.",
        "Q: Why did God invent lawyers?\nA: So that real estate agents would have someone to look down on.",
        "Q: What's the difference between a vacuum cleaner and a lawyer on a motorcycle?\nA: The vacuum cleaner has the dirt bag on the inside.",
        "Q: What' the difference between a lawyer and a boxing referee?\nA: A boxing referee doesn't get paid more for a longer fight.",
        "Q: What's the difference between a good lawyer and a bad lawyer?\nA: A bad lawyer makes your case drag on for years. A good lawyer makes it last even longer.",
        "Q: What's the difference between a jellyfish and a lawyer?\nA: One's a spineless, poisonous blob. The other is a form of sea life.",
        "Q: What's the difference between a lawyer and a trampoline?\nA: You take off your shoes before you jump on a trampoline.",
        "Q: What's the difference between a lawyer and a leech?\nA: After you die, a leech stops sucking your blood.",
        "Q: What's the difference between a lawyer and God?\nA: God doesn't think he's a lawyer.",
        "Q: How are an apple and a lawyer alike?\nA: They both look good hanging from a tree.",
        "Q: How can a pregnant woman tell that she's carrying a future lawyer?\nA: She has an uncontrollable craving for bologna.",
        "Q: How does an attorney sleep?\nA: First he lies on one side, then he lies on the other.",
        "Q: How many lawyer jokes are there?\nA: Only three. The rest are true stories.",
        "Q: How many lawyers does it take to screw in a light bulb?\nA: Three, One to climb the ladder. One to shake it. And one to sue the ladder company.",
        "Q: What are lawyers good for?\nA: They make used car salesmen look good.",
        "Q: What do dinosaurs and decent lawyers have in common?\nA: They're both extinct.",
        "Q: What do you call 25 attorneys buried up to their chins in cement?\nA: Not enough cement.",
        "Q: What do you call 25 skydiving lawyers?\nA: Skeet.",
        "Q: What do you call a lawyer gone bad.\nA: Senator.",
        "Q: What do you throw to a drowning lawyer?\nA: His partners.",
        "Q: What does a lawyer get when you give him Viagra?\nA: Taller",
        "Q: What's brown and looks really good on a lawyer?\nA: A Doberman.",
        "Q: What's the difference between a lawyer and a liar?\nA: The pronunciation.",
        "Q: What's the difference between a lawyer and a prostitute?\nA: A prostitute will stop screwing you when you're dead.",
        "Q: What's the difference between a lawyer and a vulture?\nA: The lawyer gets frequent flyer miles.",
        "Q: What's the difference between a mosquito and a lawyer?\nA: One is a blood-sucking parasite, the other is an insect.",
        "Q: Why did God make snakes just before lawyers?\nA: To practice.",
        "Q: What's the difference between a lawyer and a herd of buffalo?\nA: The lawyer charges more.",
        "Q: What's the difference between a tick and a lawyer?\nA: The tick falls off when you are dead.",
        "Q: What do you get when you cross a blonde and a lawyer?\nA: I don't know. There are some things even a blonde won't do.",
        "Q: Know how copper wire was invented?\nA: Two lawyers were fighting over a penny.",
        "Q: Why does the law society prohibit sex between lawyers and their clients?\nA: To prevent clients from being billed twice for essentially the same service.",
        "Q: What can a goose do, a duck can't, and a lawyer should?\nA: Stick his bill up his ass.",
        "Q: How can you tell when a lawyer is lying?\nA: Their lips are moving.",
        "Q: Why did New Jersey get all the toxic waste and California all the lawyers?\nA: New Jersey got to pick first.",
        "Q: Why don't lawyers go to the beach?\nA: Cats keep trying to bury them.",
        "Q: What do you call 5000 dead lawyers at the bottom of the ocean?\nA: A good start!",
        "Q: What's the difference between a dead skunk in the road and a dead lawyer in the road?\nA: There are skid marks in front of the skunk.",
        "Q: Why won't sharks attack lawyers?\nA: Professional courtesy.",
        "Q: What do have when a lawyer is buried up to his neck in sand?\nA: Not enough sand.",
        "Q: How do you get a lawyer out of a tree?\nA: Cut the rope.",
        "Q: Do you know how to save a drowning lawyer?\nA: Take your foot off his head.",
        "Q: What's the difference between a lawyer and a bucket of manure?\nA: The bucket.",
        "Q: What is the definition of a shame (as in 'that's a shame')?\nA: When a bus load of lawyers goes off a cliff.\n\nQ: What is the definition of a 'crying shame'?\nA: There was an empty seat.",
        "Q: What do you get when you cross the Godfather with a lawyer?\nA: An offer you can't understand",
        "Q: Why is it that many lawyers have broken noses?\nA: From chasing parked ambulances.",
        "Q: Where can you find a good lawyer?\nA: In the cemetery",
        "Q: What's the difference between a lawyer and a gigolo?\nA: A gigolo only screws one person at a time.",
        "Q: What's the difference between a lawyer and a vampire?\nA: A vampire only sucks blood at night.",
        "Q: Why to lawyers wear neckties?\nA: To keep the foreskin from crawling up their chins.",
        "Q: What is the difference between a lawyer and a rooster?\nA: When a rooster wakes up in the morning, its primal urge is to cluck defiance.",
        "Q: How many law professors does it take to change a light bulb?\nA: Hell, you need 250 just to lobby for the research grant.",
        "Q: If you see a lawyer on a bicycle, why don't you swerve to hit him?\nA: It might be your bicycle.",
        "Q: What do you call a smiling, sober, courteous person at a bar association convention?\nA: The caterer.",
        "Q: Why do they bury lawyers under 20 feet of dirt?\nA: Because deep down, they're really good people.",
        "Q: Why are lawyers like nuclear weapons?\nA: If one side has one, the other side has to get one. Once launched, they cannot be recalled. When they land, they screw up everything forever.",
        "Q: What do lawyers and sperm have in common?\nA: One in 3,000,000 has a chance of becoming a human being.",
        "The Penalty for laughing in court is six months in jail; if it were not for this penalty, the jury would never hear the evidence.",
        "Lawyers occasionally stumble over the truth, but most of them pick themselves up and hurry off as if nothing had happened.",
        "Lorenzo Dow, a 19th century evangelist, was on a preaching tour when he came to a small town one cold winter night. At the local general store he saw the town's lawyers gathered around thepotbellied stove.\nDow told the men about a recent vision in which he had been givena tour of hell, much like the traveler in Dante's Inferno. Oneof the lawyers asked what he had seen.\nVery much what I see here, Dow said.\nAll of the lawyersgathered in the hottest place.",
        "Sometimes a man who deserves to be looked down upon because he is a fool is despised only because he is a lawyer.",
        "Lawyers are like rhinoceroses: thick skinned, short-sighted, and always ready to charge.",
        "A fox may steal your hens, Sir,\nA whore your health and pence,\nSir,Your daughter rob your chest,\nSir,Your wife may steal your rest,\nSir,A thief your goods and plate. But this is all but picking, With rest, pence, chest and chicken; It ever was decreed,\nSir, If lawyer's hand is fee'd,\nSir, He steals your whole estate.",
        "I would be loath to speak ill of any person who I do not knowdeserves it, but I am afraid he is an attorney.",
        "A Dublin lawyer died in poverty and many barristers of the city subscribed to a fund for his funeral. The Lord Chief Justice of Orbury was asked to donate a shilling. 'Only a shilling?' said the Justice, 'Only a shilling to bury an attorney? Here's a guinea; go and bury 20 more of them.'",
        "'How can I ever thank you?' gushed a woman to Clarence Darrow, after he had solved her legal troubles. 'My dear woman,' Darrow replied, 'ever since the Phoenicians invented money there has been only one answer to that question.'",
        "A Lawyer and a wagon wheel must be well greased.",
        "Three Doctors are dicussing which types of patients they prefer. Doctor Watson says, ''I prefer librarians. All their organs are alphabetized.\n\nDoctor Fitzpatrick says, ''I prefer mathematicians. All their organs are numbered.'' \n\nDoctor Ahn says, ''I prefer lawyers. They are gutless, heartless, brainless, spineless, and their heads and rear ends are interchangeable.''",
        "Q: Why have scientists started using lawyers for experiments instead of rats?\nA: They don't become so attached to the lawyers.",
        "Q: What is the ideal weight of a lawyer?\nA: About three pounds, including the urn.",
        "What do you call 500 lawyers at the bottom of the ocean?\nA good start.",
        'Q: What\'s the difference between a catfish and a lawyer?\nA: One\'s a slimy scum-sucking bottom-dwelling scavenger; the other is a fish.',
        'A couple wants a divorce, but first they must decide who will be the main guardian of their child. The jury asks both the man and woman for a reason why they should be the one to keep the child. So the jury asks the woman first. She says, "Well I carried this child around in my stomach for nine months and I had to go through a painful birth process, this is my child and apart of me." The jury is impressed and then turns to ask the man the same question. The man replies, "OK, I take a coin and put it in the drink machine and a drink comes out, now tell me who does the drink belong to me or the machine"',
        "A good lawyer knows the law; a great lawyer knows the judge.",
        "Q: What did the lawyer name his daughter?\nA: Sue!",
        "Why do pharmaceutical company laboratories now use lawyers rather than lab rats for testing? \n. . . Lawyers breed faster, so there are more of them. \n. . . Lab personnel don't get as emotionally attached to them. \n. . . Lawyers do things rats won't. \n. . . Animal protection groups don't get nearly as excited. \n. . . Some people actually LIKE rats.",
        'One day a lawyer died and found herself at the pearly gates of heaven. St. Peter asked, "Who are you?" The woman answered, "I was a Hollywood divorce lawyer."\n\nNodding ominously, St. Peter asked, "What have you done to earn an eternal reward in heaven?"\n\nThe lawyer thought about it long and hard, searching her mind for the one good deed that might gain her entrance to heaven. "As a matter of fact, the other day I passed a panhandler in the street and I gave him fifty cents," she said beamingly.\n\nSt. Peter nodded grimly, looking over at his assistant Gabriel, and asked, "Is that in the records?" Gabriel nodded his assent. St. Peter than said, "That\'s not very impressive, nor is it enough. I\'m sorry," and started to close the gates.\n\n"Wait, wait! There\'s more," shouted the woman. "The other night, as I was walking home, I almost tripped over a homeless child in the street. I gave him fifty cents too!"\n\nPeter again checked with Gabriel who confirmed the incident. "Is there anything else?"\n\nThe lawyer again thought and thought and sadly said, "Not that I can remember."\n\nSt. Peter contemplated for a long time and then asked Gabriel, "What do you think I should do?"\n\nGabriel glanced at the lawyer disgustedly and said, "I\'d give her back her buck and tell her to go to hell!"',
        'A stingy old lawyer who had been diagnosed with a terminal illness was determined to prove wrong the saying, "You can\'t take it with you."\n\nAfter much thought and consideration, the old ambulance-chaser finally figured out how to take at least some of his money with him when he died. He instructed his wife to go to the bank and withdraw enough money to fill two pillow cases. He then directed her to take the bags and of money to the attic and leave them directly above his bed. His plan: When he passed away, he would reach out and grab the bags on his way to heaven.\n\nSeveral weeks after the funeral, his widow was up in the attic cleaning, and came upon the two forgotten pillow cases stuffed with cash. "Oh, that darn fool," she exclaimed, "I knew he should have had me put the money in the basement."',
        "A lawyer, an engineer and a mathematician were called in for a test.\n\nThe engineer went in first and was asked, ''''What is 2+2?'''' The engineer thought awhile and finally answered, ''''4.''''\n\nThen the mathemetician was called in and was asked the same question. With little thought he replied, ''''4.0'''' \n\nThen the lawyer was called in, and was asked the same question. The lawyer answered even quicker than the mathematician, ''''What do you want it to be?''''",
        'A lawyer was just waking up from anesthesia after surgery, and his wife was sitting by his side. His eyes fluttered open and he said, "You\'re beautiful!" and then he fell asleep again. His wife had never heard him say that so she stayed by his side. A couple of minutes later, his eyes fluttered open and he said, "You\'re cute!" Well, the wife was dissapointed because instead of "beautiful," it was "cute." She asked, "What happened to \'beautiful\'?" His reply was "The drugs are wearing off!"',
        'One day in Contract Law class, the professor asked one of his better students, "Now if you were to give someone an orange, how would you go about it?\n\n"The student replied, "Here\'s an orange."\n\nThe professor was livid. "No! No! Think like a lawyer!"\n\nThe student then recited, "Okay, I\'d tell him, I hereby give and convey to you all and singular, my estate and interests, rights, claim, title, claim and advantages of and in, said orange, together with all its rind, juice, pulp, and seeds, and all rights and advantages with full power to bite, cut, freeze and otherwise eat, the same, or give the same away with and without the pulp, juice, rind and seeds, anything herein before or hereinafter or in any deed, or deeds, instruments of whatever nature or kind whatsoever to the contrary in anywise notwithstanding..."',
        'As the lawyer awoke from surgery, he asked, "Why are all the blinds drawn?" The nurse answered, "There\'s a fire across the street, and we didn\'t want you to think you had died."'
    ];

    var pIndex = Math.random() * ((lJokes.length - 1) - 0) + 0;
    var index = Math.round(pIndex);
	 
	 try{
		const result = app.client.chat.postMessage({
		      // The token you used to initialize your app
		      token: process.env.TOKEN,
		      channel: req.body.originalDetectIntentRequest.payload.data.event.channel,					  
		      text:'Lawyer joke...',					  
		      attachments:'[{"color": "#3AA3E3","text":"'+ lJokes[index] +'"}]',					  
	   });
	   console.log(result);
					
	 }catch (error) {
	    return res.json({
			fulfillmentText: 'Could not get results at this time',
			source: 'Lawyer joke...'
		})
	  }
	
}

/**** orderCafeteriaHandler handler function ***/
function orderCafeteriaHandler(req,res,next){	
	try {	 
	   // Call the chat.postMessage method using the built-in WebClient
	    const result = app.client.chat.postMessage({
	      // The token you used to initialize your app
	      token: process.env.TOKEN,
	      channel:req.body.originalDetectIntentRequest.payload.data.event.channel,	  
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
	      channel: req.body.originalDetectIntentRequest.payload.data.event.channel,	  
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
	      channel: req.body.originalDetectIntentRequest.payload.data.event.channel,	  
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

/**  database intent  related function section */
function addMrkUpSlackSection(sectionText) {
    var returnJson = {

        "type": "section",
        "text": {
            "type": "mrkdwn",
            "text": sectionText
        }
    };
    return returnJson;

}

function addSlackDivider(sectionText) {
    var returnJson = {
        "type": "divider"
    };
    return returnJson;
}

/*****************This end here **************************/
function listAllFFNDictionaryHandler(req, res, next) {
    console.log('listAllFFNDictionaryHandler function called!');
    var totalWordsFound = 0;
    var myblocks = [];
	
   //blocks.push(addMrkUpSlackSection("*FFN Dictionary*"));
	
	//console.log(blocks);
	
    try{
	myblocks.push(addMrkUpSlackSection("*FFN Dictionary*"));	
	console.log(myblocks);
	 var Originalblocks=[{"type": "section","text": {"type": "mrkdwn","text": "hello"}}];
	const result = app.client.chat.postMessage({
	token: process.env.TOKEN,
	channel: req.body.originalDetectIntentRequest.payload.data.event.channel,
	text: "Required income to net a specific income.",
	//attachments:'[{"color": "#3AA3E3","blocks":[{"type": "section","text": {"type": "mrkdwn","text": "hello"}}]}]',
	attachments:'[{"color": "#3AA3E3","blocks":"' + Originalblocks + '"}]',
    });
	    
	var Originalblocks1=[{"type": "section","text": {"type": "mrkdwn","text": "hello"}}];    
       const result1 = ({
	token: process.env.TOKEN,
	channel: req.body.originalDetectIntentRequest.payload.data.event.channel,
	text: "Required income to net a specific income.",
        attachments:'[{"color": "#3AA3E3","blocks":"' + Originalblocks1 + '"}]',
       })
	    
        console.log('original content');
	console.log(Originalblocks1);
	    
	    
    }catch (error) {
    return res.json({
	fulfillmentText: 'Could not get results at this time',
	source: 'listAllFFNDictionaryHandler'
	})
  }	
	
    /*	
     blocks.push(addMrkUpSlackSection("*FFN Dictionary*"));
     blocks.push({
                    "type": "actions",
                    "elements": [{
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "emoji": true,
                            "text": "Add New Word"
                        },
                        "style": "primary",
                        "value": "add_another_word"
                    }]
                });
	
	
                var payloadSlack = {
                    "payload": {
                        "slack": {
                            "attachments": [{
                                "blocks": blocks
                            }]
                        },
                        "outputContexts": [{
                            "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/listAllFFNDictionary"
                        }]
                    }
                };
                //console.log(payloadSlack);
           res.send(payloadSlack);	
	*/
	
}



module.exports = router;
