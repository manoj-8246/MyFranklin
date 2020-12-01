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


/****  Incident Management Handler Function ***/
function incidentMgtHandler(req,res,next){	
	try {	 
	   // Call the chat.postMessage method using the built-in WebClient
	    const result = app.client.chat.postMessage({
	      // The token you used to initialize your app
	      token: process.env.TOKEN,
	      channel: process.env.ChannelId,	  
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
					      channel:process.env.ChannelId,	  
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
		      channel: process.env.ChannelId,					  
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
