const express = require('express')
// will use this later to send requests
const http = require('http')
const https = require('https')
// import env variables
require('dotenv').config()

var indexRouter = require('./routes/index');
//var ideasRouter = require('./routes/ideas');
var demoRouter = require('./routes/demo');

const app = express()
const port = process.env.PORT || 8200


//app.engine('html', engine);

// view engine setup
//app.set('view engine', 'html');
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

/*
app.get('/', (req, res) => {
	res.status(200).send('Server is working.')
})
*/

app.use('/', indexRouter);

//app.use('/ideas', ideasRouter);
//app.use('/gcptasks', gcpTasksRouter);
app.use('/demo',demoRouter);

app.listen(port, () => {
	console.log(`🌏 Server is running at http://localhost:${port}`)
})

/** various function called by the swicth case come here **/


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

function joke2Handler(req, res, next) {
	/*
    var options = {
        uri: 'https://geek-jokes.sameerkumar.website/api',
        method: 'GET',
        json: true
    };
	*/
	
	https.get('https://geek-jokes.sameerkumar.website/api',responseFromAPI => {
			let completeResponse = ''
			responseFromAPI.on('data', chunk => {
				completeResponse += chunk
			})
			responseFromAPI.on('end', () => {
				
				console.log(completeResponse);				
				
				let dataToSend ;
				dataToSend = `Information Technology Joke: ${completeResponse}`

				return res.json({
					fulfillmentText: dataToSend,
					source: 'J2'
				})
			})
		},
		error => {
			return res.json({
				fulfillmentText: 'Could not get results at this time',
				source: 'J2'
			})
		}	
	)
	
}	

function addNewIdeaWithName(req, res, next) {
	console.log('inside Add New Idea With Name');
    var payloadSlack = {
        "payload": {
            "slack": {
                "text": "Note: Idea has changed...",
                "attachments": [{
                    "text": "Idea has been replaced with a slash command and is accessable by typing\n/idea",
                    "fallback": "Idea has been replaced with a slash command and is accessable by typing\n/idea",
                    "color": "#3AA3E3",
                    "attachment_type": "default",

                }]
            },
            "outputContexts": [{
                "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/JIRA-NewIdea"
            }]
        }
    };
    res.send(payloadSlack);
}



app.post('/',(req, res,next) => {
	//console.log('post called!');
	var intentName = req.body.queryResult.intent.displayName;
	//console.log('ideas called');
	
	console.log('ankur');
	console.log(intentName);
	console.log(req.body);
	
	/*
	try {
        logRequests(req.body.queryResult.queryText, req.body.originalDetectIntentRequest.payload.data.event.user, req.body.originalDetectIntentRequest.payload.data.event.ts, intentName, req.body.originalDetectIntentRequest.payload.data.event.channel);
    } catch (logError) {
        console.log("error saving request: " + logError);
    }
	*/
	
	try {
		  switch (intentName) {
			case "JIRA-NewIdea":
                // add new JIRA idea to Intake sprint
                //addNewIdeaWithOutName(req, res, next);
                addNewIdeaWithName(req, res, next);
                break;
			case "getmovie":
                getmovie(req,res,next);
				break;
			case "MathFacts":
                mathFactsHandler(req, res, next);
                break;
			case "BuzzWord":
                // corporate buzz word generator
                buzzWordHandler(req, res, next);
                break;		
            case "J2":
                joke2Handler(req, res, next);
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


function getmovie(req,res,next){
	const movieToSearch =req.body.queryResult.parameters.movie;
	console.log('movie name come here!');
	console.log(movieToSearch);	

	const reqUrl = encodeURI(
		`http://www.omdbapi.com/?t=${movieToSearch}&apikey=${process.env.API_KEY}`
	)
	
	console.log(reqUrl);
	
	http.get(
		reqUrl,
		responseFromAPI => {
			let completeResponse = ''
			responseFromAPI.on('data', chunk => {
				completeResponse += chunk
			})
			responseFromAPI.on('end', () => {
				const movie = JSON.parse(completeResponse)

				let dataToSend = movieToSearch
				dataToSend = `${movie.Title} was released in the year ${movie.Year}. It is directed by ${
					movie.Director
				} and stars ${movie.Actors}.\n Here some glimpse of the plot: ${movie.Plot}.
                }`

				return res.json({
					fulfillmentText: dataToSend,
					source: 'getmovie'
				})
			})
		},
		error => {
			return res.json({
				fulfillmentText: 'Could not get results at this time',
				source: 'getmovie'
			})
		}
	)
	
}

/** call to the movie api call to get the movie information 


app.post('/getmovie', (req, res) => {
	
	console.log(req.body);
	
	/*
	const movieToSearch =
		req.body.queryResult && req.body.queryResult.parameters && req.body.queryResult.parameters.movie
			? req.body.result.parameters.movie
			: ''; 
		
		
	const movieToSearch =req.body.queryResult.parameters.movie;
	console.log('movie name come here!');
	console.log(movieToSearch);	

	const reqUrl = encodeURI(
		`http://www.omdbapi.com/?t=${movieToSearch}&apikey=${process.env.API_KEY}`
	)
	
	console.log(reqUrl);
	
	http.get(
		reqUrl,
		responseFromAPI => {
			let completeResponse = ''
			responseFromAPI.on('data', chunk => {
				completeResponse += chunk
			})
			responseFromAPI.on('end', () => {
				const movie = JSON.parse(completeResponse)

				let dataToSend = movieToSearch
				dataToSend = `${movie.Title} was released in the year ${movie.Year}. It is directed by ${
					movie.Director
				} and stars ${movie.Actors}.\n Here some glimpse of the plot: ${movie.Plot}.
                }`

				return res.json({
					fulfillmentText: dataToSend,
					source: 'getmovie'
				})
			})
		},
		error => {
			return res.json({
				fulfillmentText: 'Could not get results at this time',
				source: 'getmovie'
			})
		}
	)
});
*/
