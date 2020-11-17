var express = require('express');
var bodyParser = require('body-parser')
const rp = require('request-promise');
let libgen = require('../lib/booksearch/index');
const {
    CloudTasksClient
} = require('@google-cloud/tasks');
//const { App } = require('@slack/bolt');
//const got = require('got')
var client = require('smartsheet');
const mysql = require('mysql');
var sortUtil = require('../utils/sortUtil');

// const {
//     App
// } = require('@slack/bolt');

// const app = new App({
//     signingSecret: 'a1f67c38bb7ea1e3273d01ed80bdd9d5',
//     token: 'xoxb-2253441267-734209812229-asyhAglirmT8zbzhVpHA3tT7'
//     // signingSecret: 'e6e78090271d097aba96b01a7840a743',
//     // token: 'xoxb-2253441267-496152507652-UyJGCtu8aPAKU5EV63p94TTK'
//   });

const connectionName =
    process.env.INSTANCE_CONNECTION_NAME || 'ffn-chatbot-weather-dev:us-central1:ffn-itbot';
const dbUser = process.env.SQL_USER || 'root';
const dbPassword = process.env.SQL_PASSWORD || 'zgH2qblz6iB9bpB7';
const dbName = process.env.SQL_NAME || 'franklin';

const mysqlConfig = {
    connectionLimit: 20,
    user: dbUser,
    password: dbPassword,
    database: dbName //,
    //    multipleStatements: true
};
const dailyTodoMembers = [
    // "U0L9YT2L9",
    // "U1Q52KW1F",
    // "U32EKTZ9Q",
    // "U5FDN80EQ",
    // "UAD8Z6SVC",
    // "UB0UMEGBT",
    // "UDEQQS8BT",
    "UDFLSFTL5"
    //"UDN9K01UL",
    //"UG9K6MDUH"
];

// const app = new App({
//     signingSecret: 'e6e78090271d097aba96b01a7840a743',
//     token: 'xoxb-2253441267-496152507652-UyJGCtu8aPAKU5EV63p94TTK'
// });

mysqlConfig.socketPath = `/cloudsql/${connectionName}`;
//mysqlConfig.socketPath = `${connectionName}`;

var slackUser = '';

// Connection pools reuse connections between invocations,
// and handle dropped or expired connections automatically.
let mysqlPool;

// Connection pools reuse connections between invocations,
// and handle dropped or expired connections automatically.



var router = express.Router();

router.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

var urlencodedParser = bodyParser.urlencoded({
    extended: false
})

router.use(bodyParser.json()); // to support JSON-encoded bodies
router.use(bodyParser.urlencoded({ // to support URL-encoded bodies
    extended: true
}));


String.prototype.replaceAll = function (str1, str2, ignore) {
    return this.replace(new RegExp(str1.replace(/([\/\,\!\\\^\$\{\}\[\]\(\)\.\*\+\?\|\-\&])/g, "\\$&"), (ignore ? "gi" : "g")), (typeof (str2) == "string") ? str2.replace(/\$/g, "$$$$") : str2);
};

String.prototype.trimEllip = function (length) {
    return this.length > length ? this.substring(0, length) + "..." : this;
}



function convertUTCDateToLocalDate(date) {
    var newDate = new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000);

    var offset = date.getTimezoneOffset() / 60;
    var hours = date.getHours();

    newDate.setHours(hours - 7);

    return newDate;
}

// app.event('reaction_added', ({
//     event,
//     say
// }) => {
//     console.log("reaction_added called");
//     if (event.reaction === 'calendar') {
//         say({
//             blocks: [{
//                 "type": "section",
//                 "text": {
//                     "type": "mrkdwn",
//                     "text": "Pick a date for me to remind you"
//                 },
//                 "accessory": {
//                     "type": "datepicker",
//                     "action_id": "datepicker_remind",
//                     "initial_date": "2019-04-28",
//                     "placeholder": {
//                         "type": "plain_text",
//                         "text": "Select a date"
//                     }
//                 }
//             }]
//         });
//     }
// });


function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function convertToTime(unix_timestamp) {
    var date = new Date(unix_timestamp * 1000);
    // Hours part from the timestamp
    var hours = date.getHours();
    // Minutes part from the timestamp
    var minutes = "0" + date.getMinutes();
    // Seconds part from the timestamp
    var seconds = "0" + date.getSeconds();

    // Will display time in 10:30:23 format
    var formattedTime = hours + ':' + minutes.substr(-2) + ':' + seconds.substr(-2);
    return formattedTime;
}

async function queueTask(slackId, channelId, slackPayload, inSeconds = 0) {
    const client = new CloudTasksClient();

    const project = 'ffn-chatbot-weather-dev';
    const queue = 'ffn-franklin-queue';
    const location = 'us-central1';

    const parent = client.queuePath(project, location, queue);

    const task = {
        appEngineHttpRequest: {
            httpMethod: 'POST',
            relativeUri: '/gcptasks/taskhandler',
            service: 'default'
        }
    };
    var taskPaylaod = {
        "slackUserId": slackId,
        "channelId": channelId,
        "data": slackPayload
    };


    if (taskPaylaod) {
        task.appEngineHttpRequest.body = Buffer.from(JSON.stringify(taskPaylaod)).toString('base64');
    }

    if (inSeconds) {
        // The time when the task is scheduled to be attempted.
        task.scheduleTime = {
            seconds: inSeconds + Date.now() / 1000,
        };
    }

    // Send create task request.
    const request = {
        parent,
        task
    };
    const [response] = await client.createTask(request);
    const name = response.name;
}

function addSlackSection(sectionText) {
    var returnJson = {
        "type": "section",
        "text": {
            "type": "plain_text",
            "text": sectionText,
            "emoji": true
        }
    };
    return returnJson;

}

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


function addSlackContext(contextText) {
    var returnJson = {
        "type": "context",
        "elements": [{
            "type": "mrkdwn",
            "text": contextText
        }]
    };
    return returnJson;

}

function addSlackDivider(sectionText) {
    var returnJson = {
        "type": "divider"
    };
    return returnJson;
}

function addUpdateUserMap(userId, channelId) {
    if (!mysqlPool) {
        mysqlPool = mysql.createPool(mysqlConfig);
    }
    mysqlPool.query("INSERT INTO usermap (user,channel) VALUES ('" + userId + "','" + channelId + "') ON DUPLICATE KEY UPDATE channel='" + channelId + "'", (err, results) => {
        if (err) {
            console.log("ERROR GETTING creating usermap: " + err);
            res.status(400).send("Geeesh it didn't work there was an error. Check the error log.");
        }
    });
}

function listAllFFNDictionaryHandler(req, res, next) {
    var totalWordsFound = 0;
    var blocks = [];
    if (!mysqlPool) {
        mysqlPool = mysql.createPool(mysqlConfig);
    }

    mysqlPool.query("SELECT * from `ffn_dictionary` ORDER BY word asc", (err, results) => {
        if (err) {
            console.log("Error FETCHING to ffn_dictionary db: " + err);
            //res.status(500).send(err);
        } else {
            var wordData = {
                "data": results
            };

            totalWordsFound = wordData.data.length;
            blocks.push(addMrkUpSlackSection("*FFN Dictionary*"));
            for (var i = 0; i < totalWordsFound; i++) {

                blocks.push(addMrkUpSlackSection("*Definition: " + wordData.data[i].word + "*\n\n" + wordData.data[i].definition));



                if (totalWordsFound > 1 && i < totalWordsFound) {
                    blocks.push(addSlackDivider());
                }


            }

            if (totalWordsFound > 0) {

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

            }
        }
    });
}

function bookSearchHandler(req, res, next) {

    var blocks = [];
    var bookToSearch = '';
    // queue request. 
    queueTask(req.body.originalDetectIntentRequest.payload.data.event.user, req.body.originalDetectIntentRequest.payload.data.event.channel, req.body);

    if (req.body.queryResult.queryText) {
        bookToSearch = req.body.queryResult.queryText.toLowerCase().replace(/lookup: /g, "").replace(/search book: /g, "").replace(/book: /g, "").trim();
    }
    
    blocks.push(addMrkUpSlackSection("*Book Search In Progress ...*\nPlease standby as I fetch books matching *" + bookToSearch + "*"));

    var payloadSlack = {
        "payload": {
            "slack": {
                "attachments": [{
                    "blocks": blocks
                }]
            },
            "outputContexts": [{
                "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/bookSearch"
            }]
        }
    };
    res.send(payloadSlack);
}

function saveBookData(slackUserId, bookId, title, author, language, fileSize, extension, download, bookImage) {

    if (!mysqlPool) {
        mysqlPool = mysql.createPool(mysqlConfig);
    }

    mysqlPool.query('INSERT into `ebooks` (slack_id,book_id,title,author,language,`file_size`,extension,download,`book_image`) VALUES ("' + slackUserId + '","' + bookId + '","' + title + '","' + author + '","' + language + '","' + fileSize + '","' + extension + '","' + download + '","' + bookImage + '") ON DUPLICATE KEY UPDATE title="' + title + '"', (err, results) => {
        if (err) {
            console.log("Unable to add book item to ebooks for " + slackUserId + " Error: " + err);
        }
    });
}

function sendBlocksToUser(channelId, messageTitle, blocksToSend) {
    var options = {
        method: 'POST',
        url: 'https://slack.com/api/chat.postMessage',
        headers: {
            Accept: 'application/json',
            "Content-Type": "application/json; charset=utf-8",
            Authorization: 'Bearer xoxb-2253441267-496152507652-UyJGCtu8aPAKU5EV63p94TTK'
        },
        body: {
            channel: channelId, //channelId,
            link_names: true,
            text: messageTitle,
            blocks: blocksToSend
        },
        json: true

    };
    return rp(options)
        .then(results => {});
}

function wordLookupHandler(req, res, next) {
    var wordToSearch = '';
    var blocks = [];
    var totalWordsFound = 0;
    if (req.body.queryResult.queryText) {
        wordToSearch = req.body.queryResult.queryText.toLowerCase().replace(/lookup: /g, "").replace(/lookup /g, "").replace(/meaning of: /g, "").replace(/meaning of /g, "").replace(/what is: /g, "").replace(/what is /g, "").replace(/define: /g, "").replace(/define /g, "").trim();
    }

    if (!mysqlPool) {
        mysqlPool = mysql.createPool(mysqlConfig);
    }

    mysqlPool.query("SELECT * from `ffn_dictionary` WHERE `key_words` like '%" + wordToSearch + "%'", (err, results) => {
        if (err) {
            console.log("Error FETCHING to ffn_dictionary db: " + err);
            //res.status(500).send(err);
        } else {
            var wordData = {
                "data": results
            };

            /* structure looks like this here. 
            
            {"data":[{"id":1,"word":"SUIP","key_words":"SUIP","definition":"Sales and Underwriting Infrastructure Project","added_by":"UDFLSFTL5","mod_on":null,"mod_by":null,"created_on":"2019-10-10T18:54:47.000Z"}]}
            {
                                    "type": "actions",
                                    "elements": [{
                                            "type": "button",
                                            "text": {
                                                "type": "plain_text",
                                                "emoji": true,
                                                "text": "Tell Me a Dad Joke"
                                            },
                                            "style": "primary",
                                            "value": "click_another_joke"
                                        },
                                        {
                                            "type": "button",
                                            "text": {
                                                "type": "plain_text",
                                                "emoji": true,
                                                "text": "Tell Me a Lawyer Joke"
                                            },
                                            "style": "primary",
                                            "value": "click_lawyer_joke"
                                        },
                                        {
                                            "type": "button",
                                            "text": {
                                                "type": "plain_text",
                                                "emoji": true,
                                                "text": "Tell Me a IT Joke"
                                            },
                                            "style": "primary",
                                            "value": "click_it_joke"
                                        }
                                    ]
                                }

            */


            totalWordsFound = wordData.data.length;
            blocks.push(addMrkUpSlackSection("*FFN Dictionary*"));
            for (var i = 0; i < totalWordsFound; i++) {

                blocks.push(addMrkUpSlackSection("*Definition: " + wordData.data[i].word + "*\n\n" + wordData.data[i].definition));



                if (totalWordsFound > 1 && i < totalWordsFound) {
                    blocks.push(addSlackDivider());
                }


            }

            if (totalWordsFound > 0) {

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
                            "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/defineThisWord"
                        }]
                    }
                };
                //console.log(payloadSlack);
                res.send(payloadSlack);
            } else {
                var payloadSlack = {
                    "payload": {
                        "slack": {
                            "attachments": [{
                                "blocks": [{
                                        "type": "section",
                                        "text": {
                                            "type": "mrkdwn",
                                            "text": "*FFN Dictionary*\nThe word *" + wordToSearch + "* was not found.\nAdd the definition by clicking the button below"
                                        }
                                    },
                                    {
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
                                    }
                                ]
                            }]
                        },
                        "outputContexts": [{
                            "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/defineThisWord"
                        }]
                    }
                };

                res.send(payloadSlack);
            }

        }
    });


    //TODO add showing the slack words that are found along with a button to add new words or update the existing words. 


    // var payloadSlack = {
    //     "blocks": [{
    //             "type": "section",
    //             "text": {
    //                 "type": "mrkdwn",
    //                 "text": "*Your word was added*"
    //             }
    //         },
    //         {
    //             "type": "section",
    //             "fields": [{
    //                 "type": "mrkdwn",
    //                 "text": "*Word*\n" + dictWord
    //             }]
    //         },
    //         {
    //             "type": "actions",
    //             "elements": [{
    //                 "type": "button",
    //                 "text": {
    //                     "type": "plain_text",
    //                     "emoji": true,
    //                     "text": "Add New Word"
    //                 },
    //                 "style": "primary",
    //                 "value": "add_another_word"
    //             }]
    //         }
    //     ]
    // };

}

function showDialogAddWord(triggerId) {
    var slackDialogUrl = "https://slack.com/api/dialog.open?trigger_id=" + triggerId + '&dialog=%7B%22callback_id%22%3A%22newwordjack%22%2C%22title%22%3A%22Add%20New%20Definition%22%2C%22submit_label%22%3A%22Submit%22%2C%22state%22%3A%22Limo%22%2C%22elements%22%3A%5B%7B%22type%22%3A%20%22text%22%2C%22label%22%3A%20%22Word%22%2C%22name%22%3A%20%22dict_word%22%7D%2C%7B%22type%22%3A%20%22text%22%2C%22label%22%3A%20%22Key%20word%20list%22%2C%22name%22%3A%20%22dict_key_words%22%7D%2C%7B%22type%22%3A%20%22textarea%22%2C%22label%22%3A%20%22Definition%22%2C%22name%22%3A%20%22dict_def%22%7D%5D%7D';
    var options = {
        method: 'POST',
        url: slackDialogUrl,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: 'Bearer xoxb-2253441267-496152507652-UyJGCtu8aPAKU5EV63p94TTK'
        }
    };
    return rp(options)
        .then(body => {

            console.log("show dialog add word: " + JSON.stringify(body));
            //res.status(200).send();
        });
}

function taskManagerHandler(req, res, next) {

    addUpdateUserMap(req.body.originalDetectIntentRequest.payload.data.event.user, req.body.originalDetectIntentRequest.payload.data.event.channel);
    var payloadSlack = {
        "payload": {
            "slack": {
                "attachments": [{
                    "blocks": [{
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": "*Daily Task Manager*\nUse to manage my daily tasks."
                            }
                        },
                        {
                            "type": "actions",
                            "elements": [{
                                    "type": "button",
                                    "text": {
                                        "type": "plain_text",
                                        "text": "Add New Task",
                                        "emoji": true
                                    },
                                    "style": "primary",
                                    "value": "todo_add_new_task"
                                },
                                {
                                    "type": "button",
                                    "text": {
                                        "type": "plain_text",
                                        "text": "View Incomplete Tasks",
                                        "emoji": true
                                    },
                                    "style": "primary",
                                    "value": "todo_view_incompleted_tasks"
                                },
                                {
                                    "type": "button",
                                    "text": {
                                        "type": "plain_text",
                                        "text": "View Completed Tasks",
                                        "emoji": true
                                    },
                                    "style": "primary",
                                    "value": "todo_view_completed_tasks"
                                },
                                {
                                    "type": "button",
                                    "text": {
                                        "type": "plain_text",
                                        "text": "View Tasks Due Today",
                                        "emoji": true
                                    },
                                    "style": "primary",
                                    "value": "todo_tasks_due_today"
                                },
                                {
                                    "type": "button",
                                    "text": {
                                        "type": "plain_text",
                                        "text": "View Tasks Due This Week",
                                        "emoji": true
                                    },
                                    "style": "primary",
                                    "value": "todo_weekly_tasks"
                                }

                            ]
                        }
                    ]
                }]
            },
            "outputContexts": [{
                "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/taskManager"
            }]

        }
    };

    res.send(payloadSlack);
}

function showAddToDoModal(triggerId, slackUserId) {
    try {
        var payloadSlack = {
            "trigger_id": triggerId,
            "view": {
                "type": "modal",
                "callback_id": "addtodox9ml",
                "title": {
                    "type": "plain_text",
                    "text": "Add New Todo",
                    "emoji": true
                },
                "submit": {
                    "type": "plain_text",
                    "text": "Submit",
                    "emoji": true
                },
                "close": {
                    "type": "plain_text",
                    "text": "Cancel",
                    "emoji": true
                },
                "blocks": [{
                        "type": "input",
                        "block_id": "tsk_title",
                        "label": {
                            "type": "plain_text",
                            "text": "Task title"
                        },
                        "element": {
                            "type": "plain_text_input",
                            "action_id": "title"
                        }
                    },
                    {
                        "type": "input",
                        "block_id": "tsk_desc",
                        "label": {
                            "type": "plain_text",
                            "text": "Task description"
                        },
                        "element": {
                            "type": "plain_text_input",
                            "multiline": true,
                            "action_id": "description"
                        }
                    },
                    {

                        "type": "input",
                        "block_id": "tsk_start",
                        "label": {
                            "type": "plain_text",
                            "text": "Pick a start date"
                        },
                        "element": {

                            "type": "datepicker",
                            "action_id": "start",
                            "placeholder": {
                                "type": "plain_text",
                                "text": "Select a date",
                                "emoji": true
                            }
                        }
                    },
                    {

                        "type": "input",
                        "block_id": "tsk_finish",
                        "label": {
                            "type": "plain_text",
                            "text": "Pick a finish date"
                        },
                        "element": {

                            "type": "datepicker",
                            "action_id": "finish",
                            "placeholder": {
                                "type": "plain_text",
                                "text": "Select a date",
                                "emoji": true
                            }
                        }
                    }

                ]
            }
        };

        var options = {
            method: 'POST',
            url: 'https://slack.com/api/views.open',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                Authorization: 'Bearer xoxb-2253441267-496152507652-UyJGCtu8aPAKU5EV63p94TTK'
            },
            body: JSON.stringify(payloadSlack)
        };

        return rp(options)
            .then(body => {
                var jsonData = JSON.parse(body);
                console.log(" slack modal response: " + JSON.stringify(jsonData));
            })
            .catch(function (err) {
                logError(err, slackUserId, 'DisplayTodoForm', 'showAddToDoModal');
                console.log('slack api views.open error occured.' + err);
            });

        //     var options = {
        //     method: 'POST',
        //     url: 'https://slack.com/api/views.open?trigger_id=' + triggerId + '&view=%7B%22trigger_id%22%3AtriggerId%2C%22view%22%3A%7B%22type%22%3A%22modal%22%2C%22callback_id%22%3A%22addtodox9ml%22%2C%22title%22%3A%7B%22type%22%3A%22plain_text%22%2C%22text%22%3A%22Add%20New%20Todo%22%2C%22emoji%22%3Atrue%7D%2C%22submit%22%3A%7B%22type%22%3A%22plain_text%22%2C%22text%22%3A%22Submit%22%2C%22emoji%22%3Atrue%7D%2C%22close%22%3A%7B%22type%22%3A%22plain_text%22%2C%22text%22%3A%22Cancel%22%2C%22emoji%22%3Atrue%7D%2C%22blocks%22%3A%5B%7B%22type%22%3A%22input%22%2C%22block_id%22%3A%22tsk_title%22%2C%22label%22%3A%7B%22type%22%3A%22plain_text%22%2C%22text%22%3A%22Task%20title%22%7D%2C%22element%22%3A%7B%22type%22%3A%22plain_text_input%22%2C%22action_id%22%3A%22title%22%7D%7D%2C%7B%22type%22%3A%22input%22%2C%22block_id%22%3A%22tsk_desc%22%2C%22label%22%3A%7B%22type%22%3A%22plain_text%22%2C%22text%22%3A%22Task%20description%22%7D%2C%22element%22%3A%7B%22type%22%3A%22plain_text_input%22%2C%22multiline%22%3Atrue%2C%22action_id%22%3A%22description%22%7D%7D%2C%7B%22type%22%3A%22input%22%2C%22block_id%22%3A%22tsk_start%22%2C%22label%22%3A%7B%22type%22%3A%22plain_text%22%2C%22text%22%3A%22Pick%20a%20start%20date%22%7D%2C%22element%22%3A%7B%22type%22%3A%22datepicker%22%2C%22action_id%22%3A%22start%22%2C%22placeholder%22%3A%7B%22type%22%3A%22plain_text%22%2C%22text%22%3A%22Select%20a%20date%22%2C%22emoji%22%3Atrue%7D%7D%7D%2C%7B%22type%22%3A%22input%22%2C%22block_id%22%3A%22tsk_finish%22%2C%22label%22%3A%7B%22type%22%3A%22plain_text%22%2C%22text%22%3A%22Pick%20a%20finish%20date%22%7D%2C%22element%22%3A%7B%22type%22%3A%22datepicker%22%2C%22action_id%22%3A%22finish%22%2C%22placeholder%22%3A%7B%22type%22%3A%22plain_text%22%2C%22text%22%3A%22Select%20a%20date%22%2C%22emoji%22%3Atrue%7D%7D%7D%5D%7D%7D',
        //     headers: {
        //         Accept: 'application/x-www-form-urlencoded',
        //         Authorization: 'Bearer xoxb-2253441267-496152507652-UyJGCtu8aPAKU5EV63p94TTK'
        //     }
        // };

        // return rp(options)
        //     .then(body => {
        //         var jsonData = JSON.parse(body);
        //         console.log(" slack modal response: " + JSON.stringify(jsonData));
        //     });



        // var options = {
        //     method: 'POST',
        //     url: 'https://slack.com/api/views.open?trigger_id=' + triggerId + '&view=%7B%22type%22%3A%22modal%22%2C%22callback_id%22%3A%22addtodox9ml%22%2C%22title%22%3A%7B%22type%22%3A%22plain_text%22%2C%22text%22%3A%22Add%20New%20Todo%22%2C%22emoji%22%3Atrue%7D%2C%22submit%22%3A%7B%22type%22%3A%22plain_text%22%2C%22text%22%3A%22Submit%22%2C%22emoji%22%3Atrue%7D%2C%22close%22%3A%7B%22type%22%3A%22plain_text%22%2C%22text%22%3A%22Cancel%22%2C%22emoji%22%3Atrue%7D%2C%22blocks%22%3A%5B%7B%22type%22%3A%22input%22%2C%22block_id%22%3A%22edit-task-title%22%2C%22label%22%3A%7B%22type%22%3A%22plain_text%22%2C%22text%22%3A%22Task%20title%22%7D%2C%22element%22%3A%7B%22type%22%3A%22plain_text_input%22%2C%22action_id%22%3A%22todo-title-value%22%7D%7D%2C%7B%22type%22%3A%22input%22%2C%22block_id%22%3A%22edit-ticket-desc%22%2C%22label%22%3A%7B%22type%22%3A%22plain_text%22%2C%22text%22%3A%22Task%20description%22%7D%2C%22element%22%3A%7B%22type%22%3A%22plain_text_input%22%2C%22multiline%22%3Atrue%2C%22action_id%22%3A%22todo-desc-value%22%7D%7D%2C%7B%22type%22%3A%22section%22%2C%22text%22%3A%7B%22type%22%3A%22mrkdwn%22%2C%22text%22%3A%22Pick%20a%20start%20date.%22%7D%2C%22accessory%22%3A%7B%22type%22%3A%22datepicker%22%2C%22action_id%22%3A%22todo-start-date%22%2C%22placeholder%22%3A%7B%22type%22%3A%22plain_text%22%2C%22text%22%3A%22Select%20a%20date%22%2C%22emoji%22%3Atrue%7D%7D%7D%2C%7B%22type%22%3A%22section%22%2C%22text%22%3A%7B%22type%22%3A%22mrkdwn%22%2C%22text%22%3A%22Pick%20a%20finish%20date.%22%7D%2C%22accessory%22%3A%7B%22type%22%3A%22datepicker%22%2C%22action_id%22%3A%22todo-finish-date%22%2C%22placeholder%22%3A%7B%22type%22%3A%22plain_text%22%2C%22text%22%3A%22Select%20a%20date%22%2C%22emoji%22%3Atrue%7D%7D%7D%5D%7D',
        //     headers: {
        //         Accept: 'application/x-www-form-urlencoded',
        //         Authorization: 'Bearer xoxb-2253441267-496152507652-UyJGCtu8aPAKU5EV63p94TTK'
        //     }
        // };

        // return rp(options)
        //     .then(body => {
        //         var jsonData = JSON.parse(body);
        //         console.log(" slack modal response: " + JSON.stringify(jsonData));
        //     });
    } catch (err) {
        logError(err, slackUserId, 'DisplayTodoForm', 'showAddToDoModal try-catch');
        console.log('slack api views.open error occured.' + err);
    }

}

function orderCafeteriaHandler(req, res, next) {
    var payloadSlack = {
        "payload": {
            "slack": {
                "attachments": [{
                    "blocks": [{
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": "*Order Food Online from the Rio 2 Cafeteria*"
                            }
                        },
                        {
                            "type": "actions",
                            "elements": [{
                                "type": "button",
                                "text": {
                                    "type": "plain_text",
                                    "emoji": true,
                                    "text": "Order Food"
                                },
                                "url": "https://orders.freedomfinancialcafe.com",
                                "style": "primary",
                                "value": "click_do_nothing"
                            }]
                        }
                    ]
                }]
            },
            "outputContexts": [{
                "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/orderCafeteria"
            }]
        }
    };
    res.send(payloadSlack);
}



function createNewTodoHandler(req, res, next) {
    console.log("received from Slack: " + JSON.stringify(req.body));

    res.send("Adding your todo request");
}

function managerReportHandler(req, res, next) {

    var payloadSlack = {
        "payload": {
            "slack": {
                "attachments": [{
                    "blocks": [{
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": "*CREATE TEAM REPORT*\nBy date range by team member"
                            }
                        },
                        {
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": "Pick team member from list"
                            },
                            "accessory": {
                                "type": "multi_static_select",
                                "placeholder": {
                                    "type": "plain_text",
                                    "text": "Select a member",
                                    "emoji": true
                                },
                                "options": [{
                                        "text": {
                                            "type": "plain_text",
                                            "text": "Glenn",
                                            "emoji": true
                                        },
                                        "value": "value-0"
                                    },
                                    {
                                        "text": {
                                            "type": "plain_text",
                                            "text": "Jay",
                                            "emoji": true
                                        },
                                        "value": "value-1"
                                    },
                                    {
                                        "text": {
                                            "type": "plain_text",
                                            "text": "Robbie",
                                            "emoji": true
                                        },
                                        "value": "value-2"
                                    },
                                    {
                                        "text": {
                                            "type": "plain_text",
                                            "text": "Georgina",
                                            "emoji": true
                                        },
                                        "value": "value-3"
                                    }
                                ]
                            }
                        },
                        {
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": "Pick a start date."
                            },
                            "accessory": {
                                "type": "datepicker",
                                "initial_date": "2019-10-03",
                                "placeholder": {
                                    "type": "plain_text",
                                    "text": "Select a date",
                                    "emoji": true
                                }
                            }
                        },
                        {
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": "Pick an end date."
                            },
                            "accessory": {
                                "type": "datepicker",
                                "initial_date": "2019-10-04",
                                "placeholder": {
                                    "type": "plain_text",
                                    "text": "Select a date",
                                    "emoji": true
                                }
                            }
                        },
                        {
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": "Pick a report template."
                            },
                            "accessory": {
                                "type": "static_select",
                                "placeholder": {
                                    "type": "plain_text",
                                    "text": "Select a report",
                                    "emoji": true
                                },
                                "options": [{
                                        "text": {
                                            "type": "plain_text",
                                            "text": "Productivity",
                                            "emoji": true
                                        },
                                        "value": "value-0"
                                    },
                                    {
                                        "text": {
                                            "type": "plain_text",
                                            "text": "View closed items",
                                            "emoji": true
                                        },
                                        "value": "value-1"
                                    },
                                    {
                                        "text": {
                                            "type": "plain_text",
                                            "text": "View open items",
                                            "emoji": true
                                        },
                                        "value": "value-2"
                                    },
                                    {
                                        "text": {
                                            "type": "plain_text",
                                            "text": "Calculate Bonuses",
                                            "emoji": true
                                        },
                                        "value": "value-3"
                                    },
                                    {
                                        "text": {
                                            "type": "plain_text",
                                            "text": "FTE Estimate to Execute Plan",
                                            "emoji": true
                                        },
                                        "value": "value-4"
                                    },
                                    {
                                        "text": {
                                            "type": "plain_text",
                                            "text": "Distribute Unasigned Work (AI)",
                                            "emoji": true
                                        },
                                        "value": "value-5"
                                    },
                                    {
                                        "text": {
                                            "type": "plain_text",
                                            "text": "Leaderboard",
                                            "emoji": true
                                        },
                                        "value": "value-6"
                                    }
                                ]
                            }
                        },
                        {
                            "type": "actions",
                            "elements": [{
                                    "type": "button",
                                    "text": {
                                        "type": "plain_text",
                                        "emoji": true,
                                        "text": "VIEW REPORT"
                                    },
                                    "style": "primary",
                                    "value": "click_view_mgr_report"
                                },
                                {
                                    "type": "button",
                                    "text": {
                                        "type": "plain_text",
                                        "emoji": true,
                                        "text": "CANCEL"
                                    },
                                    "style": "danger",
                                    "value": "click_do_nothing"
                                }
                            ]
                        }
                    ]
                }]
            },
            "outputContexts": [{
                "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/managerReport"
            }]
        }
    };
    res.send(payloadSlack);
}


var cities = ["Etc/GMT+10", // hawaii 
    "America/Anchorage",
    "America/Los_Angeles",
    "America/Phoenix",
    "America/Denver",
    "America/Chicago",
    "America/New_York",
    "Etc/GMT-4" // armenia time 
];


var timeNowByLocation = {
    currentIndex: 0,

    getTimeNow: function (timeData) {

        return rp({
            "method": "GET",
            "uri": 'http://worldtimeapi.org/api/timezone/' + cities[timeNowByLocation.currentIndex],
            "json": true,
            "headers": {
                "Accept": "application/json"
            }
        }).then(function (response) {
            if (!timeData) {
                timeData = [];
            }
            timeData = timeData.concat(response);
            timeNowByLocation.currentIndex++;
            if (timeNowByLocation.currentIndex < cities.length) {

                return timeNowByLocation.getTimeNow(timeData);
            }
            return timeData;
        });
    }
}


var ssheets = {
    // smartsheet: client.createClient({
    //     accessToken: 'mcb931esji6tlnxteyk2016ndh',
    //     logLevel: 'error',
    // }),



    getProjects: function () {

        return rp({
            method: 'GET',
            url: 'https://api.smartsheet.com/2.0/workspaces/4899343921637252',
            headers: {
                Accept: 'application/json',
                Authorization: 'Authorization: Bearer mcb931esji6tlnxteyk2016ndh'
            }
        });
    },
    getSheet: function (sheetIds) {

        return rp({
            method: 'GET',
            url: 'https://api.smartsheet.com/2.0/sheets/' + sheetIds.sheets.id,
            headers: {
                Accept: 'application/json',
                Authorization: 'Authorization: Bearer mcb931esji6tlnxteyk2016ndh'
            }
        });
    }


    // isPublic: function(sheetInfo,userid) {
    //   return sheetInfo.sheets
    // },

    // isOriginal: function(repo) {
    //   return !repo.fork;
    // },

    // licenseUrl: function(repo) {
    //   return repo.contents_url.replace(/\{\+path\}/,"LICENSE");
    // },

    // checkLicense: function(uri) {
    //   return request({
    //     "method": "GET",
    //     "uri": uri,
    //     "json": true,
    //     "headers": {
    //       "Authorization": "Bearer " + github.token,
    //       "User-Agent": "My little demo app"
    //     }
    //   }).then(function(fulfilled_body) {
    //     return false;
    //   }, function(rejected_body){
    //     return uri;
    //   });
    // },

    // isMissing: function(license) {
    //   return license;
    // },

    // createLicenseLink: function(license) {
    //   return license.replace(/https:\/\/api.github.com\/repos\/(.*)\/(.*)\/contents\/LICENSE/, "https://github.com/$1/$2/new/master?filename=LICENSE");
    // }
}

function ofcourse() {

    return ssheets.getProjects()
        .then(ssheets.getSheet);
    //.then();
    //   .then(github.getUserRepos)
    //   .filter(github.isPublic)
    //   .filter(github.isOriginal)
    /*.map(github.licenseUrl)
    .map(github.checkLicense)
    .filter(github.isMissing)
    .map(github.createLicenseLink)*/
}

//   main({"token": process.argv[2]}).then(function(result) {
//     console.log(result);
//   });

function getAllTimes() {
    timeNowByLocation.currentIndex = 0;
    return timeNowByLocation.getTimeNow();
}

function logRequests(queryText, slackUser, slackTS, intent, channel) {
    // var retSuccess = false;
    if (!mysqlPool) {
        mysqlPool = mysql.createPool(mysqlConfig);
    }

    mysqlPool.query('INSERT into requests (queryText,user,ts,intent,channel) VALUES ("' + queryText + '","' + slackUser + '","' + slackTS + '","' + intent + '","' + channel + '")', (err, results) => {
        if (err) {
            console.log("Error Writing to requests db: " + err);
            //res.status(500).send(err);
        } else {
            //console.log("dbResults: " + results);
            //retSuccess = true;
            //res.send(JSON.stringify(results));
        }
    });
    //return retSuccess;
}



function logError(error, slackUser, intent, function_name) {
    var retSuccess = false;
    if (!mysqlPool) {
        mysqlPool = mysql.createPool(mysqlConfig);
    }

    mysqlPool.query("INSERT into log (error,user,intent,function) VALUES ('" + error + "','" + slackUser + "','" + intent + "','" + function_name + "')", (err, results) => {
        if (err) {
            console.log("Analytics Error" + err);
            //res.status(500).send(err);
        } else {
            //console.log("dbResults: " + results);
            retSuccess = true;
            //res.send(JSON.stringify(results));
        }
    });
    return retSuccess;
}


function getAllTimesForEachCity(req, res, next) {
    var fieldsArray = [];
    getAllTimes().then(function (result) {
        for (var i = 0; i < result.length; i++) {
            var objData = result[i];
            var currentHour = parseInt()
            var timestring = "" + objData.datetime
            var hourCode = "AM";
            var currentHour = parseInt(timestring.trim().substr(11, 2));
            if (currentHour > 12) {
                currentHour = currentHour - 12;
                hourCode = "PM";
            } else if (currentHour === 0) {
                currentHour = 12;
            }
            if (objData.timezone === 'Etc/GMT+10') {

                fieldsArray.push({
                    "title": "America/Hawaii (HST)",

                    "value": timestring.substr(0, 10) + " " + currentHour + timestring.substr(13, 3) + " " + hourCode,
                    "short": true
                });

            } else if (objData.timezone === 'Etc/GMT-4') {

                fieldsArray.push({
                    "title": "Armenia (AMT)",
                    "value": timestring.substr(0, 10) + " " + currentHour + timestring.substr(13, 3) + " " + hourCode,
                    "short": true
                });



            } else {

                fieldsArray.push({
                    "title": objData.timezone + " (" + objData.abbreviation + ")",
                    "value": timestring.substr(0, 10) + " " + currentHour + timestring.substr(13, 3) + " " + hourCode,
                    "short": true
                });
            }
        }

        var payloadSlack = {
            "payload": {
                "slack": {
                    "text": "*Current Time - Multiple Time Zones*",
                    "attachments": [{

                        "text": "",
                        "fallback": "*Current Time - Multiple Time Zones*",
                        "color": "#3AA3E3",
                        "attachment_type": "default",
                        "title": "",
                        "fields": fieldsArray
                    }]
                },
                "outputContexts": [{
                    "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/TimeNow"
                }]
            }
        };
        res.send(payloadSlack);
    });
}


var jiraData = {
    token: 'Z25laWdlckBmcmVlZG9tZmluYW5jaWFsbmV0d29yay5jb206ODVzSWNSSExTRGVua3VkaVlndkU0MUJG',
    currOffset: 200,
    searchFor: '',

    getIssues: function (uri, issues) {
        return rp({
                "method": "GET",
                "uri": uri,
                "json": true,
                "headers": {
                    "Authorization": "Basic " + jiraData.token,
                    "Accept": "application/json"
                }
            }).then(function (response) {
                if (!issues) {
                    issues = [];
                }
                // console.log(response);
                issues = issues.concat(response.issues);
                //console.log(issues.length + " issues so far");
                if (jiraData.currOffset < response.total) {
                    //console.log("There is more.");
                    var next = "https://billsdev.atlassian.net/rest/agile/1.0/board/305/issue?maxResults=200&startAt=" + jiraData.currOffset.toString();
                    jiraData.currOffset = jiraData.currOffset + response.maxResults;
                    //console.log("maxResults: " + response.maxResults);
                    return jiraData.getIssues(next, issues);
                }
                issues = issues.sort(sortUtil.compareTitle);
                //console.log("total: " + issues.length);
                return issues;
            })
            .catch(function (err) {
                logError(err, req.body.originalDetectIntentRequest.payload.data.event.user, 'JIRA-SpecProj', 'jiraData.getIssues');
                console.log('weatherHandler error occured.' + err);
            });
    },

    isNotDoneOrReleased: function (issues) {
        return issues.fields.status.name !== "Done" && issues.fields.status.name !== "Released";
    },
    isAMatch: function (issues) {
        if (jiraData.searchFor === 'top 10') {
            return true;
        } else {
            return issues.fields.summary.toLowerCase().includes(jiraData.searchFor.trim().toLowerCase());
        }
    }
}

function getAllJiraProjects() {

    // if (jiraData.searchFor !== 'top 10') { // if not top 10 filter search results. 
    return jiraData.getIssues('https://billsdev.atlassian.net/rest/agile/1.0/board/305/issue?maxResults=200')
        .filter(jiraData.isNotDoneOrReleased)
        .filter(jiraData.isAMatch);
}


function testGetAllJiraProjects(req, res, next) {
    var report = '';
    var projectSlide = '';
    var projSchedule = '';
    var emojiStr = '';
    var attachmentArray = [];
    var actionArray = [];
    var matchCount = 0;
    var status;
    var desc = '';
    // console.log("QueueTask");
    // queueTask(req.body.originalDetectIntentRequest.payload.data.event.user,req.body.originalDetectIntentRequest.payload.data.event.channel, req.body);
    // console.log("done queue task");

    if (req.body.queryResult.queryText) {
        report = req.body.queryResult.queryText.toLowerCase().replace(/status of /g, "").replace(/status /g, "").trim();
    } else {
        report = 'top 10';
    }
    jiraData.searchFor = report;
    jiraData.currOffset = 200;
    //console.log(report);

    getAllJiraProjects().then(function (result) {
        for (var i = 0; i < result.length; i++) {
            //console.log(result[i].key + " " + result[i].fields.summary);
            actionArray = [];

            projectSlide = '';

            projSchedule = '';

            emojiStr = '';
            var objData = result[i];
            desc = "";

            matchCount++;
            if (objData.fields.description !== null) {
                desc = objData.fields.description.replaceAll("*", "•").replace('#', "•");
            }

            var assigneeName = "";
            if (objData.fields.assignee !== null) {
                assigneeName = objData.fields.assignee.displayName;
            }
            status = objData.fields.status.name;
            if (objData.fields.customfield_13939 != null) {
                switch (objData.fields.customfield_13939.value.toLowerCase()) {
                    case "green":

                        emojiStr = " :thumbsup:";
                        break;
                    case "yellow":

                        emojiStr = " :thumbsup::thumbsdown:";
                        break;
                    case "red":
                        emojiStr = " :thumbsdown:";
                        break;
                }
            }
            /*else {
                                   returnProjs = returnProjs + "*Project*: " + objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: " + objData.fields.status.name + "\n" + desc;
                               }*/
            if (objData.fields.customfield_13941 !== null) {
                //returnProjs = returnProjs + "\n*Project Slide*: " + objData.fields.customfield_13941;
                projectSlide = objData.fields.customfield_13941;
            }
            if (objData.fields.customfield_13940 !== null) {
                //returnProjs = returnProjs + "\n*Project Schedule*: " + objData.fields.customfield_13940;
                projSchedule = objData.fields.customfield_13940;
            }

            actionArray.push({
                "text": "View in JIRA",
                "type": "button",
                "url": "https://billsdev.atlassian.net/browse/" + objData.key,
                "style": "primary"

            });

            if (projectSlide !== '') {
                actionArray.push({
                    "text": "View Project Slide",
                    "type": "button",
                    "url": projectSlide,
                    "style": "primary"

                });
            }

            if (projSchedule !== '') {
                actionArray.push({
                    "text": "View Project Schedule",
                    "type": "button",
                    "url": projSchedule,
                    "style": "primary"

                });
            }

            attachmentArray.push({

                "text": "*Highlights*:\n" + desc,
                "fallback": objData.fields.summary,
                "color": "#3AA3E3",
                "attachment_type": "default",
                "title": objData.fields.summary,
                "fields": [{
                        "title": "Assignee",
                        "value": assigneeName,
                        "short": true
                    },
                    {
                        "title": "Status",
                        "value": status + emojiStr,
                        "short": true
                    },
                    {
                        "title": "Epic",
                        "value": objData.fields.epic !== null ? objData.fields.epic.summary : '',
                        "short": true
                    }
                ],
                "actions": actionArray
            });

        }

        if (matchCount > 0) {
            var payloadSlack = {
                "payload": {
                    "slack": {
                        "text": "IT JIRA Projects ...",
                        "attachments": attachmentArray,
                    },
                    "outputContexts": [{
                        "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/JIRA-SpecProj"
                    }]
                }
            };
            res.send(payloadSlack);
        } else {
            var payloadSlack = {
                "payload": {
                    "slack": {
                        "text": "IT JIRA Projects ...",
                        "attachments": [{
                            "text": "Nothing was found while searching for " + report + ". Try again maybe type less words or a specific keyword.",
                            "fallback": "IT JIRA Projects: \nNothing was found while searching for " + report + ". Try again maybe type less words or a specific keyword.",
                            "color": "#3AA3E3",
                            "attachment_type": "default"
                        }]
                    },
                    "outputContexts": [{
                        "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/JIRA-SpecProj"
                    }]
                }
            };
            res.send(payloadSlack);
        }

        //console.log(result);
    });
}

function taskHandlerJiraSearchITProj(slackUserId, channelId, taskData) {
    var report = '';
    var projectSlide = '';
    var projSchedule = '';
    var emojiStr = '';
    var blocksArray = [];
    var actionArray = [];
    var searchResults = [];
    var matchCount = 0;
    var status;


    if (taskData.queryResult.queryText) {
        report = taskData.queryResult.queryResult.queryText.toLowerCase().replace(/status of /g, "").replace(/status /g, "").trim();
    }

    var options = {
        method: 'GET',
        url: 'https://billsdev.atlassian.net/rest/agile/1.0/board/305/issue',
        qs: {
            maxResults: '25',
            jql: 'project = PLAN AND type = "IT Initiative" AND summary ~ "' + report + '*" ORDER BY Rank ASC'
            //  'project%20=%20PLAN%20AND%20type%20=%20%22IT%20Initiative%22%20AND%20summary%20~%20%22'+ encodeURIComponent(report) + '%2A%22%20ORDER%20BY%20Rank%20ASC'
        },
        headers: {
            Accept: 'application/json',
            Authorization: 'Basic Z25laWdlckBmcmVlZG9tZmluYW5jaWFsbmV0d29yay5jb206ODVzSWNSSExTRGVua3VkaVlndkU0MUJG'
        }
    };

    return rp(options)
        .then(body => {
            var jsonData = JSON.parse(body);
            totalItems = jsonData.total;
            for (var j = 0; j < totalItems; j++) {
                var objData = jsonData.issues[j];

                if (objData.fields.status.name !== "Done") {
                    searchResults.push(objData);
                    matchCount++;
                }
            }
            if (matchCount > 1) {
                searchResults = searchResults.sort(sortUtil.compareTitle);
            }
            for (var i = 0; i < searchResults.length; i++) {
                objData = searchResults[i];
                actionArray = [];
                projectSlide = '';
                projSchedule = '';
                emojiStr = '';
                desc = "";

                if (objData.fields.description !== null) {
                    desc = objData.fields.description.replaceAll("*", "•").replace('#', "•");
                }

                var assigneeName = "";
                if (objData.fields.assignee !== null) {
                    assigneeName = objData.fields.assignee.displayName;
                }
                status = objData.fields.status.name;
                if (objData.fields.customfield_13939 != null) {
                    switch (objData.fields.customfield_13939.value.toLowerCase()) {
                        case "green":

                            emojiStr = " :thumbsup:";
                            break;
                        case "yellow":

                            emojiStr = " :thumbsup::thumbsdown:";
                            break;
                        case "red":
                            emojiStr = " :thumbsdown:";
                            break;
                    }
                }
                if (objData.fields.customfield_13941 !== null) {
                    projectSlide = objData.fields.customfield_13941;
                }
                if (objData.fields.customfield_13940 !== null) {
                    projSchedule = objData.fields.customfield_13940;
                }

                blocksArray.push({
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "*Processed from TASK*\n*" + objData.fields.summary + "*"
                    }
                });

                var epicText = objData.fields.epic !== null ? objData.fields.epic.summary : '';

                if (epicText !== '') {
                    blocksArray.push({
                        "type": "section",
                        "fields": [{
                                "type": "mrkdwn",
                                "text": "*Assignee*\n" + assigneeName
                            },
                            {
                                "type": "mrkdwn",
                                "text": "*Status*\n" + status + emojiStr
                            },
                            {
                                "type": "mrkdwn",
                                "text": "*Epic*\n" + epicText
                            }
                        ]
                    });
                } else {
                    blocksArray.push({
                        "type": "section",
                        "fields": [{
                                "type": "mrkdwn",
                                "text": "*Assignee*\n" + assigneeName
                            },
                            {
                                "type": "mrkdwn",
                                "text": "*Status*\n" + status + emojiStr
                            }
                        ]
                    });
                }


                /*
                {
	"blocks": [
		{
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": "*Title*"
			}
		},
		{
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": "*Highlights*\nThis is a plain text section block."
			}
		},
		{
			"type": "section",
			"fields": [
				{
					"type": "mrkdwn",
					"text": "*Assignee*\nJim Thomas"
				},
				{
					"type": "mrkdwn",
					"text": "*Status*\nExecute"
				},
				{
					"type": "mrkdwn",
					"text": "*Epic*\nWhat epic"
				}
			]
		},
		{
            "type": "actions",
            "elements": [{

                "type": "button",
"text": {
                                                "type": "plain_text",
                                                "emoji": true,
                                                "text": "View In JIRA"
                                            },
                                            "style": "primary",
                                            "value": "add_another_word"
                                        }]
                                    }
	]
}
                */
                actionArray.push({
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "emoji": true,
                        "text": "View In JIRA"
                    },
                    "url": "https://billsdev.atlassian.net/browse/" + objData.key,
                    "style": "primary",
                    "value": "click_do_nothing"
                });

                if (projectSlide !== '') {

                    actionArray.push({
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "emoji": true,
                            "text": "View Project Slide"
                        },
                        "url": projectSlide,
                        "style": "primary",
                        "value": "click_do_nothing"
                    });
                }

                if (projSchedule !== '') {
                    actionArray.push({
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "emoji": true,
                            "text": "View Project Schedule",
                        },
                        "url": projSchedule,
                        "style": "primary",
                        "value": "click_do_nothing"
                    });
                }

                blocksArray.push({
                    "type": "actions",
                    "elements": actionArray
                });

                // attachmentArray.push({

                //     "text": "*Highlights*:\n" + desc,
                //     "fallback": objData.key + " " + objData.fields.summary,
                //     "color": "#3AA3E3",
                //     "attachment_type": "default",
                //     "title": objData.fields.summary,
                //     "fields": [{
                //             "title": "Assignee",
                //             "value": assigneeName,
                //             "short": true
                //         },
                //         {
                //             "title": "Status",
                //             "value": status + emojiStr,
                //             "short": true
                //         },
                //         {
                //             "title": "Epic",
                //             "value": objData.fields.epic !== null ? objData.fields.epic.summary : '',
                //             "short": true
                //         }
                //     ],
                //     "actions": actionArray
                // });

            }

            if (matchCount > 0) {

                sendBlocksToUser(slackUserId, channelId, blocksArray);
                // var payloadSlack = {
                //     "payload": {
                //         "slack": {
                //             "text": "IT JIRA Projects ...",
                //             "attachments": attachmentArray,
                //         },
                //         "outputContexts": [{
                //             "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/JIRA-SpecProj"
                //         }]
                //     }
                // };
                // res.send(payloadSlack);
            } else {
                blocksArray = [];
                blocksArray.push({
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "*IT JIRA Projects ...*\n" + "Nothing was found while searching for " + report + ". Try again maybe type less words or a specific keyword. Or view projects in JIRA using button below."
                    }
                });

                blocksArray.push({
                    "type": "actions",
                    "elements": [{
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "emoji": true,
                            "text": "View JIRA Projects",
                        },
                        "url": 'https://billsdev.atlassian.net/secure/RapidBoard.jspa?rapidView=305&projectKey=PLAN&view=planning.nodetail&epics=visible',
                        "style": "primary",
                        "value": "click_do_nothing"
                    }]
                });

                sendBlocksToUser(slackUserId, channelId, blocksArray);

            }
        })
        .catch(function (err) {
            logError('error occured on getting specific project details for JIRA search (' + report + ') Error: ' + err, req.body.originalDetectIntentRequest.payload.data.event.user, 'JIRA-SpecProj', 'jiraSearchITProj');
            console.log('error occured on getting specific project details for JIRA search (' + report + ') ' + +err);

            blocksArray = [];
            blocksArray.push({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "*IT JIRA Projects ...*\n" + "Unable to process your request at this time. For immediate access to the project data, view directly in JIRA using the button below."
                }
            });

            blocksArray.push({
                "type": "actions",
                "elements": [{
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "emoji": true,
                        "text": "View JIRA Projects",
                    },
                    "url": 'https://billsdev.atlassian.net/secure/RapidBoard.jspa?rapidView=305&projectKey=PLAN&view=planning.nodetail&epics=visible',
                    "style": "primary",
                    "value": "click_do_nothing"
                }]
            });

            sendBlocksToUser(slackUserId, channelId, blocksArray);

            // var payloadSlack = {
            //     "payload": {
            //         "slack": {
            //             "text": "IT JIRA Projects ...",
            //             "attachments": [{
            //                 "text": "Unable to process your request at this time. For immediate access to the project data, view directly in JIRA using the button below.",
            //                 "fallback": "Unable to process your request at this time. For immediate access to the project data, view directly in JIRA using link: https://billsdev.atlassian.net/secure/RapidBoard.jspa?rapidView=305&projectKey=PLAN&view=planning.nodetail&epics=visible",
            //                 "color": "#3AA3E3",
            //                 "attachment_type": "default",
            //                 "actions": [{
            //                     "text": "View JIRA Projects",
            //                     "type": "button",
            //                     "url": "https://billsdev.atlassian.net/secure/RapidBoard.jspa?rapidView=305&projectKey=PLAN&view=planning.nodetail&epics=visible",
            //                     "style": "primary"

            //                 }]
            //             }, ]
            //         },
            //         "outputContexts": [{
            //             "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/JIRA-SpecProj"
            //         }]
            //     }
            // };
            // console.log("my tasks response: " + JSON.stringify(payloadSlack));
            // res.send(payloadSlack);
            res.status.send("Error occured.");
        });
}


function jiraSearchITProj(req, res, next) {
    var report = '';
    // var projectSlide = '';
    // var projSchedule = '';
    // var emojiStr = '';
    // var attachmentArray = [];
    // var actionArray = [];
    // var searchResults = [];
    // var matchCount = 0;
    // var status;
    // var desc = '';
    if (req.body.queryResult.queryText) {
        report = req.body.queryResult.queryText.toLowerCase().replace(/status of /g, "").replace(/status /g, "").trim();
    }

    // queue request. 
    queueTask(req.body.originalDetectIntentRequest.payload.data.event.user, req.body.originalDetectIntentRequest.payload.data.event.channel, req.body);

    var payloadSlack = {
        "payload": {
            "slack": {
                "text": "IT JIRA Projects ...",
                "attachments": [{
                    "text": "Processing your search for " + report + ".",
                    "fallback": "Processing your search for " + report + ".",
                    "color": "#3AA3E3",
                    "attachment_type": "default"
                }]
            },
            "outputContexts": [{
                "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/JIRA-SpecProj"
            }]
        }
    };

    res.send(payloadSlack);


    // if (req.body.queryResult.queryText) {
    //     report = req.body.queryResult.queryText.toLowerCase().replace(/status of /g, "").replace(/status /g, "").trim();
    // }

    // var options = {
    //     method: 'GET',
    //     url: 'https://billsdev.atlassian.net/rest/agile/1.0/board/305/issue',
    //     qs: {
    //         maxResults: '25',
    //         jql: 'project = PLAN AND type = "IT Initiative" AND summary ~ "' + report + '*" ORDER BY Rank ASC'
    //         //  'project%20=%20PLAN%20AND%20type%20=%20%22IT%20Initiative%22%20AND%20summary%20~%20%22'+ encodeURIComponent(report) + '%2A%22%20ORDER%20BY%20Rank%20ASC'
    //     },
    //     headers: {
    //         Accept: 'application/json',
    //         Authorization: 'Basic Z25laWdlckBmcmVlZG9tZmluYW5jaWFsbmV0d29yay5jb206ODVzSWNSSExTRGVua3VkaVlndkU0MUJG'
    //     }
    // };

    // return rp(options)
    //     .then(body => {
    //         var jsonData = JSON.parse(body);
    //         totalItems = jsonData.total;
    //         for (var j = 0; j < totalItems; j++) {
    //             var objData = jsonData.issues[j];

    //             if (objData.fields.status.name !== "Done") {
    //                 searchResults.push(objData);
    //                 matchCount++;
    //             }
    //         }
    //         if (matchCount > 1) {
    //             searchResults = searchResults.sort(sortUtil.compareTitle);
    //         }
    //         for (var i = 0; i < searchResults.length; i++) {
    //             objData = searchResults[i];
    //             actionArray = [];
    //             projectSlide = '';
    //             projSchedule = '';
    //             emojiStr = '';
    //             desc = "";

    //             if (objData.fields.description !== null) {
    //                 desc = objData.fields.description.replaceAll("*", "•").replace('#', "•");
    //             }

    //             var assigneeName = "";
    //             if (objData.fields.assignee !== null) {
    //                 assigneeName = objData.fields.assignee.displayName;
    //             }
    //             status = objData.fields.status.name;
    //             if (objData.fields.customfield_13939 != null) {
    //                 switch (objData.fields.customfield_13939.value.toLowerCase()) {
    //                     case "green":

    //                         emojiStr = " :thumbsup:";
    //                         break;
    //                     case "yellow":

    //                         emojiStr = " :thumbsup::thumbsdown:";
    //                         break;
    //                     case "red":
    //                         emojiStr = " :thumbsdown:";
    //                         break;
    //                 }
    //             }
    //             if (objData.fields.customfield_13941 !== null) {
    //                 projectSlide = objData.fields.customfield_13941;
    //             }
    //             if (objData.fields.customfield_13940 !== null) {
    //                 projSchedule = objData.fields.customfield_13940;
    //             }

    //             actionArray.push({
    //                 "text": "View in JIRA",
    //                 "type": "button",
    //                 "url": "https://billsdev.atlassian.net/browse/" + objData.key,
    //                 "style": "primary"

    //             });

    //             if (projectSlide !== '') {
    //                 actionArray.push({
    //                     "text": "View Project Slide",
    //                     "type": "button",
    //                     "url": projectSlide,
    //                     "style": "primary"

    //                 });
    //             }

    //             if (projSchedule !== '') {
    //                 actionArray.push({
    //                     "text": "View Project Schedule",
    //                     "type": "button",
    //                     "url": projSchedule,
    //                     "style": "primary"

    //                 });
    //             }

    //             attachmentArray.push({

    //                 "text": "*Highlights*:\n" + desc,
    //                 "fallback": objData.key + " " + objData.fields.summary,
    //                 "color": "#3AA3E3",
    //                 "attachment_type": "default",
    //                 "title": objData.fields.summary,
    //                 "fields": [{
    //                         "title": "Assignee",
    //                         "value": assigneeName,
    //                         "short": true
    //                     },
    //                     {
    //                         "title": "Status",
    //                         "value": status + emojiStr,
    //                         "short": true
    //                     },
    //                     {
    //                         "title": "Epic",
    //                         "value": objData.fields.epic !== null ? objData.fields.epic.summary : '',
    //                         "short": true
    //                     }
    //                 ],
    //                 "actions": actionArray
    //             });

    //         }

    //         if (matchCount > 0) {
    //             var payloadSlack = {
    //                 "payload": {
    //                     "slack": {
    //                         "text": "IT JIRA Projects ...",
    //                         "attachments": attachmentArray,
    //                     },
    //                     "outputContexts": [{
    //                         "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/JIRA-SpecProj"
    //                     }]
    //                 }
    //             };
    //             res.send(payloadSlack);
    //         } else {
    //             var payloadSlack = {
    //                 "payload": {
    //                     "slack": {
    //                         "text": "IT JIRA Projects ...",
    //                         "attachments": [{
    //                             "text": "Nothing was found while searching for " + report + ". Try again maybe type less words or a specific keyword. Or view projects in JIRA using button below.",
    //                             "fallback": "IT JIRA Projects: \nNothing was found while searching for " + report + ". Try again maybe type less words or a specific keyword. Or view projects in JIRA using this link: https://billsdev.atlassian.net/secure/RapidBoard.jspa?rapidView=305&projectKey=PLAN&view=planning.nodetail&epics=visible",
    //                             "color": "#3AA3E3",
    //                             "attachment_type": "default",
    //                             "actions": [{
    //                                 "text": "View JIRA Projects",
    //                                 "type": "button",
    //                                 "url": "https://billsdev.atlassian.net/secure/RapidBoard.jspa?rapidView=305&projectKey=PLAN&view=planning.nodetail&epics=visible",
    //                                 "style": "primary"

    //                             }]
    //                         }, ]
    //                     },
    //                     "outputContexts": [{
    //                         "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/JIRA-SpecProj"
    //                     }]
    //                 }
    //             };
    //             console.log("my tasks response: " + JSON.stringify(payloadSlack));
    //             res.send(payloadSlack);
    //         }
    //     })
    //     .catch(function (err) {
    //         logError('error occured on getting specific project details for JIRA search (' + report + ') Error: ' + err, req.body.originalDetectIntentRequest.payload.data.event.user, 'JIRA-SpecProj', 'jiraSearchITProj');
    //         console.log('error occured on getting specific project details for JIRA search (' + report + ') ' + +err);

    //         var payloadSlack = {
    //             "payload": {
    //                 "slack": {
    //                     "text": "IT JIRA Projects ...",
    //                     "attachments": [{
    //                         "text": "Unable to process your request at this time. For immediate access to the project data, view directly in JIRA using the button below.",
    //                         "fallback": "Unable to process your request at this time. For immediate access to the project data, view directly in JIRA using link: https://billsdev.atlassian.net/secure/RapidBoard.jspa?rapidView=305&projectKey=PLAN&view=planning.nodetail&epics=visible",
    //                         "color": "#3AA3E3",
    //                         "attachment_type": "default",
    //                         "actions": [{
    //                             "text": "View JIRA Projects",
    //                             "type": "button",
    //                             "url": "https://billsdev.atlassian.net/secure/RapidBoard.jspa?rapidView=305&projectKey=PLAN&view=planning.nodetail&epics=visible",
    //                             "style": "primary"

    //                         }]
    //                     }, ]
    //                 },
    //                 "outputContexts": [{
    //                     "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/JIRA-SpecProj"
    //                 }]
    //             }
    //         };
    //         console.log("my tasks response: " + JSON.stringify(payloadSlack));
    //         res.send(payloadSlack);
    //     });
}

// function calculateGrossIncomeWithStdDeductions(req, res, next) {
//     var netIncomeDesired = req.body.queryResult.parameters.netIncomeSeeking;
//     var netIncomeValue = parseFloat(netIncomeDesired);
//     // lets calculate married file jointly first 
//     var netIncomeMarriedFileJoint = 0.0;
//     var netIncomeSingle = 0.0;
//     var marriedTaxes = 0.0;
//     var singleTaxes = 0.0;
//     var marriedTaxRate = 0.0;
//     var singleTaxRate = 0.0;  
//     var mSocialSecurity = 0.0; // 2019 rates is 6.2% on first 132900.
//     var mMedicareTaxes = 0.0; // 1.45% 
//     var sSocialSecurity = 0.0; // 2019 rates is 6.2% on first 132900.
//     var sMedicareTaxes = 0.0; // 1.45% 
//     var retirement401kRate = 0.0;


//     if (netIncomeValue > 0 && netIncomeValue <= 19051) {
//         var tempAmount = netIncomeValue / .90;
//         if (tempAmount > 19050) {
//             netIncomeMarriedFileJoint = ((netIncomeValue - 17145) / .88) + 19050;
//         } else {
//             netIncomeMarriedFileJoint = tempAmount;
//         }
//     } else if (netIncomeValue > 19051 && netIncomeValue <= 77401) {
//         netIncomeMarriedFileJoint = ((netIncomeValue - 17145) / .88) + 19050;
//     } else if (netIncomeValue > 77401 && netIncomeValue <= 165001) {
//         netIncomeMarriedFileJoint = ((netIncomeValue - 68493) / .78) + 77400;
//     } else if (netIncomeValue > 165001 && netIncomeValue <= 315001) {
//         netIncomeMarriedFileJoint = ((netIncomeValue - 136821) / .76) + 165000;
//     } else if (netIncomeValue > 315001 && netIncomeValue <= 400001) {
//         netIncomeMarriedFileJoint = ((netIncomeValue - 250821) / .68) + 315000;
//     } else if (netIncomeValue > 400001 && netIncomeValue <= 600001) {
//         netIncomeMarriedFileJoint = ((netIncomeValue - 308621.00) / .65) + 400000;
//     } else if (netIncomeValue > 600001) {
//         netIncomeMarriedFileJoint = ((netIncomeValue - 438621.00) / .63) + 600000;
//     }

//     // filing single federal tax return calculations 
//     if (netIncomeValue > 0 && netIncomeValue <= 9526) {
//         var tempAmount = netIncomeValue / .90;
//         if (tempAmount > 9525) {
//             netIncomeSingle = ((netIncomeValue - 8572.50) / .88) + 9525;
//         } else {
//             netIncomeSingle = tempAmount;
//         }


//     } else if (netIncomeValue > 9526 && netIncomeValue <= 38700) {
//         netIncomeSingle = ((netIncomeValue - 8572.50) / .88) + 9525;
//     } else if (netIncomeValue > 38701 && netIncomeValue < 82500) {
//         netIncomeSingle = ((netIncomeValue - 34246.50) / .78) + 38700;
//     } else if (netIncomeValue > 82501 && netIncomeValue < 157500) {
//         var tempVal = ((netIncomeValue - 68410.50) / .76) + 82500;
//         if (tempVal > 157500) {
//             netIncomeSingle = ((netIncomeValue - 125410.50) / .68) + 157500;
//         } else {
//             netIncomeSingle = tempVal;
//         }
//     } else if (netIncomeValue > 157501 && netIncomeValue <= 200000) {
//         var tempVal = ((netIncomeValue - 125410.50) / .68) + 157500;
//         if (tempVal > 200000) {
//             netIncomeSingle = ((netIncomeValue - 186400) / .65) + 200000;
//         } else {
//             netIncomeSingle = tempVal;
//         }
//     } else if (netIncomeValue > 200001 && netIncomeValue <= 500000) {
//         var tempVal = ((netIncomeValue - 186400) / .65) + 200000;
//         if (tempVal > 500000) {
//             netIncomeSingle = ((netIncomeValue - 349310.50) / .63) + 500000;
//         } else {
//             netIncomeSingle = tempVal;
//         }
//     } else if (netIncomeValue > 500001) {
//         netIncomeSingle = ((netIncomeValue - 349310.50) / .63) + 500000;
//     }

//     if (netIncomeMarriedFileJoint > 132900) 
//     {
//         mSocialSecurity = 8239.80;
//     }
//     else {
//         mSocialSecurity = netIncomeMarriedFileJoint * 0.062;
//     }

//     mMedicareTaxes = netIncomeMarriedFileJoint * 0.0145;

//     if (netIncomeSingle > 132900) 
//     {
//         sSocialSecurity = 8239.80;
//     }
//     else {
//         sSocialSecurity = netIncomeSingle * 0.062;
//     }

//     sMedicareTaxes = netIncomeSingle * 0.0145;


//     singleTaxes = netIncomeSingle - netIncomeValue;
//     singleTaxRate = (singleTaxes / netIncomeSingle) * 100;
//     marriedTaxes = netIncomeMarriedFileJoint - netIncomeValue;
//     marriedTaxRate = (marriedTaxes / netIncomeSingle) * 100;


//     var payloadSlack = {
//         "payload": {
//             "slack": {
//                 "text": "Required income to net a specific income.",
//                 "attachments": [{
//                     "text": "Target Net Income $" + netIncomeValue.toFixed(2).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,"),
//                     "fallback": "Annual Gross Required to Net $" + netIncomeValue.toFixed(2).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,"),
//                     "color": "#3AA3E3",
//                     "attachment_type": "default",
//                     "title": "Annual Gross Income Required to Net Annual Income",
//                     "fields": [{
//                             "title": "Married: Gross Income",
//                             "value": "$" + netIncomeMarriedFileJoint.toFixed(2).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,"),
//                             "short": true
//                         },
//                         {
//                             "title": "Married Fed Tax / Tax Rate %",
//                             "value": "$" + (netIncomeMarriedFileJoint - netIncomeValue).toFixed(2).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,") + " / " + marriedTaxRate.toFixed(2) + " %",
//                             "short": true
//                         },
//                         {
//                             "title": "Social Security",
//                             "value": "$" + mSocialSecurity.toFixed(2).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,"),
//                             "short": true
//                         },
//                         {
//                             "title": "Medicare",
//                             "value": "$" + mMedicareTaxes.toFixed(2).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,"),
//                             "short": true
//                         },
//                         {
//                             "title": "Single Gross Income",
//                             "value": "$" + netIncomeSingle.toFixed(2).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,"),
//                             "short": true
//                         },
//                         {
//                             "title": "Single Fed Tax / Tax Rate %",
//                             "value": "$" + (netIncomeSingle - netIncomeValue).toFixed(2).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,") + " / " + singleTaxRate.toFixed(2) + " %",
//                             "short": true
//                         },
//                         {
//                             "title": "Social Security",
//                             "value": "$" + sSocialSecurity.toFixed(2).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,"),
//                             "short": true
//                         },
//                         {
//                             "title": "Medicare",
//                             "value": "$" + sMedicareTaxes.toFixed(2).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,"),
//                             "short": true
//                         },
//                     ]
//                 }],
//             },
//             "outputContexts": [{
//                 "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/CalculateGrossIncome"
//             }]
//         }
//     };

//     res.send(payloadSlack);

// }

function calculateGrossIncome(req, res, next) {
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

    var payloadSlack = {
        "payload": {
            "slack": {
                "text": "Required income to net a specific income.",
                "attachments": [{
                    "text": "Target Net Income $" + netIncomeValue.toFixed(2).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,"),
                    "fallback": "Annual Gross Required to Net $" + netIncomeValue.toFixed(2).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,"),
                    "color": "#3AA3E3",
                    "attachment_type": "default",
                    "title": "Annual Gross Income Required to Net Annual Income",
                    "fields": [{
                            "title": "Married: Gross Income",
                            "value": netIncomeMarriedFileJoint.toFixed(2).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,"),
                            "short": true
                        },
                        {
                            "title": "Married Fed Tax / Tax Rate %",
                            "value": (netIncomeMarriedFileJoint - netIncomeValue).toFixed(2).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,") + " / " + marriedTaxRate.toFixed(2) + " %",
                            "short": true
                        },
                        {
                            "title": "Single Gross Income",
                            "value": netIncomeSingle.toFixed(2).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,"),
                            "short": true
                        },
                        {
                            "title": "Single Fed Tax / Tax Rate %",
                            "value": (netIncomeSingle - netIncomeValue).toFixed(2).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,") + " / " + singleTaxRate.toFixed(2) + " %",
                            "short": true
                        }
                    ]
                }],
            },
            "outputContexts": [{
                "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/CalculateGrossIncome"
            }]
        }
    };

    res.send(payloadSlack);

}

function useSnowKnowledgeSearch(req, res, next) {
    var searchForPhrase = req.body.queryResult.parameters.phraseSearch;
    if (searchForPhrase !== '') {
        var options = {
            method: 'POST',
            url: 'https://freedomfinancialnetwork.service-now.com/api/now/sp/search',
            headers: {
                'X-UserToken': 'b3b3aa3bdb1533049788f969af96198a7a6346d39144ecd67b357dce34ca62f764df8914',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.131 Mobile Safari/537.36',
                Referer: 'https://freedomfinancialnetwork.service-now.com/sp?id=kb_article&sys_id=0d85be10db3a97049788f969af9619d4',
                Origin: 'https://freedomfinancialnetwork.service-now.com',
                Host: 'freedomfinancialnetwork.service-now.com',
                Cookie: 'glide_sso_id=1f41d867db74a744a035f97e0f961988; JSESSIONID=40CF6D4F75FE64F39FC7997A06D7D43B; glide_user_route=glide.e4b3ec99f33a53e41e886f4d6cc5ede9; BIGipServerpool_freedomfinancialnetwork=394273290.33086.0000; BAYEUX_BROWSER=7df0-y7mt44a475cdjvpqymqzovk, glide_sso_id=1f41d867db74a744a035f97e0f961988; JSESSIONID=40CF6D4F75FE64F39FC7997A06D7D43B; glide_user_route=glide.e4b3ec99f33a53e41e886f4d6cc5ede9; BIGipServerpool_freedomfinancialnetwork=394273290.33086.0000; BAYEUX_BROWSER=7df0-y7mt44a475cdjvpqymqzovk; JSESSIONID=F0989FE77FEBDE763860CC04B5AE0E99; glide_user_route=glide.e4b3ec99f33a53e41e886f4d6cc5ede9; BIGipServerpool_freedomfinancialnetwork=394273290.33086.0000',
                'Content-Type': 'application/json',
                Connection: 'keep-alive',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'application/json',
                Accept: 'application/json'
            },
            body: {
                query: searchForPhrase,
                portal: '81b75d3147032100ba13a5554ee4902b',
                source: ['kb'],
                include_facets: false,
                isTypeahead: true
            },
            json: true
        };

        return rp(options)
            .then(body => {
                var attachmentArray = [];
                var numItems = body.result.results.length;
                for (var i = 0; i < numItems; i++) {

                    attachmentArray.push({

                        "text": body.result.results[i].text,
                        "fallback": body.result.results[i].short_description,
                        "color": "#3AA3E3",
                        "attachment_type": "default",
                        "title": body.result.results[i].short_description,
                        "fields": [{
                                "title": "Number",
                                "value": body.result.results[i].number,
                                "short": true
                            },
                            {
                                "title": "Article Published",
                                "value": body.result.results[i].published,
                                "short": true
                            }
                        ],
                        "actions": [{
                                "text": "View Article Now",
                                "type": "button",
                                "url": "https://freedomfinancialnetwork.service-now.com/sp?id=kb_article&sys_id=" + body.result.results[i].sys_id,
                                "style": "primary"
                            }

                        ]
                    });
                }

                if (numItems > 0) {
                    var payloadSlack = {
                        "payload": {
                            "slack": {
                                "text": "Got it! We found the following results ...",
                                "attachments": attachmentArray
                            },
                            "outputContexts": [{
                                "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/SNOWKnowledgeSearch"
                            }]
                        }
                    };


                    res.send(payloadSlack);
                } else {
                    var payloadSlack = {
                        "payload": {
                            "slack": {
                                "text": "Knowledge Results ...",
                                "attachments": [{
                                    "text": "Nothing was found while searching for *" + searchForPhrase + "*. Try again maybe type less words or a specific keyword.",
                                    "fallback": "Knowledge Results ...: \nNothing was found while searching for " + searchForPhrase + ". Try again maybe type less words or a specific keyword.",
                                    "color": "#3AA3E3",
                                    "attachment_type": "default"
                                }]
                            },
                            "outputContexts": [{
                                "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/SNOWKnowledgeSearch"
                            }]
                        }
                    };
                    res.send(payloadSlack);
                }

            });
    } else {

        var payloadSlack = {
            "payload": {
                "slack": {
                    "text": "Knowledge Results ...",
                    "attachments": [{
                        "text": "Nothing was found while searching for *" + searchForPhrase + "*. Try again maybe type less words or a specific keyword.",
                        "fallback": "Knowledge Results ...: \nNothing was found while searching for " + searchForPhrase + ". Try again maybe type less words or a specific keyword.",
                        "color": "#3AA3E3",
                        "attachment_type": "default"
                    }]
                },
                "outputContexts": [{
                    "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/SNOWKnowledgeSearch"
                }]
            }
        };
        res.send(payloadSlack);
    }


}

function helpHandler(req, res, next) {
    var payloadSlack = {
        "payload": {
            "slack": {
                "text": "HELP...",
                "attachments": [{
                    "text": '*Order Food Rio 1 Cafeteria*\nType any of the following:\nfood\nhungry\norder food\norder food cafeteria\n\n*FDR Intake Requests*\nType any of the following:\nfdr intake\nintake\n\n*View Franklin Statistics and Metrics*\nType: stats\n\n*Submit an idea*\nType: bright idea\n\n*View My Asigned JIRA Tasks*\nType:\nmy tasks\n\n*Project Status*\nType: status of [any part of the project title]\n\n*Status of All Projects*\nType any of the following:\ntop 10\nall projects\njira project status\ntop it projects\n\n*People Lookup*\nType: who is first lastname\nwho is lastname\n\n*Salesforce Knowledge Search*\nType any of the following:\n sf\nsf [key words to search for]\n\n*Search Knowledge Articles*\nType any of the following:\nsearch for [some key words to search for]\nsearch [key words to search for]\n\n*ServiceNow Knowledge Search (same search used in SNOW)*\nType any of the following:\nknowledge [keywords to search]\nkb [keywords to search]\nkb\n\n*Create Idea*\nType the following:\n*Updated*\n/idea\n\n*ServiceNow* Type the following:\n servicenow\nservicenow stats\n\n*Twilio SMS delivered today, by hour* you can type the following:\nTwilio\nsms stats\nGive me the twilio stats\n\n*Weather*\nTempe weather\nSan Mateo weather\n\n*For weather you can type the following*: \nweather in [city]\ncurrent weather\nwhat is weather in tempe, az\n\n*CCP Network Monitor Map* by typing the following:\nccp network map\nproduction alarms\nNetwork status\n\n*Okta status* type the following:\nokta\n\n*View the uncleared payments process* type:\nuncleared\nuncleared payments\n\n*Jokes*:\nType any of the following:\njoke\ndo you know any jokes\ntell me a joke\nj2 - IT jokes\nlj - lawyer jokes\n\n*Get Stock Quotes*\nType any of the following:\nquote: [stock symbol here]\nstock: [stock symbol here]\n\n*Current Time - Multiple time zones*:\nType any of the following:\ntime now\ntime\ndate\n\n*Add word to FFN Dictionary*\nType the following:\n\ addword\nOr use search below and click the *Add New Word* button to add new word.\n\n*FFN Dictionary Search*\nType any of the following:\ndefine: [word or acronym] or define [word or acronym]\nlookup: [word or acronym] or lookup [word or acronym]\nmeaning: [word or acronym] or meaning [word or acronym]\nwhat is: [word or acronym] or what is [word or acronym]\n\n*List All Entries in FFN Dictionary*\nType any of the following\nall acronyms\nall words\nshow dictionary\n\n*eBook Search*:\nType any of the following:\nbook: [any part of title of book or an author]\nsearch book: [any part of title of book or an author]\n',
                    "fallback": 'detailed help info',
                    "color": "#3AA3E3",
                    "attachment_type": "default",
                }]
            },
            "outputContexts": [{
                "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/Help"
            }]
        }
    };
    //console.log("attempt to send: " + JSON.stringify(payloadSlack));
    res.send(payloadSlack);
}

function projAttachment(projectName, assignee, status, statusColor, highlights, sprintState, progress, totalProgress, watchCount, projectSlideURL, projectScheduleURL) {
    var projStatusEmoji = ":thumbsup:";

    if (statusColor === "green") {
        projStatusEmoji = ":thumbsup:";

    } else if (statusColor === "yellow") {
        projStatusEmoji = ":thumbsup::thumbsdown:";
    } else if (statusColor === "red") {
        projStatusEmoji = ":thumbsdown:";
    }

    var retAttachment = {
        "text": projectName,
        "fallback": "Project: \n" + projectName,
        "color": "#3AA3E3",
        "attachment_type": "default",
        "fields": [{
                "title": "Assignee",
                "value": assignee,
                "short": true
            },
            {
                "title": "Status",
                "value": status + " " + projStatusEmoji,
                "short": true
            },
            {
                "title": "Highlights",
                "value": highlights,
                "short": true
            },
            {
                "title": "Sprint State",
                "value": sprintState,
                "short": true
            },
            {
                "title": "Priority",
                "value": "Active",
                "short": true
            },
            {
                "title": "Progress / Total",
                "value": progress + " / " + totalProgress,
                "short": true
            },
            {
                "title": "Watch Count",
                "value": watchCount,
                "short": true
            }
        ],
        "actions": [{
                "text": "Project Slide",
                "type": "button",
                "url": projectSlideURL,
                "style": "primary"
            },
            {
                "text": "Project Schedule",
                "type": "button",
                "url": projectScheduleURL,
                "style": "primary"
            }
        ]
    };
}

function addNewIdeaWithName(req, res, next) {

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

    // var jiraKey = '';
    // var jiraUrl = '';
    // var ideaTitle = req.body.queryResult.parameters.ideaTitle;
    // var slackFullName = '';
    // var slackUserId = req.body.originalDetectIntentRequest.payload.data.event.user;
    // var options = {
    //     method: 'GET',
    //     url: 'https://ffn-chatbot-weather-dev.appspot.com/ideas/getSlackUserInfo',
    //     qs: {
    //         userid: slackUserId
    //     },
    //     headers: {
    //         Host: 'ffn-chatbot-weather-dev.appspot.com',
    //         Accept: 'applicaiton/json'
    //     }
    // };

    // return rp(options)
    //     .then(body => {
    //         var slackUserData = JSON.parse(body);
    //         slackFullName = slackUserData.data.fullname;

    //         var optionsAddIdea = {
    //             method: 'POST',
    //             url: 'https://billsdev.atlassian.net/rest/api/3/issue',
    //             headers: {
    //                 Authorization: 'Basic Z25laWdlckBmcmVlZG9tZmluYW5jaWFsbmV0d29yay5jb206ODVzSWNSSExTRGVua3VkaVlndkU0MUJG',
    //                 'Content-Type': 'application/json',
    //                 Accept: 'application/json'
    //             },
    //             body: {
    //                 update: {},
    //                 fields: {
    //                     project: {
    //                         id: '15541'
    //                     },
    //                     summary: req.body.queryResult.parameters.ideaTitle,
    //                     issuetype: {
    //                         id: '10955'
    //                     },
    //                     assignee: {
    //                         id: '557058:f03f3f52-3cf0-4d4c-bbe8-65b062600de3'
    //                     },
    //                     //  no longer works with reporter filled out was causing an issue. Commented out on 6/13/19 - gtn 
    //                     //  reporter: {
    //                     //      id: '557058:f03f3f52-3cf0-4d4c-bbe8-65b062600de3'
    //                     // },
    //                     description: {
    //                         type: 'doc',
    //                         version: 1,
    //                         content: [{
    //                             type: 'paragraph',
    //                             content: [{
    //                                 type: 'text',
    //                                 text: req.body.queryResult.parameters.ideaDescription + "\n Added by: " + slackFullName
    //                             }]
    //                         }]
    //                     }
    //                 }
    //             },
    //             json: true
    //         };
    //         return rp(optionsAddIdea)
    //             .then(body => {
    //                 //console.log("key: " + body.key);
    //                 var jiraKeysToMove = [];
    //                 jiraKey = body.key;
    //                 jiraKeysToMove.push(jiraKey);
    //                 jiraUrl = body.self;
    //                 //console.log("url : " + body.self);

    //                 console.log("GOTTT new idea key: " + jiraKey + " jiraUrl: " + jiraUrl);
    //                 var optionsMoveToIntakeSprint = {
    //                     method: 'POST',
    //                     url: 'https://billsdev.atlassian.net/rest/agile/1.0/sprint/1719/issue',
    //                     headers: {
    //                         Authorization: 'Basic Z25laWdlckBmcmVlZG9tZmluYW5jaWFsbmV0d29yay5jb206ODVzSWNSSExTRGVua3VkaVlndkU0MUJG',
    //                         'Content-Type': 'application/json',
    //                         Accept: 'application/json'
    //                     },
    //                     body: {
    //                         issues: jiraKeysToMove
    //                     },
    //                     json: true
    //                 };
    //                 return rp(optionsMoveToIntakeSprint)
    //                     .then(body => {
    //                         var keyTitle = jiraKey + ": " + ideaTitle;
    //                         var viewJiraUrl = "https://billsdev.atlassian.net/secure/RapidBoard.jspa?rapidView=305&projectKey=PLAN&view=planning&selectedIssue=" + jiraKey;
    //                         var payloadSlack = {
    //                             "payload": {
    //                                 "slack": {
    //                                     "text": "Your idea was added successfully!",
    //                                     "attachments": [{
    //                                         "text": keyTitle,
    //                                         "fallback": keyTitle,
    //                                         "color": "#3AA3E3",
    //                                         "attachment_type": "default",
    //                                         "actions": [{
    //                                             "text": "View in JIRA",
    //                                             "type": "button",
    //                                             "url": viewJiraUrl,
    //                                             "style": "primary"
    //                                         }]
    //                                     }]
    //                                 },
    //                                 "outputContexts": [{
    //                                     "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/JIRA-NewIdea"
    //                                 }]
    //                             }
    //                         };
    //                         res.send(payloadSlack);
    //                     })
    //                     .catch(function (err) {
    //                         logError('error occured on moving ' + jiraKey + ' to intake sprint. Error: ' + err, req.body.originalDetectIntentRequest.payload.data.event.user, 'JIRA-NewIdea', 'addNewIdeaWithName');
    //                         console.log('error occured on moving ' + jiraKey + ' to intake sprint. ' + err);
    //                     });

    //             })
    //             .catch(function (err) {
    //                 logError('error occured on inserting new idea to jira. Error: ' + err, req.body.originalDetectIntentRequest.payload.data.event.user, 'JIRA-NewIdea', 'addNewIdeaWithName');
    //                 console.log('error occured on inserting new idea to jira. ' + err);
    //             });
    //     })
    //     .catch(function (err) {
    //         logError('error occured on getting slack user details. Error: ' + err, req.body.originalDetectIntentRequest.payload.data.event.user, 'JIRA-NewIdea', 'addNewIdeaWithName');
    //         console.log('error occured on getting slack user details. ' + err);
    //     });
}

function addNewIdeaWithOutName(req, res, next) {

    var jiraKey = '';
    var jiraUrl = '';
    var ideaTitle = req.body.queryResult.parameters.ideaTitle;

    var optionsAddIdea = {
        method: 'POST',
        url: 'https://billsdev.atlassian.net/rest/api/3/issue',
        headers: {
            Authorization: 'Basic Z25laWdlckBmcmVlZG9tZmluYW5jaWFsbmV0d29yay5jb206ODVzSWNSSExTRGVua3VkaVlndkU0MUJG',
            'Content-Type': 'application/json',
            Accept: 'application/json'
        },
        body: {
            update: {},
            fields: {
                project: {
                    id: '15541'
                },
                summary: req.body.queryResult.parameters.ideaTitle,
                issuetype: {
                    id: '10955'
                },
                assignee: {
                    id: '557058:f03f3f52-3cf0-4d4c-bbe8-65b062600de3'
                },
                reporter: {
                    id: '557058:f03f3f52-3cf0-4d4c-bbe8-65b062600de3'
                },
                description: {
                    type: 'doc',
                    version: 1,
                    content: [{
                        type: 'paragraph',
                        content: [{
                            type: 'text',
                            text: req.body.queryResult.parameters.ideaDescription
                        }]
                    }]
                }
            }
        },
        json: true
    };
    return rp(optionsAddIdea)
        .then(body => {
            //console.log("key: " + body.key);
            jiraKey = body.key;
            jiraUrl = body.self;
            //console.log("url : " + body.self);


            var optionsMoveToIntakeSprint = {
                method: 'POST',
                url: 'https://billsdev.atlassian.net/rest/agile/1.0/sprint/1719/issue',
                headers: {
                    Authorization: 'Basic Z25laWdlckBmcmVlZG9tZmluYW5jaWFsbmV0d29yay5jb206ODVzSWNSSExTRGVua3VkaVlndkU0MUJG',
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                },
                body: {
                    issues: [jiraKey]
                },
                json: true
            };
            return rp(optionsMoveToIntakeSprint)
                .then(body => {
                    var keyTitle = jiraKey + ": " + ideaTitle;
                    var viewJiraUrl = "https://billsdev.atlassian.net/secure/RapidBoard.jspa?rapidView=305&projectKey=PLAN&view=planning&selectedIssue=" + jiraKey;
                    var payloadSlack = {
                        "payload": {
                            "slack": {
                                "text": "Your idea was added successfully!",
                                "attachments": [{
                                    "text": keyTitle,
                                    "fallback": keyTitle,
                                    "color": "#3AA3E3",
                                    "attachment_type": "default",
                                    "actions": [{
                                        "text": "View in JIRA",
                                        "type": "button",
                                        "url": viewJiraUrl,
                                        "style": "primary"
                                    }]
                                }]
                            },
                            "outputContexts": [{
                                "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/JIRA-NewIdea"
                            }]
                        }
                    };
                    res.send(payloadSlack);
                })
                .catch(function (err) {
                    logError('error occured on moving ' + jiraKey + ' to intake sprint. Error: ' + err, req.body.originalDetectIntentRequest.payload.data.event.user, 'JIRA-NewIdea', 'addNewIdeaWithName');
                    console.log('error occured on moving ' + jiraKey + ' to intake sprint. ' + err);
                });

        })
        .catch(function (err) {
            logError('error occured on inserting new idea to jira. Error: ' + err, req.body.originalDetectIntentRequest.payload.data.event.user, 'JIRA-NewIdea', 'addNewIdeaWithOutName');
            console.log('error occured on inserting new idea to jira. ' + err);
        });

}

function buzzWordHandler(req, res, next) {
    //https://corporatebs-generator.sameerkumar.website/

    var options = {
        uri: 'https://corporatebs-generator.sameerkumar.website/',
        method: 'GET',
        json: true,
        headers: {
            "Accept": "application/json"
        }
    };

    return rp(options)
        .then(result => {
            var payloadSlack = {
                "payload": {
                    "slack": {
                        "text": "Cool Corporate Buzz Word...",
                        "attachments": [{
                            "text": result.phrase,
                            "fallback": 'Cool Corporate Buzz Word: *' + result.phrase + '*',
                            "color": "#3AA3E3",
                            "attachment_type": "default",
                        }]
                    },
                    "outputContexts": [{
                        "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/BuzzWord"
                    }]
                }
            };
            res.send(payloadSlack);
        })
        .catch(function (err) {
            logError(err, req.body.originalDetectIntentRequest.payload.data.event.user, 'BuzzWord', 'buzzWordHandler');
        });
}

function genericResponse(req, res, next) {
    var payloadSlack = {
        "payload": {
            "slack": {
                "text": "",
                "attachments": [{
                    "text": "To see what Franklin can do type *help* or *?*",
                    "fallback": "",
                    "color": "#3AA3E3",
                    "attachment_type": "default",
                    "title": "Unauthorized",
                }]
            },
            "outputContexts": [{
                "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/ServiceNow"
            }]
        }
    };
    res.send(payloadSlack);

}

function excuseHandler(req, res, next) {
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
    var payloadSlack = {
        "payload": {
            "slack": {
                "text": "Excuses for not going to work ...",
                "attachments": [{
                    "text": excuses[index],
                    "fallback": "I can't come to work because... *" + excuses[index] + '*',
                    "color": "#3AA3E3",
                    "attachment_type": "default",
                }]
            },
            "outputContexts": [{
                "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/Excuses"
            }]
        }
    };
    res.send(payloadSlack);

}

function jiraGetIdeasHandler(req, res, next) {
    var totalIdeas = 0;
    var startAtOffsetMultipiler = 0;

    var options = {
        method: 'GET',
        url: 'https://billsdev.atlassian.net/rest/agile/1.0/board/305/sprint/1719/issue',
        headers: {
            Authorization: 'Basic Z25laWdlckBmcmVlZG9tZmluYW5jaWFsbmV0d29yay5jb206ODVzSWNSSExTRGVua3VkaVlndkU0MUJG',
            Accept: 'application/json'
        }
    };

    var returnProjs = "";
    return rp(options)
        .then(body => {

            var jsonData = JSON.parse(body);
            totalIdeas = jsonData.total;
            var numItems = jsonData.issues.length;
            //console.log("size: " + numItems);

            for (var j = 0; j < numItems; j++) {
                var objData = jsonData.issues[j];


                var desc = "";
                if (objData.fields.description !== null) {
                    desc = objData.fields.description.replaceAll("*", "•"); //"&#x2022;");
                }

                var assigneeName = "";
                if (objData.fields.assignee !== null) {
                    assigneeName = objData.fields.assignee.displayName;
                }


                if (objData.fields.customfield_13939 != null) {
                    switch (objData.fields.customfield_13939.value.toLowerCase()) {
                        case "green":
                            returnProjs = returnProjs + "*Idea*: " + objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: " + objData.fields.status.name + " :thumbsup:\n*Highlights*:\n" + desc;
                            break;
                        case "yellow":
                            returnProjs = returnProjs + "*Idea*: " + objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: " + objData.fields.status.name + " :thumbsup::thumbsdown:\n*Highlights*:\n" + desc;
                            break;
                        case "red":
                            returnProjs = returnProjs + "*Idea*: " + objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: " + objData.fields.status.name + " :thumbsdown:\n*Highlights*:\n" + desc;
                            break;
                    }
                } else {
                    returnProjs = returnProjs + "*Idea*: " + objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: " + objData.fields.status.name + "\n" + desc;
                }

                if (objData.fields.priority.name !== null) {
                    returnProjs = returnProjs + "\n*Priority*: " + objData.fields.priority.name;
                }



                returnProjs = returnProjs + "\n\n----------------------------\n\n";
            }

            startAtOffsetMultipiler = 1;
            var offset = startAtOffsetMultipiler * 50;
            while (totalIdeas > 50 && (startAtOffsetMultipiler * 50) < totalItems) {
                var moreIdeas = {
                    method: 'GET',
                    url: 'https://billsdev.atlassian.net/rest/agile/1.0/board/305/sprint/1719/issue?startAt=' + offset.toString(),
                    headers: {
                        Authorization: 'Basic Z25laWdlckBmcmVlZG9tZmluYW5jaWFsbmV0d29yay5jb206ODVzSWNSSExTRGVua3VkaVlndkU0MUJG',
                        Accept: 'application/json'
                    }
                };


                return rp(moreIdeas)
                    .then(body => {
                        for (var j = 0; j < numItems; j++) {
                            var objData = jsonData.issues[j];


                            var desc = "";
                            if (objData.fields.description !== null) {
                                desc = objData.fields.description.replaceAll("*", "•");
                            }

                            var assigneeName = "";
                            if (objData.fields.assignee !== null) {
                                assigneeName = objData.fields.assignee.displayName;
                            }


                            if (objData.fields.customfield_13939 != null) {
                                switch (objData.fields.customfield_13939.value.toLowerCase()) {
                                    case "green":
                                        returnProjs = returnProjs + "*Idea*: " + objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: " + objData.fields.status.name + " :thumbsup:\n*Highlights*:\n" + desc;
                                        break;
                                    case "yellow":
                                        returnProjs = returnProjs + "*Idea*: " + objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: " + objData.fields.status.name + " :thumbsup::thumbsdown:\n*Highlights*:\n" + desc;
                                        break;
                                    case "red":
                                        returnProjs = returnProjs + "*Idea*: " + objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: " + objData.fields.status.name + " :thumbsdown:\n*Highlights*:\n" + desc;
                                        break;
                                }
                            } else {
                                returnProjs = returnProjs + "*Idea*: " + objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: " + objData.fields.status.name + "\n" + desc;
                            }

                            if (objData.fields.priority.name !== null) {
                                returnProjs = returnProjs + "\n*Priority*: " + objData.fields.priority.name;
                            }

                            returnProjs = returnProjs + "\n\n----------------------------\n\n";
                        }

                        startAtOffsetMultipiler++;
                    })
                    .catch(function (err) {
                        logError('inner while loop Error: ' + err, req.body.originalDetectIntentRequest.payload.data.event.user, 'JIRAGETAllIdeas', 'jiraGetIdeasHandler');
                    });
            }
            var payloadSlack = {
                "payload": {
                    "slack": {
                        "text": "JIRA Ideas ...",
                        "attachments": [{
                            "text": returnProjs,
                            "fallback": "JIRA Ideas: \n" + returnProjs,
                            "color": "#3AA3E3",
                            "attachment_type": "default",
                        }]
                    },
                    "outputContexts": [{
                        "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/JIRAGETAllIdeas"
                    }]
                }
            };
            res.send(payloadSlack);
        })
        .catch(function (err) {
            logError('Initial request Error: ' + err, req.body.originalDetectIntentRequest.payload.data.event.user, 'JIRAGETAllIdeas', 'jiraGetIdeasHandler');
        });
}

// function jiraProjHandler(req, res, next) {
//     var options = {
//         method: 'GET',
//         url: 'https://billsdev.atlassian.net/rest/agile/1.0/board/305/epic/94481/issue',
//         headers: {
//             Authorization: 'Basic Z25laWdlckBmcmVlZG9tZmluYW5jaWFsbmV0d29yay5jb206ODVzSWNSSExTRGVua3VkaVlndkU0MUJG',
//             Accept: 'application/json'
//         }
//     };

//     var returnProjs = "";
//     return rp(options)
//         .then(body => {
//             var jsonData = JSON.parse(body);
//             var numItems = jsonData.issues.length;
//             //console.log("size: " + numItems);

//             for (var j = 0; j < numItems; j++) {
//                 var objData = jsonData.issues[j];


//                 var desc = "";
//                 if (objData.fields.description !== null) {
//                     desc = objData.fields.description.replaceAll("*", "•"); //"&#x2022;");
//                 }

//                 var assigneeName = "";
//                 if (objData.fields.assignee !== null) {
//                     assigneeName = objData.fields.assignee.displayName;
//                 }


//                 if (objData.fields.customfield_13939 != null) {
//                     switch (objData.fields.customfield_13939.value.toLowerCase()) {
//                         case "green":
//                             returnProjs = returnProjs + "*Project*: " + objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: " + objData.fields.status.name + " :thumbsup:\n*Highlights*:\n" + desc;
//                             break;
//                         case "yellow":
//                             returnProjs = returnProjs + "*Project*: " + objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: " + objData.fields.status.name + " :thumbsup::thumbsdown:\n*Highlights*:\n" + desc;
//                             break;
//                         case "red":
//                             returnProjs = returnProjs + "*Project*: " + objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: " + objData.fields.status.name + " :thumbsdown:\n*Highlights*:\n" + desc;
//                             break;
//                     }
//                 } else {
//                     returnProjs = returnProjs + "*Project*: " + objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: " + objData.fields.status.name + "\n" + desc;
//                 }

//                 //returnProjs = returnProjs + "*Project*: " + objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: :thumbsup:" + objData.fields.status.name + "\n*Highlights*:\n" + desc;
//                 /*if(objData.fields.sprint !== null && objData.fields.sprint.startDate !== null && objData.fields.sprint.endDate !== null) {
//                   var startDate = objData.fields.sprint.startDate;

//                   var endDate = objData.fields.sprint.endDate;
//                   returnProjs = returnProjs + "\n*Start - End*: " + startDate + " - " + endDate;
//                 }*/

//                 if (objData.fields.customfield_13941 !== null) {
//                     returnProjs = returnProjs + "\n*Project Slide*: " + objData.fields.customfield_13941;
//                 }
//                 if (objData.fields.customfield_13940 !== null) {
//                     returnProjs = returnProjs + "\n*Project Schedule*: " + objData.fields.customfield_13940;
//                 }

//                 if (objData.fields.sprint !== null && objData.fields.sprint.state !== null) {
//                     returnProjs = returnProjs + "\n*Sprint State*: " + objData.fields.sprint.state;
//                 }
//                 if (objData.fields.priority.name !== null) {
//                     returnProjs = returnProjs + "\n*Priority*: " + objData.fields.priority.name;
//                 }
//                 if (objData.fields.timespent !== null) {
//                     returnProjs = returnProjs + "\n*Time Spent*: " + objData.fields.timespent;
//                 }
//                 returnProjs = returnProjs + "\n*Progress / Total*: " + objData.fields.progress.progress + " / " + objData.fields.progress.total;
//                 if (objData.fields.watches !== null && objData.fields.watches.watchCount !== null) {
//                     returnProjs = returnProjs + "\n*Watch Count*: " + objData.fields.watches.watchCount;
//                 }


//                 returnProjs = returnProjs + "\n\n----------------------------\n\n";

//                 //   console.log("Task: " + objData.fields.summary);
//                 //   console.log("Description: " + objData.fields.description);
//             }
//             var payloadSlack = {
//                 "payload": {
//                     "slack": {
//                         "text": "Top IT JIRA Projects ...",
//                         "attachments": [{
//                             "text": returnProjs,
//                             "fallback": "Top IT JIRA Projects: \n" + returnProjs,
//                             "color": "#3AA3E3",
//                             "attachment_type": "default",
//                         }]
//                     },
//                     "outputContexts": [{
//                         "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/JIRA-Proj"
//                     }]
//                 }
//             };
//             res.send(payloadSlack);

//             // if (objData.fields.customfield_13941 === null && objData.fields.customfield_13940 === null) {
//             //     var payloadSlack = {
//             //         "payload": {
//             //             "slack": {
//             //                 "text": "Top IT JIRA Projects ...",
//             //                 "attachments": [{
//             //                     "text": returnProjs,
//             //                     "fallback": "Top IT JIRA Projects: \n" + returnProjs,
//             //                     "color": "#3AA3E3",
//             //                     "attachment_type": "default",
//             //                 }]
//             //             },
//             //             "outputContexts": [{
//             //                 "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/JIRA-Proj"
//             //             }]
//             //         }
//             //     };
//             //     res.send(payloadSlack);

//             // } else if (objData.fields.customfield_13941 === null && objData.fields.customfield_13940 !== null) {
//             //     var payloadSlack = {
//             //         "payload": {
//             //             "slack": {
//             //                 "text": "Top IT JIRA Projects ...",
//             //                 "attachments": [{
//             //                     "text": returnProjs,
//             //                     "fallback": "Top IT JIRA Projects: \n" + returnProjs,
//             //                     "color": "#3AA3E3",
//             //                     "attachment_type": "default",
//             //                 }],
//             //                 "actions": [{
//             //                     "text": "View Project Slide",
//             //                     "type": "button",
//             //                     "url": objData.fields.customfield_13940,
//             //                     "style": "primary"
//             //                 }]
//             //             },
//             //             "outputContexts": [{
//             //                 "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/JIRA-Proj"
//             //             }]
//             //         }
//             //     };
//             //     res.send(payloadSlack);

//             // } else if (objData.fields.customfield_13941 !== null && objData.fields.customfield_13940 === null) {
//             //     var payloadSlack = {
//             //         "payload": {
//             //             "slack": {
//             //                 "text": "Top IT JIRA Projects ...",
//             //                 "attachments": [{
//             //                     "text": returnProjs,
//             //                     "fallback": "Top IT JIRA Projects: \n" + returnProjs,
//             //                     "color": "#3AA3E3",
//             //                     "attachment_type": "default",
//             //                 }],
//             //                 "actions": [{
//             //                     "text": "View Project Schedule",
//             //                     "type": "button",
//             //                     "url": objData.fields.customfield_13940,
//             //                     "style": "primary"
//             //                 }]
//             //             },
//             //             "outputContexts": [{
//             //                 "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/JIRA-Proj"
//             //             }]
//             //         }
//             //     };
//             //     res.send(payloadSlack);

//             // } else if (objData.fields.customfield_13941 !== null && objData.fields.customfield_13940 !== null) {
//             //     var payloadSlack = {
//             //         "payload": {
//             //             "slack": {
//             //                 "text": "Top IT JIRA Projects ...",
//             //                 "attachments": [{
//             //                     "text": returnProjs,
//             //                     "fallback": "Top IT JIRA Projects: \n" + returnProjs,
//             //                     "color": "#3AA3E3",
//             //                     "attachment_type": "default",
//             //                 }],
//             //                 "actions": [{
//             //                         "text": "View Project Slide",
//             //                         "type": "button",
//             //                         "url": objData.fields.customfield_13940,
//             //                         "style": "primary"
//             //                     },
//             //                     {
//             //                         "text": "View Project Schedule",
//             //                         "type": "button",
//             //                         "url": objData.fields.customfield_13940,
//             //                         "style": "primary"
//             //                     }
//             //                 ]
//             //             },
//             //             "outputContexts": [{
//             //                 "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/JIRA-Proj"
//             //             }]
//             //         }
//             //     };
//             //     res.send(payloadSlack);
//             //  }
//         });
// }

function jiraSpecProjHandler(req, res, next) {
    var report = '';
    if (req.body.queryResult.queryText) {
        report = req.body.queryResult.queryText.toLowerCase().replace(/status of /g, "").replace(/status /g, "").trim();
    } else {
        report = 'top 10';
    }

    var options = {
        method: 'GET',
        url: 'https://billsdev.atlassian.net/rest/agile/1.0/board/305/epic/94481/issue',
        headers: {
            Authorization: 'Basic Z25laWdlckBmcmVlZG9tZmluYW5jaWFsbmV0d29yay5jb206ODVzSWNSSExTRGVua3VkaVlndkU0MUJG',
            Accept: 'application/json'
        }
    };

    var returnProjs = "";
    return rp(options)
        .then(body => {
            var matchCount = 0;
            var jsonData = JSON.parse(body);
            var numItems = jsonData.issues.length;
            //console.log("size: " + numItems);
            //console.log("BODY: " + body);
            for (var j = 0; j < numItems; j++) {
                var objData = jsonData.issues[j];
                var desc = "";
                if (objData.fields.status.name !== "Done" && (objData.fields.summary.trim().toLowerCase().includes(report.trim().toLowerCase()) || report.trim().includes('top 10'))) {

                    if (matchCount > 0) {
                        returnProjs = returnProjs + "\n\n----------------------------\n\n";
                    }
                    matchCount++;
                    if (objData.fields.description !== null) {
                        desc = objData.fields.description.replaceAll("*", "•"); //"&#x2022;");
                    }

                    var assigneeName = "";
                    if (objData.fields.assignee !== null) {
                        assigneeName = objData.fields.assignee.displayName;
                    }

                    if (objData.fields.customfield_13939 != null) {
                        switch (objData.fields.customfield_13939.value.toLowerCase()) {
                            case "green":
                                returnProjs = returnProjs + "*Project*: " + objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: " + objData.fields.status.name + " :thumbsup:\n*Highlights*:\n" + desc;
                                break;
                            case "yellow":
                                returnProjs = returnProjs + "*Project*: " + objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: " + objData.fields.status.name + " :thumbsup::thumbsdown:\n*Highlights*:\n" + desc;
                                break;
                            case "red":
                                returnProjs = returnProjs + "*Project*: " + objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: " + objData.fields.status.name + " :thumbsdown:\n*Highlights*:\n" + desc;
                                break;
                        }
                    } else {
                        returnProjs = returnProjs + "*Project*: " + objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: " + objData.fields.status.name + "\n" + desc;
                    }
                    //returnProjs = returnProjs + "*Project*: " + objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: :thumbsup:" + objData.fields.status.name + "\n*Highlights*:\n" + desc;
                    /*if(objData.fields.sprint !== null && objData.fields.sprint.startDate !== null && objData.fields.sprint.endDate !== null) {
                      var startDate = objData.fields.sprint.startDate;
                      
                      var endDate = objData.fields.sprint.endDate;
                      returnProjs = returnProjs + "\n*Start - End*: " + startDate + " - " + endDate;
                    }*/
                    if (objData.fields.customfield_13941 !== null) {
                        returnProjs = returnProjs + "\n*Project Slide*: " + objData.fields.customfield_13941;
                    }
                    if (objData.fields.customfield_13940 !== null) {
                        returnProjs = returnProjs + "\n*Project Schedule*: " + objData.fields.customfield_13940;
                    }
                    if (objData.fields.sprint !== null && objData.fields.sprint.state !== null) {
                        returnProjs = returnProjs + "\n*Sprint State*: " + objData.fields.sprint.state;
                    }
                    if (objData.fields.priority.name !== null) {
                        returnProjs = returnProjs + "\n*Priority*: " + objData.fields.priority.name;
                    }
                    if (objData.fields.timespent !== null) {
                        returnProjs = returnProjs + "\n*Time Spent*: " + objData.fields.timespent;
                    }
                    returnProjs = returnProjs + "\n*Progress / Total*: " + objData.fields.progress.progress + " / " + objData.fields.progress.total;
                    if (objData.fields.watches !== null && objData.fields.watches.watchCount !== null) {
                        returnProjs = returnProjs + "\n*Watch Count*: " + objData.fields.watches.watchCount;
                    }
                }

                //   console.log("Task: " + objData.fields.summary);
                //   console.log("Description: " + objData.fields.description);
            }
            if (returnProjs !== "") {
                var payloadSlack = {
                    "payload": {
                        "slack": {
                            "text": "IT JIRA Projects ...",
                            "attachments": [{
                                "text": returnProjs,
                                "fallback": "IT JIRA Projects: \n" + returnProjs,
                                "color": "#3AA3E3",
                                "attachment_type": "default",
                            }]
                        },
                        "outputContexts": [{
                            "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/JIRA-SpecProj"
                        }]
                    }
                };
                res.send(payloadSlack);


            } else {
                var payloadSlack = {
                    "payload": {
                        "slack": {
                            "text": "IT JIRA Projects ...",
                            "attachments": [{
                                "text": "Nothing was found while searching for " + report + ". Try again maybe type less words or a specific keyword.",
                                "fallback": "IT JIRA Projects: \nNothing was found while searching for " + report + ". Try again maybe type less words or a specific keyword.",
                                "color": "#3AA3E3",
                                "attachment_type": "default"
                            }]
                        },
                        "outputContexts": [{
                            "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/JIRA-SpecProj"
                        }]
                    }
                };
                res.send(payloadSlack);
            }
        })
        .catch(function (err) {
            logError(err, req.body.originalDetectIntentRequest.payload.data.event.user, 'JIRA-SpecProj', 'jiraSpecProjHandler');
        });
}




function newjiraSpecProjHandler(req, res, next) {
    var report = '';
    var totalItems = 0;
    var matchCount = 0;
    var attachmentArray = [];
    var actionArray = [];
    var projectSlide = '';
    //var sprintState = '';
    var status = '';
    var emojiStr = '';
    //var priority = '';
    //var progress = '';
    //var watchCount = '';
    var projSchedule = '';
    // var timeSpent = '';
    var startAtOffsetMultipiler = 1;
    if (req.body.queryResult.queryText) {
        report = req.body.queryResult.queryText.toLowerCase().replace(/status of /g, "").replace(/status /g, "").trim();
    } else {
        report = 'top 10';
    }

    // old url 'https://billsdev.atlassian.net/rest/agile/1.0/board/305/epic/94481/issue',
    var options = {
        method: 'GET',
        url: 'https://billsdev.atlassian.net/rest/agile/1.0/board/305/issue',
        headers: {
            Authorization: 'Basic Z25laWdlckBmcmVlZG9tZmluYW5jaWFsbmV0d29yay5jb206ODVzSWNSSExTRGVua3VkaVlndkU0MUJG',
            Accept: 'application/json'
        }
    };

    var returnProjs = "";
    return rp(options)
        .then(body => {
            var jsonData = JSON.parse(body);
            var numItems = jsonData.issues.length;
            totalItems = jsonData.total;
            for (var j = 0; j < numItems; j++) {
                actionArray = [];
                //priority = '';
                projectSlide = '';
                //sprintState = '';
                //priority = '';
                //progress = '';
                //watchCount = '';
                projSchedule = '';
                //timeSpent = '';
                emojiStr = '';
                objData = jsonData.issues[j];
                desc = "";
                //&& objData.fields.sprint.id === 1693
                //console.log(objData);
                if (objData.fields.status.name !== "Done" && (objData.fields.sprint !== null && objData.fields.sprint.id === 1693) && (objData.fields.summary.trim().toLowerCase().includes(report.trim().toLowerCase()) || report.trim().includes('top 10'))) {

                    // if (matchCount > 0) {
                    //     returnProjs = returnProjs + "\n\n----------------------------\n\n";
                    // }
                    matchCount++;
                    if (objData.fields.description !== null) {
                        desc = objData.fields.description.replaceAll("*", "•").replace('#', "•"); //"&#x2022;");
                    }

                    var assigneeName = "";
                    if (objData.fields.assignee !== null) {
                        assigneeName = objData.fields.assignee.displayName;
                    }
                    status = objData.fields.status.name;
                    if (objData.fields.customfield_13939 != null) {
                        switch (objData.fields.customfield_13939.value.toLowerCase()) {
                            case "green":
                                //returnProjs = returnProjs + "*Project*: " + objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: " + objData.fields.status.name + " :thumbsup:\n*Highlights*:\n" + desc;
                                emojiStr = " :thumbsup:";
                                break;
                            case "yellow":
                                //returnProjs = returnProjs + "*Project*: " + //objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: " + objData.fields.status.name + " :thumbsup::thumbsdown:\n*Highlights*:\n" + desc;
                                emojiStr = " :thumbsup::thumbsdown:";
                                break;
                            case "red":
                                //returnProjs = returnProjs + "*Project*: " + objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: " + objData.fields.status.name + " :thumbsdown:\n*Highlights*:\n" + desc;
                                emojiStr = " :thumbsdown:";
                                break;
                        }
                    }
                    /*else {
                                           returnProjs = returnProjs + "*Project*: " + objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: " + objData.fields.status.name + "\n" + desc;
                                       }*/
                    if (objData.fields.customfield_13941 !== null) {
                        //returnProjs = returnProjs + "\n*Project Slide*: " + objData.fields.customfield_13941;
                        projectSlide = objData.fields.customfield_13941;
                    }
                    if (objData.fields.customfield_13940 !== null) {
                        //returnProjs = returnProjs + "\n*Project Schedule*: " + objData.fields.customfield_13940;
                        projSchedule = objData.fields.customfield_13940;
                    }
                    // if (objData.fields.sprint !== null && objData.fields.sprint.state !== null) {
                    //     //returnProjs = returnProjs + "\n*Sprint State*: " + objData.fields.sprint.state;
                    //     sprintState = objData.fields.sprint.state;
                    // }
                    // if (objData.fields.priority.name !== null) {
                    //     //returnProjs = returnProjs + "\n*Priority*: " + 
                    //     priority = objData.fields.priority.name;
                    // }
                    // if (objData.fields.timespent !== null) {
                    //     //returnProjs = returnProjs + "\n*Time Spent*: " + objData.fields.timespent;
                    //     timeSpent = objData.fields.timespent;
                    // }
                    //returnProjs = returnProjs + "\n*Progress / Total*: " + objData.fields.progress.progress + " / " + objData.fields.progress.total;
                    // progress = objData.fields.progress.progress + " / " + objData.fields.progress.total;
                    // if (objData.fields.watches !== null && objData.fields.watches.watchCount !== null) {
                    //     //returnProjs = returnProjs + "\n*Watch Count*: " + objData.fields.watches.watchCount;
                    //     watchCount = objData.fields.watches.watchCount;
                    // }

                    actionArray.push({
                        //https://billsdev.atlassian.net/browse/PLAN-225
                        "text": "View in JIRA",
                        "type": "button",
                        "url": "https://billsdev.atlassian.net/browse/" + objData.key,
                        "style": "primary"

                    });

                    if (projectSlide !== '') {
                        actionArray.push({
                            "text": "View Project Slide",
                            "type": "button",
                            "url": projectSlide,
                            "style": "primary"

                        });
                    }

                    if (projSchedule !== '') {
                        actionArray.push({
                            "text": "View Project Schedule",
                            "type": "button",
                            "url": projSchedule,
                            "style": "primary"

                        });
                    }

                    attachmentArray.push({

                        "text": "*Highlights*:\n" + desc,
                        "fallback": objData.fields.summary,
                        "color": "#3AA3E3",
                        "attachment_type": "default",
                        "title": objData.fields.summary,
                        "fields": [{
                                "title": "Assignee",
                                "value": assigneeName,
                                "short": true
                            },
                            {
                                "title": "Status",
                                "value": status + emojiStr,
                                "short": true
                            },
                            {
                                "title": "Epic",
                                "value": objData.fields.epic !== null ? objData.fields.epic.summary : '',
                                "short": true
                            }
                        ],
                        "actions": actionArray
                    });
                }
            }
            startAtOffsetMultipiler = 1;
            var offset = startAtOffsetMultipiler * 50;
            while (totalItems > 50 && (startAtOffsetMultipiler * 50) < totalItems) {
                //console.log(startAtOffsetMultipiler + " " + totalItems);
                // process items above 50 until all items are processed
                // old url 'https://billsdev.atlassian.net/rest/agile/1.0/board/305/epic/94481/issue?startAt=' + offset.toString(),
                offset = startAtOffsetMultipiler * 50;

                //console.log("inside while loop offset is " + offset + " total is " + totalItems);
                var moreOptions = {
                    method: 'GET',
                    url: 'https://billsdev.atlassian.net/rest/agile/1.0/board/305/issue?startAt=' + offset.toString(),
                    headers: {
                        Authorization: 'Basic Z25laWdlckBmcmVlZG9tZmluYW5jaWFsbmV0d29yay5jb206ODVzSWNSSExTRGVua3VkaVlndkU0MUJG',
                        Accept: 'application/json'
                    }
                };


                return rp(moreOptions)
                    .then(body => {
                        // if (body !== null) {
                        //     console.log("body is not null");
                        //     console.log(body);
                        // }
                        actionArray = [];
                        var jsonData = JSON.parse(body);
                        var numItems = jsonData.issues.length;
                        //console.log("numItems " + numItems);
                        //console.log("numItems: " + numItems);
                        for (var j = 0; j < numItems; j++) {
                            //console.log("iteration " + j);

                            //priority = '';
                            projectSlide = '';
                            //sprintState = '';
                            //priority = '';
                            //progress = '';
                            //watchCount = '';
                            projSchedule = '';
                            //timeSpent = '';
                            emojiStr = '';
                            objData = jsonData.issues[j];
                            desc = "";
                            //&& objData.fields.sprint.id === 1693
                            //console.log(objData);
                            if (objData.fields.status.name !== "Done" && (objData.fields.sprint !== null && objData.fields.sprint.id === 1693) && (objData.fields.summary.trim().toLowerCase().includes(report.trim().toLowerCase()) || report.trim().includes('top 10'))) {

                                // if (matchCount > 0) {
                                //     returnProjs = returnProjs + "\n\n----------------------------\n\n";
                                // }
                                matchCount++;
                                if (objData.fields.description !== null) {
                                    desc = objData.fields.description.replaceAll("*", "•").replace('#', "•"); //"&#x2022;");
                                }

                                var assigneeName = "";
                                if (objData.fields.assignee !== null) {
                                    assigneeName = objData.fields.assignee.displayName;
                                }
                                status = objData.fields.status.name;
                                if (objData.fields.customfield_13939 != null) {
                                    switch (objData.fields.customfield_13939.value.toLowerCase()) {
                                        case "green":
                                            //returnProjs = returnProjs + "*Project*: " + objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: " + objData.fields.status.name + " :thumbsup:\n*Highlights*:\n" + desc;
                                            emojiStr = " :thumbsup:";
                                            break;
                                        case "yellow":
                                            //returnProjs = returnProjs + "*Project*: " + //objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: " + objData.fields.status.name + " :thumbsup::thumbsdown:\n*Highlights*:\n" + desc;
                                            emojiStr = " :thumbsup::thumbsdown:";
                                            break;
                                        case "red":
                                            //returnProjs = returnProjs + "*Project*: " + objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: " + objData.fields.status.name + " :thumbsdown:\n*Highlights*:\n" + desc;
                                            emojiStr = " :thumbsdown:";
                                            break;
                                    }
                                }
                                /*else {
                                                       returnProjs = returnProjs + "*Project*: " + objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: " + objData.fields.status.name + "\n" + desc;
                                                   }*/
                                if (objData.fields.customfield_13941 !== null) {
                                    //returnProjs = returnProjs + "\n*Project Slide*: " + objData.fields.customfield_13941;
                                    projectSlide = objData.fields.customfield_13941;
                                }
                                if (objData.fields.customfield_13940 !== null) {
                                    //returnProjs = returnProjs + "\n*Project Schedule*: " + objData.fields.customfield_13940;
                                    projSchedule = objData.fields.customfield_13940;
                                }
                                // if (objData.fields.sprint !== null && objData.fields.sprint.state !== null) {
                                //     //returnProjs = returnProjs + "\n*Sprint State*: " + objData.fields.sprint.state;
                                //     sprintState = objData.fields.sprint.state;
                                // }
                                // if (objData.fields.priority.name !== null) {
                                //     //returnProjs = returnProjs + "\n*Priority*: " + 
                                //     priority = objData.fields.priority.name;
                                // }
                                // if (objData.fields.timespent !== null) {
                                //     //returnProjs = returnProjs + "\n*Time Spent*: " + objData.fields.timespent;
                                //     timeSpent = objData.fields.timespent;
                                // }
                                //returnProjs = returnProjs + "\n*Progress / Total*: " + objData.fields.progress.progress + " / " + objData.fields.progress.total;
                                // progress = objData.fields.progress.progress + " / " + objData.fields.progress.total;
                                // if (objData.fields.watches !== null && objData.fields.watches.watchCount !== null) {
                                //     //returnProjs = returnProjs + "\n*Watch Count*: " + objData.fields.watches.watchCount;
                                //     watchCount = objData.fields.watches.watchCount;
                                // }

                                actionArray.push({
                                    //https://billsdev.atlassian.net/browse/PLAN-225
                                    "text": "View in JIRA",
                                    "type": "button",
                                    "url": "https://billsdev.atlassian.net/browse/" + objData.key,
                                    "style": "primary"

                                });

                                if (projectSlide !== '') {
                                    actionArray.push({
                                        "text": "View Project Slide",
                                        "type": "button",
                                        "url": projectSlide,
                                        "style": "primary"

                                    });
                                }

                                if (projSchedule !== '') {
                                    actionArray.push({
                                        "text": "View Project Schedule",
                                        "type": "button",
                                        "url": projSchedule,
                                        "style": "primary"

                                    });
                                }


                                attachmentArray.push({

                                    "text": "*Highlights*:\n" + desc,
                                    "fallback": objData.fields.summary,
                                    "color": "#3AA3E3",
                                    "attachment_type": "default",
                                    "title": objData.fields.summary,
                                    "fields": [{
                                            "title": "Assignee",
                                            "value": assigneeName,
                                            "short": true
                                        },
                                        {
                                            "title": "Status",
                                            "value": status + emojiStr,
                                            "short": true
                                        },
                                        {
                                            "title": "Epic",
                                            "value": objData.fields.epic !== null ? objData.fields.epic.summary : '',
                                            "short": true
                                        }
                                    ],
                                    "actions": actionArray
                                });

                            }


                        }



                        // var objData = jsonData.issues[j];
                        // var desc = "";
                        // if (objData.fields.status.name !== "Done" && (objData.fields.sprint !== null && objData.fields.sprint.id === 1693) && (objData.fields.summary.trim().toLowerCase().includes(report.trim().toLowerCase()) || report.trim().includes('top 10'))) {

                        //     if (matchCount > 0) {
                        //         returnProjs = returnProjs + "\n\n----------------------------\n\n";
                        //     }
                        //     matchCount++;
                        //     if (objData.fields.description !== null) {
                        //         desc = objData.fields.description.replaceAll("*", "•"); //"&#x2022;");
                        //     }

                        //     var assigneeName = "";
                        //     if (objData.fields.assignee !== null) {
                        //         assigneeName = objData.fields.assignee.displayName;
                        //     }

                        //     if (objData.fields.customfield_13939 != null) {
                        //         switch (objData.fields.customfield_13939.value.toLowerCase()) {
                        //             case "green":
                        //                 returnProjs = returnProjs + "*Project*: " + objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: " + objData.fields.status.name + " :thumbsup:\n*Highlights*:\n" + desc;
                        //                 break;
                        //             case "yellow":
                        //                 returnProjs = returnProjs + "*Project*: " + objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: " + objData.fields.status.name + " :thumbsup::thumbsdown:\n*Highlights*:\n" + desc;
                        //                 break;
                        //             case "red":
                        //                 returnProjs = returnProjs + "*Project*: " + objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: " + objData.fields.status.name + " :thumbsdown:\n*Highlights*:\n" + desc;
                        //                 break;
                        //         }
                        //     } else {
                        //         returnProjs = returnProjs + "*Project*: " + objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: " + objData.fields.status.name + "\n" + desc;
                        //     }
                        //     if (objData.fields.customfield_13941 !== null) {
                        //         returnProjs = returnProjs + "\n*Project Slide*: " + objData.fields.customfield_13941;
                        //     }
                        //     if (objData.fields.customfield_13940 !== null) {
                        //         returnProjs = returnProjs + "\n*Project Schedule*: " + objData.fields.customfield_13940;
                        //     }
                        //     if (objData.fields.sprint !== null && objData.fields.sprint.state !== null) {
                        //         returnProjs = returnProjs + "\n*Sprint State*: " + objData.fields.sprint.state;
                        //     }
                        //     if (objData.fields.priority.name !== null) {
                        //         returnProjs = returnProjs + "\n*Priority*: " + objData.fields.priority.name;
                        //     }
                        //     if (objData.fields.timespent !== null) {
                        //         returnProjs = returnProjs + "\n*Time Spent*: " + objData.fields.timespent;
                        //     }
                        //     returnProjs = returnProjs + "\n*Progress / Total*: " + objData.fields.progress.progress + " / " + objData.fields.progress.total;
                        //     if (objData.fields.watches !== null && objData.fields.watches.watchCount !== null) {
                        //         returnProjs = returnProjs + "\n*Watch Count*: " + objData.fields.watches.watchCount;
                        //     }
                        // }
                        //}
                        if (((startAtOffsetMultipiler + 1) * 50) > totalItems) {
                            if (attachmentArray.length > 0) {
                                var payloadSlack = {
                                    "payload": {
                                        "slack": {
                                            "text": "IT JIRA Projects ...",
                                            "attachments": attachmentArray,
                                        },
                                        "outputContexts": [{
                                            "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/JIRA-SpecProj"
                                        }]
                                    }
                                };
                                res.send(payloadSlack);


                            } else {
                                var payloadSlack = {
                                    "payload": {
                                        "slack": {
                                            "text": "IT JIRA Projects ...",
                                            "attachments": [{
                                                "text": "Nothing was found while searching for " + report + ". Try again maybe type less words or a specific keyword.",
                                                "fallback": "IT JIRA Projects: \nNothing was found while searching for " + report + ". Try again maybe type less words or a specific keyword.",
                                                "color": "#3AA3E3",
                                                "attachment_type": "default"
                                            }]
                                        },
                                        "outputContexts": [{
                                            "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/JIRA-SpecProj"
                                        }]
                                    }
                                };
                                res.send(payloadSlack);
                            }
                        }
                        startAtOffsetMultipiler++;
                    })
                    .catch(function (err) {
                        logError('inside request an error occured. Error: ' + err, req.body.originalDetectIntentRequest.payload.data.event.user, 'JIRA-SpecProj', 'newjiraSpecProjHandler');
                        console.log('newjiraSpecProjHandler inside request an error occured.' + err);
                    });

            }

            if (totalItems < 50) {
                if (returnProjs !== "") {
                    var payloadSlack = {
                        "payload": {
                            "slack": {
                                "text": "IT JIRA Projects ...",
                                "attachments": [{
                                    "text": returnProjs,
                                    "fallback": "IT JIRA Projects: \n" + returnProjs,
                                    "color": "#3AA3E3",
                                    "attachment_type": "default",
                                }]
                            },
                            "outputContexts": [{
                                "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/JIRA-SpecProj"
                            }]
                        }
                    };
                    res.send(payloadSlack);


                } else {
                    var payloadSlack = {
                        "payload": {
                            "slack": {
                                "text": "IT JIRA Projects ...",
                                "attachments": [{
                                    "text": "Nothing was found while searching for " + report + ". Try again maybe type less words or a specific keyword.",
                                    "fallback": "IT JIRA Projects: \nNothing was found while searching for " + report + ". Try again maybe type less words or a specific keyword.",
                                    "color": "#3AA3E3",
                                    "attachment_type": "default"
                                }]
                            },
                            "outputContexts": [{
                                "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/JIRA-SpecProj"
                            }]
                        }
                    };
                    res.send(payloadSlack);
                }
            }


        })
        .catch(function (err) {
            logError('inital request to get data Error: ' + err, req.body.originalDetectIntentRequest.payload.data.event.user, 'JIRA-SpecProj', 'newjiraSpecProjHandler');
        });
}


function jiraMyTasksHandler(req, res, next) {

    queueTask(req.body.originalDetectIntentRequest.payload.data.event.user, req.body.originalDetectIntentRequest.payload.data.event.channel, req.body);

    var payloadError = {
        "payload": {
            "slack": {
                "text": "Fetching My JIRA Tasks ...",
                "attachments": [{
                    "text": 'Please standby as I fetch your JIRA tasks.',
                    "fallback": "Please standby as I fetch your JIRA tasks.",
                    "color": "#3AA3E3",
                    "attachment_type": "default"
                }]
            },
            "outputContexts": [{
                "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/JIRA-MyTasks"
            }]
        }
    };

    res.send(payloadError);
}

async function getSmartSheetsSlackArray(tryUserName) {
    var itemsFound = false;

    var totalMatches = 0;
    var arrayAttachment = [];
    var tasksForProjectArray = [];
    var searchCompleted = false;
    var totalProjects = 0;
    var currProjectsFetched = 0;
    var matchAssignee = false;
    //var tryUserName = '';
    var utcNow = new Date();
    var utc = new Date().toJSON().slice(0, 10);


    var options = {
        method: 'GET',
        url: 'https://api.smartsheet.com/2.0/workspaces/4899343921637252',
        headers: {
            Accept: 'application/json',
            Authorization: 'Authorization: Bearer mcb931esji6tlnxteyk2016ndh'
        }
    };

    return rp(options)
        .then(body => {
            var result = JSON.parse(body);
            totalProjects = result.sheets.length;
            for (var i = 0; i < totalProjects; i++) {

                var sheetId = result.sheets[i].id; // Choose the first sheet
                //console.log(sheetId);
                // Load one sheet

                var optionsBySheet = {
                    method: 'GET',
                    url: 'https://api.smartsheet.com/2.0/sheets/' + sheetId,
                    headers: {
                        Accept: 'application/json',
                        Authorization: 'Authorization: Bearer mcb931esji6tlnxteyk2016ndh'
                    }
                };
                return rp(optionsBySheet)
                    .then(sheet => {
                        var sheetInfo = JSON.parse(sheet);

                        //var fieldsArray = [];
                        var taskNameId = 0;
                        var statusId = 0;
                        var startId = 0;
                        var finishId = 0;
                        var assignedId = 0;
                        var percentCompletedId = 0;
                        var totalPopulationId = 0;
                        var commentsId = 0;
                        var completionId = 0;
                        var migratedId = 0;
                        var percentMigratedId = 0;
                        var okToAdd = false;
                        var adjFinishId = 0;
                        var concernsId = 0;
                        var workID = 0;
                        var pcomplete = 0;
                        matchAssignee = false;
                        currProjectsFetched++;
                        var tasksForProject = "";
                        for (var n = 0; n < sheetInfo.columns.length; n++) {
                            var columnData = sheetInfo.columns[n];

                            switch (columnData.title.toLowerCase()) {
                                case "task name":
                                case "deliverable":
                                case "feature/epic":
                                case "key deliverables":
                                    taskNameId = columnData.id;
                                    break;
                                case "start":
                                case "start date":
                                    startId = columnData.id;
                                    break;
                                case "finish":
                                case "end date":
                                    finishId = columnData.id;
                                    break;
                                case "assigned to":
                                    assignedId = columnData.id;
                                    break;
                                case "status":
                                    statusId = columnData.id;
                                    break;
                                case "comments":
                                    commentsId = columnData.id;
                                    break;
                                case "completion":
                                    completionId = columnData.id;
                                    break;
                                case "total population":
                                    totalPopulationId = columnData.id;
                                    break;
                                case "migrated":
                                    migratedId = columnData.id;
                                    break;
                                case "percent migrated":
                                    percentMigratedId = columnData.id;
                                    break;
                                case "adjusted finish":
                                    adjFinishId = columnData.id;
                                    break;
                                case "concerns":
                                    concernsId = columnData.id;
                                    break;
                                case "work":
                                    workID = columnData.id;
                                    break;
                                case "% complete":
                                    percentCompletedId = columnData.id;
                                    break;
                                case "duration":
                                case "predecessors":

                                case "status %":
                                    pcomplete = columnData.id;
                                    break;
                                case "column14":
                                case "pred.":
                                case "monitor":
                                    break;
                                default:
                                    console.log("Error should not be able to find a column id. Check the names for sheet id: " + sheetInfo.id + " Title: " + columnData.title);
                                    break;
                            }
                        }

                        //console.log("assigneeColumnId: " + assignedId + " projId: " + sheetInfo.id);
                        //console.log("\n\n--------------------------------------------------\nProject: " + sheetInfo.name + "\n--------------------------------------------------");
                        okToAdd = false;
                        passedDatecheck = false;
                        if (assignedId !== 0) {
                            tasksForProjectArray = [];
                            for (var j = 0; j < sheetInfo.rows.length; j++) {

                                var taskName = "";
                                var finishDate = "";
                                var percentCompleted = "";
                                var taskStatus = "";
                                var startDate = "";
                                var completion = "";

                                for (var k = 0; k < sheetInfo.rows[j].cells.length; k++) {
                                    var rowObj = sheetInfo.rows[j];
                                    var cellObj = rowObj.cells[k];

                                    try {
                                        if (taskNameId !== 0 && cellObj.columnId === taskNameId && cellObj.value !== null && cellObj.value !== undefined) {
                                            okToAdd = true;
                                            taskName = cellObj.value;
                                            //taskRow = taskRow + "\n\n• " + cellObj.value;
                                            //console.log("\n√ " + cellObj.value);
                                            // fieldsArray.push({
                                            //     "title": "Task",
                                            //     "value": cellObj.value,
                                            //     "short": false
                                            // });
                                        }
                                        //Status id 8321226008487812
                                        else if (statusId !== 0 && cellObj.columnId === statusId && cellObj.value !== null && cellObj.value !== undefined) {
                                            taskStatus = " - " + cellObj.value;
                                            //taskRow = taskRow + "\n  Status: " + cellObj.value;
                                            // fieldsArray.push({
                                            //     "title": "Status",
                                            //     "value": cellObj.value,
                                            //     "short": true
                                            // });
                                        }
                                        // Completion 
                                        else if (completionId !== 0 && cellObj.columnId === completionId && cellObj.value !== null && cellObj.value !== undefined) {

                                            completion = " - " + cellObj.value;
                                            console.log("completion " + completion);
                                            //taskRow = taskRow + "\n  Status: " + cellObj.value;
                                            // fieldsArray.push({
                                            //     "title": "Status",
                                            //     "value": cellObj.value,
                                            //     "short": true
                                            // });
                                        }
                                        // Start
                                        else if (cellObj.columnId === startId && cellObj.value !== null && cellObj.value !== undefined) {
                                            //taskRow = taskRow + "\n  Start: " + cellObj.value;

                                            startDate = cellObj.value;

                                            // fieldsArray.push({
                                            //     "title": "Start",
                                            //     "value": cellObj.value,
                                            //     "short": true
                                            // });
                                        }
                                        // Finish id 7195326101645188
                                        else if (finishId !== 0 && cellObj.columnId === finishId && cellObj.value !== null && cellObj.value !== undefined) {
                                            //taskRow = taskRow + "\n  Finish: " + cellObj.value;
                                            finishDate = " - " + cellObj.value;


                                            // fieldsArray.push({
                                            //     "title": "Finish",
                                            //     "value": cellObj.value,
                                            //     "short": true
                                            // });
                                        }
                                        // else if (percentCompletedId !== 0 && cellObj.columnId === percentCompletedId && cellObj.value !== null && cellObj.value !== undefined) {
                                        //     //taskRow = taskRow + "\n  Finish: " + cellObj.value;
                                        //     percentCompleted = cellObj.value;
                                        //     // fieldsArray.push({
                                        //     //     "title": "% Completed",
                                        //     //     "value": cellObj.value,
                                        //     //     "short": true
                                        //     // });
                                        // }
                                        //Assigned To 
                                        else if (assignedId !== 0 && cellObj.columnId === assignedId && cellObj.value !== null && cellObj.value !== undefined) {
                                            //taskRow = taskRow + "\n  Assignee: " + cellObj.value;
                                            //console.log(" Assignee: " + cellObj.value);
                                            if (cellObj.value.toLowerCase().includes(tryUserName)) {
                                                matchAssignee = true;
                                                itemsFound = true;
                                                totalMatches++;
                                            }
                                            // fieldsArray.push({
                                            //     "title": "Assigned To",
                                            //     "value": cellObj.value,
                                            //     "short": true
                                            // });
                                        }
                                        //else if (cellObj.columnId === totalPopulationId && cellObj.value !== null && cellObj.value !== undefined) {
                                        //     //taskRow = taskRow + "\n  Total Population: " + cellObj.value;
                                        //     //console.log(" Assignee: " + cellObj.value);
                                        //     fieldsArray.push({
                                        //         "title": "Total Population",
                                        //         "value": cellObj.value,
                                        //         "short": true
                                        //     });
                                        // } else if (cellObj.columnId === migratedId && cellObj.value !== null && cellObj.value !== undefined) {
                                        //     //taskRow = taskRow + "\n  Migrated: " + cellObj.value;
                                        //     //console.log(" Assignee: " + cellObj.value);
                                        //     fieldsArray.push({
                                        //         "title": "Migrated",
                                        //         "value": cellObj.value,
                                        //         "short": true
                                        //     });
                                        // } else if (cellObj.columnId === percentMigratedId && cellObj.value !== null && cellObj.value !== undefined) {
                                        //     //taskRow = taskRow + "\n  % Migrated: " + cellObj.value;
                                        //     //console.log(" Assignee: " + cellObj.value);
                                        //     fieldsArray.push({
                                        //         "title": "% Migrated",
                                        //         "value": cellObj.value,
                                        //         "short": true
                                        //     });
                                        // } else if (cellObj.columnId === adjFinishId && cellObj.value !== null && cellObj.value !== undefined) {
                                        //     //taskRow = taskRow + "\n  Adjusted Finish: " + cellObj.value;
                                        //     //console.log(" Assignee: " + cellObj.value);
                                        //     const newLocal = fieldsArray.push({
                                        //         "title": "Adjusted Finish",
                                        //         "value": cellObj.value,
                                        //         "short": true
                                        //     });
                                        // } else if (cellObj.columnId === concernsId && cellObj.value !== null && cellObj.value !== undefined) {
                                        //     //taskRow = taskRow + "\n  Concerns: " + cellObj.value;
                                        //     //console.log(" Assignee: " + cellObj.value);
                                        //     fieldsArray.push({
                                        //         "title": "Concerns",
                                        //         "value": cellObj.value,
                                        //         "short": true
                                        //     });
                                        // } else if (cellObj.columnId === workID && cellObj.value !== null && cellObj.value !== undefined) {
                                        //     //taskRow = taskRow + "\n  Work: " + cellObj.value;
                                        //     //console.log(" Assignee: " + cellObj.value);
                                        //     fieldsArray.push({
                                        //         "title": "Work",
                                        //         "value": cellObj.value,
                                        //         "short": true
                                        //     });
                                        // }
                                        else if (percentCompletedId !== 0 && cellObj.columnId === percentCompletedId && cellObj.value !== null && cellObj.value !== undefined) {
                                            //taskRow = taskRow + "\n  Finish: " + cellObj.value;
                                            percentCompleted = " - " + cellObj.value;
                                            //console.log("% completed: " + percentCompleted);
                                            // fieldsArray.push({
                                            //     "title": "% Completed",
                                            //     "value": cellObj.value,
                                            //     "short": true
                                            // });
                                        }


                                    } catch (err) {
                                        console.log(cellObj + " error: " + err);
                                        return [];
                                    }

                                    // if (matchAssignee && i === result.data.length) {
                                    //     arrayAttachment.push({

                                    //         "text": "",
                                    //         "fallback": "*Project: " + sheetInfo.name + "*",
                                    //         "color": "#3AA3E3",
                                    //         "attachment_type": "default",
                                    //         "title": "",
                                    //         "fields": fieldsArray,
                                    //         "actions": [{

                                    //             "text": "View Project",
                                    //             "type": "button",
                                    //             "url": sheetInfo.permalink,
                                    //             "style": "primary"
                                    //         }]
                                    //     });
                                    // }


                                }

                                if ((startDate <= utc || (finishDate.length > 0 && finishDate >= utc) && taskStatus !== "Complete" && completion.toLocaleLowerCase() !== "full")) {
                                    tasksForProjectArray.push({
                                        "taskName": taskName.substr(0, 20),
                                        "finishDate": finishDate,
                                        "percentCompleted": percentCompleted,
                                        "taskStatus": taskStatus
                                    });
                                }



                            }
                        } // if no assignee don't do any adding of the user information. 

                        // if (matchAssignee) {
                        //     var payloadSlack = {
                        //         "payload": {
                        //             "slack": {
                        //                 "text": "*Project: " + sheetInfo.name + "*",
                        //                 "attachments": arrayAttachment
                        //             },
                        //             "outputContexts": [{
                        //                 "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/smartSheets"
                        //             }]
                        //         }
                        //     };
                        //     console.log(payloadSlack);
                        //     res.send(payloadSlack);
                        // }




                        if (matchAssignee) {

                            tasksForProjectArray = tasksForProjectArray.sort(sortUtil.sortByDate);

                            for (var m = 0; m < tasksForProjectArray.length; m++) {
                                tasksForProject = tasksForProject + " • *" + tasksForProjectArray[m].taskName + "*" + tasksForProjectArray[m].finishDate + tasksForProjectArray[m].percentCompleted + tasksForProjectArray[m].taskStatus + "\n";

                            }
                            //console.log("pushing smartsheet for sheet " + sheetInfo.name + "\n" + tasksForProject);
                            arrayAttachment.push({

                                "text": tasksForProject,
                                "fallback": "Project: " + sheetInfo.name,
                                "color": "#3AA3E3",
                                "attachment_type": "default",
                                "title": "Project: " + sheetInfo.name,
                                "actions": [{

                                    "text": "View Project",
                                    "type": "button",
                                    "url": sheetInfo.permalink,
                                    "style": "primary"
                                }]
                            });
                        }

                        if (searchCompleted && totalMatches === currProjectsFetched) {

                            return arrayAttachment;
                        }
                    })
                    .catch(function (err) {
                        console.log(error);
                        return [];
                    });

            }

        })
        .catch(function (error) {
            console.log(error);
            return [];
        });
}

function smartSheetsHandler2(tryUserName, res) {

    var itemsFound = false;
    var currProjectsFetched = 0;
    var currProjectIndex = 0;
    var passedDatecheck = false;
    var sheetArray = [];
    var slackFullName = '';
    var totalMatches = 0;
    var arrayAttachment = [];
    var tasksForProjectArray = [];
    var searchCompleted = false;
    var totalProjects = 0;
    var matchAssignee = false;
    var tryUserName = '';
    var utcNow = new Date();
    var utc = new Date().toJSON().slice(0, 10);

    var options = {
        method: 'GET',
        url: 'https://api.smartsheet.com/2.0/workspaces/4899343921637252',
        headers: {
            Accept: 'application/json',
            Authorization: 'Authorization: Bearer mcb931esji6tlnxteyk2016ndh'
        }
    };

    return rp(options)
        .then(body => {

            var result = {
                "data": JSON.parse(body)
            };
            totalProjects = result.data.sheets.length;
            //console.log(totalProjects);
            while (currProjectIndex < totalProjects) {
                try {

                    var sheetId = result.data.sheets[currProjectIndex].id;

                    var optionsBySheet = {
                        method: 'GET',
                        url: 'https://api.smartsheet.com/2.0/sheets/' + sheetId,
                        headers: {
                            Accept: 'application/json',
                            Authorization: 'Authorization: Bearer mcb931esji6tlnxteyk2016ndh'
                        }
                    };


                    return rp(optionsBySheet)
                        .then(sheetBody => {

                            currProjectsFetched++;

                            currProjectIndex++;

                            sheetArray.push(JSON.parse(sheetBody));

                        })
                        .catch(function (error) {
                            console.log(error);
                            currProjectIndex = totalProjects;
                        });
                } catch (err) {
                    console.log(err);
                }
            }

            if (currProjectsFetched === totalProjects) {
                console.log("got all projs");
                for (var k = 0; k < sheetArray.length; k++) {

                    // for (var i = 0; i < sheetArray[k].sheets.length; i++) {
                    var sheetInfo = sheetArray[k];
                    var fieldsArray = [];
                    var taskNameId = 0;
                    var statusId = 0;
                    var startId = 0;
                    var finishId = 0;
                    var assignedId = 0;
                    var percentCompletedId = 0;
                    var totalPopulationId = 0;
                    var commentsId = 0;
                    var completionId = 0;
                    var migratedId = 0;
                    var percentMigratedId = 0;
                    var okToAdd = false;
                    var adjFinishId = 0;
                    var concernsId = 0;
                    var workID = 0;
                    var pcomplete = 0;
                    matchAssignee = false;
                    //currProjectsFetched++;
                    var tasksForProject = "";
                    for (var n = 0; n < sheetInfo.columns.length; n++) {
                        var columnData = sheetInfo.columns[n];

                        switch (columnData.title.toLowerCase()) {
                            case "task name":
                            case "deliverable":
                            case "feature/epic":
                            case "key deliverables":
                                taskNameId = columnData.id;
                                break;
                            case "start":
                            case "start date":
                                startId = columnData.id;
                                break;
                            case "finish":
                            case "end date":
                                finishId = columnData.id;
                                break;
                            case "assigned to":
                                assignedId = columnData.id;
                                break;
                            case "status":
                                statusId = columnData.id;
                                break;
                            case "comments":
                                commentsId = columnData.id;
                                break;
                            case "completion":
                                completionId = columnData.id;
                                break;
                            case "total population":
                                totalPopulationId = columnData.id;
                                break;
                            case "migrated":
                                migratedId = columnData.id;
                                break;
                            case "percent migrated":
                                percentMigratedId = columnData.id;
                                break;
                            case "adjusted finish":
                                adjFinishId = columnData.id;
                                break;
                            case "concerns":
                                concernsId = columnData.id;
                                break;
                            case "work":
                                workID = columnData.id;
                                break;
                            case "% complete":
                                percentCompletedId = columnData.id;
                                break;
                            case "duration":
                            case "predecessors":
                                break;
                            case "status %":
                                pcomplete = columnData.id;
                                break;
                            case "column14":
                            case "pred.":
                            case "monitor":
                                break;
                            default:
                                console.log("Error should not be able to find a column id. Check the names for sheet id: " + sheetInfo.id + " Title: " + columnData.title);
                                break;
                        }
                    }

                    okToAdd = false;
                    passedDatecheck = false;
                    if (assignedId !== 0) {
                        tasksForProjectArray = [];
                        for (var j = 0; j < sheetInfo.rows.length; j++) {

                            var taskName = "";
                            var finishDate = "";
                            var percentCompleted = "";
                            var taskStatus = "";
                            var startDate = "";
                            var completion = "";

                            for (var k = 0; k < sheetInfo.rows[j].cells.length; k++) {
                                var rowObj = sheetInfo.rows[j];
                                var cellObj = rowObj.cells[k];

                                if (taskNameId !== 0 && cellObj.columnId === taskNameId && cellObj.value !== null && cellObj.value !== undefined) {
                                    okToAdd = true;
                                    taskName = cellObj.value;
                                    //taskRow = taskRow + "\n\n• " + cellObj.value;
                                    //console.log("\n√ " + cellObj.value);
                                    // fieldsArray.push({
                                    //     "title": "Task",
                                    //     "value": cellObj.value,
                                    //     "short": false
                                    // });
                                }
                                //Status id 8321226008487812
                                else if (statusId !== 0 && cellObj.columnId === statusId && cellObj.value !== null && cellObj.value !== undefined) {
                                    taskStatus = " - " + cellObj.value;
                                    //taskRow = taskRow + "\n  Status: " + cellObj.value;
                                    // fieldsArray.push({
                                    //     "title": "Status",
                                    //     "value": cellObj.value,
                                    //     "short": true
                                    // });
                                }
                                // Completion 
                                else if (pcomplete !== 0 && cellObj.columnId === pcomplete && cellObj.value !== null && cellObj.value !== undefined) {
                                    completion = " - " + cellObj.value;
                                    //taskRow = taskRow + "\n  Status: " + cellObj.value;
                                    // fieldsArray.push({
                                    //     "title": "Status",
                                    //     "value": cellObj.value,
                                    //     "short": true
                                    // });
                                }
                                // Start
                                else if (cellObj.columnId === startId && cellObj.value !== null && cellObj.value !== undefined) {
                                    //taskRow = taskRow + "\n  Start: " + cellObj.value;

                                    startDate = cellObj.value;

                                    // fieldsArray.push({
                                    //     "title": "Start",
                                    //     "value": cellObj.value,
                                    //     "short": true
                                    // });
                                }
                                // Finish id 7195326101645188
                                else if (finishId !== 0 && cellObj.columnId === finishId && cellObj.value !== null && cellObj.value !== undefined) {
                                    //taskRow = taskRow + "\n  Finish: " + cellObj.value;
                                    finishDate = " - " + cellObj.value;


                                    // fieldsArray.push({
                                    //     "title": "Finish",
                                    //     "value": cellObj.value,
                                    //     "short": true
                                    // });
                                }
                                // else if (percentCompletedId !== 0 && cellObj.columnId === percentCompletedId && cellObj.value !== null && cellObj.value !== undefined) {
                                //     //taskRow = taskRow + "\n  Finish: " + cellObj.value;
                                //     percentCompleted = cellObj.value;
                                //     // fieldsArray.push({
                                //     //     "title": "% Completed",
                                //     //     "value": cellObj.value,
                                //     //     "short": true
                                //     // });
                                // }
                                //Assigned To 
                                else if (assignedId !== 0 && cellObj.columnId === assignedId && cellObj.value !== null && cellObj.value !== undefined) {
                                    //taskRow = taskRow + "\n  Assignee: " + cellObj.value;
                                    //console.log(" Assignee: " + cellObj.value);
                                    if (cellObj.value.toLowerCase().includes(tryUserName)) {
                                        matchAssignee = true;
                                        itemsFound = true;
                                        totalMatches++;
                                    }
                                    // fieldsArray.push({
                                    //     "title": "Assigned To",
                                    //     "value": cellObj.value,
                                    //     "short": true
                                    // });
                                } else if (percentCompletedId !== 0 && cellObj.columnId === percentCompletedId && cellObj.value !== null && cellObj.value !== undefined) {
                                    //taskRow = taskRow + "\n  Finish: " + cellObj.value;
                                    percentCompleted = " - " + cellObj.value;
                                    //console.log("% completed: " + percentCompleted);
                                    // fieldsArray.push({
                                    //     "title": "% Completed",
                                    //     "value": cellObj.value,
                                    //     "short": true
                                    // });
                                }
                            }

                            if (startDate <= utc && percentCompleted !== 1 && taskStatus !== " - Completed" && completion.toLocaleLowerCase() !== "full" && matchAssignee) {
                                tasksForProjectArray.push({
                                    "taskName": taskName.substr(0, 20),
                                    "finishDate": finishDate,
                                    "percentCompleted": percentCompleted,
                                    "taskStatus": taskStatus
                                });
                            }
                        }
                    } // if no assignee don't do any adding of the user information. 

                    if (matchAssignee) {

                        //tasksForProjectArray = tasksForProjectArray.sort(sortUtil.sortByDate);

                        for (var m = 0; m < tasksForProjectArray.length; m++) {
                            tasksForProject = tasksForProject + " • *" + tasksForProjectArray[m].taskName + "*" + tasksForProjectArray[m].finishDate + tasksForProjectArray[m].percentCompleted + tasksForProjectArray[m].taskStatus + "\n";

                        }
                        if (tasksForProject !== "") {
                            arrayAttachment.push({

                                "text": tasksForProject,
                                "fallback": "Project: " + sheetInfo.name,
                                "color": "#3AA3E3",
                                "attachment_type": "default",
                                "title": "Project: " + sheetInfo.name,
                                //"fields": fieldsArray,
                                "actions": [{

                                    "text": "View Project",
                                    "type": "button",
                                    "url": sheetInfo.permalink,
                                    "style": "primary"
                                }]
                            });
                        }
                    }
                    if (totalProjects === currProjectsFetched) {
                        searchCompleted = true;
                        if (itemsFound && arrayAttachment.length > 0) {
                            res.send({
                                "data": arrayAttachment
                            });
                        } else {
                            res.send("Nothing found.");
                        }
                    }
                }
            }
        })
        .catch(function (error) {
            console.log(error);

        });
}

async function asyncsmartSheetsHandler(req, res, next) {
    var itemsFound = false;
    var passedDatecheck = false;
    var usePercentageInstead = false;
    var totalMatches = 0;
    var arrayAttachment = [];
    var tasksForProjectArray = [];
    var blocks = [];
    var searchCompleted = false;
    var totalProjects = 0;
    var currProjectsFetched = 0;
    var matchAssignee = false;
    var tryUserName = '';
    var lastName = '';
    var utc = new Date().toJSON().slice(0, 10);

    var slackUserId = req.body.originalDetectIntentRequest.payload.data.event.user;

    var options = {
        method: 'GET',
        url: 'https://ffn-chatbot-weather-dev.appspot.com/ideas/getSlackUserInfo',
        qs: {
            userid: slackUserId
        },
        headers: {
            Host: 'ffn-chatbot-weather-dev.appspot.com',
            Accept: 'applicaiton/json'
        }
    };

    return rp(options)
        .then(body => {
            var slackUserData = JSON.parse(body);

            if (slackUserData.data.email !== undefined) {
                var splitName = slackUserData.data.email.split("@");
                //var indexOfAtSign = slackUserData.data.email.toString().indexOf("@");
                tryUserName = splitName[0];
                lastName = splitName[0].substr(1);
            } else {
                tryUserName = '';
                lastName = '';
            }

            //console.log("UserId Slack: " + tryUserName + " user: " + slackUserId + " last name" + lastName);

            var smartsheet = client.createClient({
                accessToken: 'mcb931esji6tlnxteyk2016ndh',
                logLevel: 'error'
            });
            // task name, status and end date.

            // The `smartsheet` variable now contains access to all of the APIs

            // Set queryParameters for `include` and pagination
            var options = {
                queryParameters: {
                    include: "attachments",
                    includeAll: true
                }
            };

            // List all sheets
            smartsheet.sheets.listSheets(options)
                .then(function (result) {
                    totalProjects = result.data.length;
                    for (var i = 0; i < result.data.length; i++) {

                        var sheetId = result.data[i].id; // Choose the first sheet
                        var taskRow = '';
                        // Load one sheet
                        smartsheet.sheets.getSheet({
                                id: sheetId
                            })
                            .then(function (sheetInfo) {
                                totalMatches = 0;
                                var fieldsArray = [];
                                var taskNameId = 0;
                                var statusId = 0;
                                var startId = 0;
                                var finishId = 0;
                                var assignedId = 0;
                                var percentCompletedId = 0;
                                var totalPopulationId = 0;
                                var commentsId = 0;
                                var completionId = 0;
                                var migratedId = 0;
                                var percentMigratedId = 0;
                                var okToAdd = false;
                                var adjFinishId = 0;
                                var concernsId = 0;
                                var workID = 0;
                                var pcomplete = 0;

                                currProjectsFetched++;
                                var tasksForProject = "";

                                for (var n = 0; n < sheetInfo.columns.length; n++) {
                                    var columnData = sheetInfo.columns[n];

                                    switch (columnData.title.toLowerCase()) {
                                        case "task name":
                                        case "deliverable":
                                        case "feature/epic":
                                        case "key deliverables":
                                            taskNameId = columnData.id;
                                            break;
                                        case "start":
                                        case "start date":
                                            startId = columnData.id;
                                            break;
                                        case "finish":
                                        case "end date":
                                            finishId = columnData.id;
                                            break;
                                        case "assigned to":
                                            assignedId = columnData.id;
                                            break;
                                        case "status":
                                            statusId = columnData.id;
                                            break;
                                        case "comments":
                                            commentsId = columnData.id;
                                            break;
                                            // case "completion":
                                            //     completionId = columnData.id;
                                            //     break;
                                        case "total population":
                                            totalPopulationId = columnData.id;
                                            break;
                                        case "migrated":
                                            migratedId = columnData.id;
                                            break;
                                        case "percent migrated":
                                            percentMigratedId = columnData.id;
                                            break;
                                        case "adjusted finish":
                                            adjFinishId = columnData.id;
                                            break;
                                        case "concerns":
                                            concernsId = columnData.id;
                                            break;
                                        case "work":
                                            workID = columnData.id;
                                            break;
                                        case "% complete":
                                            percentCompletedId = columnData.id;
                                            break;
                                        case "duration":
                                        case "predecessors":
                                            break;
                                        case 'completion':
                                        case "status %":
                                            pcomplete = columnData.id;
                                            break;
                                        case "column14":
                                        case "pred.":
                                        case "monitor":
                                            break;
                                        default:
                                            console.log("Error should not be able to find a column id. Check the names for sheet id: " + sheetInfo.id + " Title: " + columnData.title);
                                            break;
                                    }
                                }

                                //console.log("assigneeColumnId: " + assignedId + " projId: " + sheetInfo.id);
                                //console.log("\n\n--------------------------------------------------\nProject: " + sheetInfo.name + "\n--------------------------------------------------");
                                okToAdd = false;
                                passedDatecheck = false;
                                if (assignedId !== 0) {
                                    tasksForProjectArray = [];
                                    for (var j = 0; j < sheetInfo.rows.length; j++) {
                                        usePercentageInstead = false;
                                        var taskName = "";
                                        var finishDate = "";
                                        var percentCompleted = "";
                                        var taskStatus = "";
                                        var startDate = "";
                                        var completion = "";
                                        var percentCompleted2 = "";
                                        matchAssignee = false;
                                        for (var k = 0; k < sheetInfo.rows[j].cells.length; k++) {
                                            var rowObj = sheetInfo.rows[j];
                                            var cellObj = rowObj.cells[k];

                                            try {
                                                if (taskNameId !== 0 && cellObj.columnId === taskNameId && cellObj.value !== null && cellObj.value !== undefined) {
                                                    okToAdd = true;
                                                    taskName = cellObj.value;
                                                    //taskRow = taskRow + "\n\n• " + cellObj.value;
                                                    //console.log("\n√ " + cellObj.value);
                                                    // fieldsArray.push({
                                                    //     "title": "Task",
                                                    //     "value": cellObj.value,
                                                    //     "short": false
                                                    // });
                                                }
                                                //Status id 8321226008487812
                                                else if (statusId !== 0 && cellObj.columnId === statusId && cellObj.value !== null && cellObj.value !== undefined) {
                                                    taskStatus = " - " + cellObj.value;
                                                    //taskRow = taskRow + "\n  Status: " + cellObj.value;
                                                    // fieldsArray.push({
                                                    //     "title": "Status",
                                                    //     "value": cellObj.value,
                                                    //     "short": true
                                                    // });
                                                }
                                                // Completion 
                                                else if (pcomplete !== 0 && cellObj.columnId === pcomplete && cellObj.displayValue !== null && cellObj.displayValue !== undefined) {
                                                    completion = cellObj.value;

                                                    switch (completion) {
                                                        case "Empty":
                                                            percentCompleted = " - 0%";
                                                            break;
                                                        case "Quarter":
                                                            percentCompleted = " - 25%";
                                                            break;
                                                        case "Half":
                                                            percentCompleted = " - 50%";
                                                            break;
                                                        case "Three Quarter":
                                                            percentCompleted = " - 75%";
                                                            break;
                                                        default:
                                                            usePercentageInstead = true;
                                                            break;
                                                    }
                                                }
                                                // Start
                                                else if (cellObj.columnId === startId && cellObj.value !== null && cellObj.value !== undefined) {
                                                    //taskRow = taskRow + "\n  Start: " + cellObj.value;

                                                    startDate = cellObj.value;

                                                    // fieldsArray.push({
                                                    //     "title": "Start",
                                                    //     "value": cellObj.value,
                                                    //     "short": true
                                                    // });
                                                }
                                                // Finish id 7195326101645188
                                                else if (finishId !== 0 && cellObj.columnId === finishId && cellObj.value !== null && cellObj.value !== undefined) {
                                                    //taskRow = taskRow + "\n  Finish: " + cellObj.value;
                                                    finishDate = " - " + cellObj.value.substr(0, 10);


                                                    // fieldsArray.push({
                                                    //     "title": "Finish",
                                                    //     "value": cellObj.value,
                                                    //     "short": true
                                                    // });
                                                }
                                                // else if (percentCompletedId !== 0 && cellObj.columnId === percentCompletedId && cellObj.value !== null && cellObj.value !== undefined) {
                                                //     //taskRow = taskRow + "\n  Finish: " + cellObj.value;
                                                //     percentCompleted = cellObj.value;
                                                //     // fieldsArray.push({
                                                //     //     "title": "% Completed",
                                                //     //     "value": cellObj.value,
                                                //     //     "short": true
                                                //     // });
                                                // }
                                                //Assigned To 
                                                else if (assignedId !== 0 && cellObj.columnId === assignedId && cellObj.value !== null && cellObj.value !== undefined) {
                                                    //taskRow = taskRow + "\n  Assignee: " + cellObj.value;
                                                    //console.log(" Assignee: " + cellObj.value);
                                                    if (cellObj.value.toLowerCase().includes(tryUserName) || cellObj.value.toLowerCase().includes(lastName)) {
                                                        matchAssignee = true;
                                                        itemsFound = true;
                                                        totalMatches++;
                                                    }
                                                    // fieldsArray.push({
                                                    //     "title": "Assigned To",
                                                    //     "value": cellObj.value,
                                                    //     "short": true
                                                    // });
                                                }
                                                //else if (cellObj.columnId === totalPopulationId && cellObj.value !== null && cellObj.value !== undefined) {
                                                //     //taskRow = taskRow + "\n  Total Population: " + cellObj.value;
                                                //     //console.log(" Assignee: " + cellObj.value);
                                                //     fieldsArray.push({
                                                //         "title": "Total Population",
                                                //         "value": cellObj.value,
                                                //         "short": true
                                                //     });
                                                // } else if (cellObj.columnId === migratedId && cellObj.value !== null && cellObj.value !== undefined) {
                                                //     //taskRow = taskRow + "\n  Migrated: " + cellObj.value;
                                                //     //console.log(" Assignee: " + cellObj.value);
                                                //     fieldsArray.push({
                                                //         "title": "Migrated",
                                                //         "value": cellObj.value,
                                                //         "short": true
                                                //     });
                                                // } else if (cellObj.columnId === percentMigratedId && cellObj.value !== null && cellObj.value !== undefined) {
                                                //     //taskRow = taskRow + "\n  % Migrated: " + cellObj.value;
                                                //     //console.log(" Assignee: " + cellObj.value);
                                                //     fieldsArray.push({
                                                //         "title": "% Migrated",
                                                //         "value": cellObj.value,
                                                //         "short": true
                                                //     });
                                                // } else if (cellObj.columnId === adjFinishId && cellObj.value !== null && cellObj.value !== undefined) {
                                                //     //taskRow = taskRow + "\n  Adjusted Finish: " + cellObj.value;
                                                //     //console.log(" Assignee: " + cellObj.value);
                                                //     const newLocal = fieldsArray.push({
                                                //         "title": "Adjusted Finish",
                                                //         "value": cellObj.value,
                                                //         "short": true
                                                //     });
                                                // } else if (cellObj.columnId === concernsId && cellObj.value !== null && cellObj.value !== undefined) {
                                                //     //taskRow = taskRow + "\n  Concerns: " + cellObj.value;
                                                //     //console.log(" Assignee: " + cellObj.value);
                                                //     fieldsArray.push({
                                                //         "title": "Concerns",
                                                //         "value": cellObj.value,
                                                //         "short": true
                                                //     });
                                                // } else if (cellObj.columnId === workID && cellObj.value !== null && cellObj.value !== undefined) {
                                                //     //taskRow = taskRow + "\n  Work: " + cellObj.value;
                                                //     //console.log(" Assignee: " + cellObj.value);
                                                //     fieldsArray.push({
                                                //         "title": "Work",
                                                //         "value": cellObj.value,
                                                //         "short": true
                                                //     });
                                                // }
                                                // commented out 6/10/19
                                                else if (percentCompletedId !== 0 && cellObj.columnId === percentCompletedId && cellObj.value !== null && cellObj.value !== undefined) {
                                                    //taskRow = taskRow + "\n  Finish: " + cellObj.value;
                                                    percentCompleted2 = " - " + cellObj.value * 100 + "%";


                                                    //console.log("% completed: " + percentCompleted);
                                                    // fieldsArray.push({
                                                    //     "title": "% Completed",
                                                    //     "value": cellObj.value,
                                                    //     "short": true
                                                    // });
                                                }


                                            } catch (err) {
                                                console.log(cellObj);
                                            }

                                            // if (matchAssignee && i === result.data.length) {
                                            //     arrayAttachment.push({

                                            //         "text": "",
                                            //         "fallback": "*Project: " + sheetInfo.name + "*",
                                            //         "color": "#3AA3E3",
                                            //         "attachment_type": "default",
                                            //         "title": "",
                                            //         "fields": fieldsArray,
                                            //         "actions": [{

                                            //             "text": "View Project",
                                            //             "type": "button",
                                            //             "url": sheetInfo.permalink,
                                            //             "style": "primary"
                                            //         }]
                                            //     });
                                            // }


                                        }

                                        if (startDate <= utc && percentCompleted !== 1 && taskStatus !== " - Completed" && completion.toLocaleLowerCase() !== "full" && matchAssignee) {
                                            tasksForProjectArray.push({
                                                "taskName": taskName.substr(0, 20),
                                                "finishDate": finishDate,
                                                "percentCompleted": percentCompleted,
                                                "taskStatus": taskStatus
                                            });
                                        }
                                    }
                                } // if no assignee don't do any adding of the user information. 


                                // if (matchAssignee) {
                                //     var payloadSlack = {
                                //         "payload": {
                                //             "slack": {
                                //                 "text": "*Project: " + sheetInfo.name + "*",
                                //                 "attachments": arrayAttachment
                                //             },
                                //             "outputContexts": [{
                                //                 "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/smartSheets"
                                //             }]
                                //         }
                                //     };
                                //     console.log(payloadSlack);
                                //     res.send(payloadSlack);
                                // }




                                if (totalMatches > 0) {

                                    //tasksForProjectArray = tasksForProjectArray.sort(sortUtil.sortByDate);



                                    blocks.push(addSlackSection(sheetInfo.name));

                                    for (var m = 0; m < tasksForProjectArray.length; m++) {
                                        tasksForProject = " *" + tasksForProjectArray[m].taskName + "*" + tasksForProjectArray[m].finishDate + tasksForProjectArray[m].percentCompleted;

                                        blocks.push(addSlackContext(tasksForProject));

                                    }


                                    blocks.push({
                                        "type": "actions",
                                        "elements": [{
                                            "type": "button",
                                            "url": sheetInfo.permalink,
                                            "text": {
                                                "type": "plain_text",
                                                "text": "View Project",

                                                "emoji": true
                                            },
                                            "value": "View Project"
                                        }]
                                    });
                                    blocks.push(addSlackDivider());

                                    // if (tasksForProject !== "") {
                                    //     arrayAttachment.push({

                                    //         "text": tasksForProject,
                                    //         "fallback": "Project: " + sheetInfo.name,
                                    //         "color": "#3AA3E3",
                                    //         "attachment_type": "default",
                                    //         "title": "Project: " + sheetInfo.name,
                                    //         //"fields": fieldsArray,
                                    //         "actions": [{

                                    //             "text": "View Project",
                                    //             "type": "button",
                                    //             "url": sheetInfo.permalink,
                                    //             "style": "primary"
                                    //         }]
                                    //     });
                                    // }
                                }
                                if (totalProjects === currProjectsFetched) {
                                    searchCompleted = true;
                                    if (itemsFound && blocks.length > 0) {
                                        return blocks;

                                        // var payloadSlack = {
                                        //     "payload": {
                                        //         "slack": {
                                        //             "attachments": [{
                                        //                 "blocks": blocks
                                        //             }]
                                        //         },
                                        //         "outputContexts": [{
                                        //             "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/smartSheets"
                                        //         }]
                                        //     }
                                        // };
                                        // //console.log(payloadSlack);
                                        // res.send(payloadSlack);
                                    } else {
                                        // var payloadSlack = {
                                        //     "payload": {
                                        //         "slack": {
                                        //             "text": "*SmartSheet Projects My Tasks*",
                                        //             "attachments": [{

                                        //                 "text": "Nothing is currently assigned to you with a start date less than today's date (" + utc + ") in smartsheets.",
                                        //                 "fallback": "",
                                        //                 "color": "#3AA3E3",
                                        //                 "attachment_type": "default",
                                        //                 "title": "Nothing found!"
                                        //             }]
                                        //         },
                                        //         "outputContexts": [{
                                        //             "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/smartSheets"
                                        //         }]
                                        //     }
                                        // };
                                        //console.log(payloadSlack);
                                        return [];
                                        //res.send(payloadSlack);
                                    }
                                }

                            })
                            .catch(function (error) {
                                console.log(error);
                                // var payloadSlack = {
                                //     "payload": {
                                //         "slack": {
                                //             "text": "*SmartSheet Projects My Tasks*",
                                //             "attachments": [{

                                //                 "text": "Nothing was found assigned to you in smartsheets.",
                                //                 "fallback": "",
                                //                 "color": "#3AA3E3",
                                //                 "attachment_type": "default",
                                //                 "title": "Nothing found!"
                                //             }]
                                //         },
                                //         "outputContexts": [{
                                //             "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/smartSheets"
                                //         }]
                                //     }
                                // };
                                // //console.log(payloadSlack);
                                // res.send(payloadSlack);
                                return [];

                            });


                    }
                    // if (searchCompleted) {
                    //     if (itemsFound) {
                    //         var payloadSlack = {
                    //             "payload": {
                    //                 "slack": {
                    //                     "text": "*SmartSheet Projects*",
                    //                     "attachments": arrayAttachment
                    //                 },
                    //                 "outputContexts": [{
                    //                     "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/smartSheets"
                    //                 }]
                    //             }
                    //         };
                    //         console.log(payloadSlack);
                    //         res.send(payloadSlack);
                    //     } else {
                    //         var payloadSlack = {
                    //             "payload": {
                    //                 "slack": {
                    //                     "text": "*SmartSheet Projects My Tasks*",
                    //                     "attachments": [{

                    //                         "text": "Nothing was found assigned to you in smartsheets.",
                    //                         "fallback": "",
                    //                         "color": "#3AA3E3",
                    //                         "attachment_type": "default",
                    //                         "title": "Nothing found!"
                    //                     }]
                    //                 },
                    //                 "outputContexts": [{
                    //                     "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/smartSheets"
                    //                 }]
                    //             }
                    //         };
                    //         console.log(payloadSlack);
                    //         res.send(payloadSlack);
                    //     }
                    // }

                })
                .catch(function (error) {
                    console.log(error);
                    // var payloadSlack = {
                    //     "payload": {
                    //         "slack": {
                    //             "text": "*SmartSheet Projects My Tasks*",
                    //             "attachments": [{

                    //                 "text": "Nothing was found assigned to you in smartsheets.",
                    //                 "fallback": "",
                    //                 "color": "#3AA3E3",
                    //                 "attachment_type": "default",
                    //                 "title": "Nothing found!"
                    //             }]
                    //         },
                    //         "outputContexts": [{
                    //             "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/smartSheets"
                    //         }]
                    //     }
                    // };
                    // //console.log(payloadSlack);
                    // res.send(payloadSlack);
                    return [];
                });
            if (searchCompleted && totalMatches === 0) {
                // var payloadSlack = {
                //     "payload": {
                //         "slack": {
                //             "text": "*SmartSheet Projects My Tasks*",
                //             "attachments": [{

                //                 "text": "Nothing was found assigned to you in smartsheets.",
                //                 "fallback": "",
                //                 "color": "#3AA3E3",
                //                 "attachment_type": "default",
                //                 "title": "Nothing found!"
                //             }]
                //         },
                //         "outputContexts": [{
                //             "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/smartSheets"
                //         }]
                //     }
                // };
                // //console.log(payloadSlack);
                // res.send(payloadSlack);
                return [];
            }


        });

}

function smartSheetsHandler(req, res, next) {
    var itemsFound = false;
    var passedDatecheck = false;
    var usePercentageInstead = false;
    var totalMatches = 0;
    var arrayAttachment = [];
    var tasksForProjectArray = [];
    var blocks = [];
    var searchCompleted = false;
    var totalProjects = 0;
    var currProjectsFetched = 0;
    var matchAssignee = false;
    var tryUserName = '';
    var lastName = '';
    var utc = new Date().toJSON().slice(0, 10);

    var slackUserId = req.body.originalDetectIntentRequest.payload.data.event.user;

    var options = {
        method: 'GET',
        url: 'https://ffn-chatbot-weather-dev.appspot.com/ideas/getSlackUserInfo',
        qs: {
            userid: slackUserId
        },
        headers: {
            Host: 'ffn-chatbot-weather-dev.appspot.com',
            Accept: 'applicaiton/json'
        }
    };

    return rp(options)
        .then(body => {
            var slackUserData = JSON.parse(body);

            if (slackUserData.data.email !== undefined) {
                var splitName = slackUserData.data.email.split("@");
                //var indexOfAtSign = slackUserData.data.email.toString().indexOf("@");
                tryUserName = splitName[0];
                lastName = splitName[0].substr(1);
            } else {
                tryUserName = '';
                lastName = '';
            }

            //console.log("UserId Slack: " + tryUserName + " user: " + slackUserId + " last name" + lastName);

            var smartsheet = client.createClient({
                accessToken: 'mcb931esji6tlnxteyk2016ndh',
                logLevel: 'error'
            });
            // task name, status and end date.

            // The `smartsheet` variable now contains access to all of the APIs

            // Set queryParameters for `include` and pagination
            var options = {
                queryParameters: {
                    include: "attachments",
                    includeAll: true
                }
            };

            // List all sheets
            smartsheet.sheets.listSheets(options)
                .then(function (result) {
                    totalProjects = result.data.length;
                    for (var i = 0; i < result.data.length; i++) {

                        var sheetId = result.data[i].id; // Choose the first sheet
                        var taskRow = '';
                        // Load one sheet
                        smartsheet.sheets.getSheet({
                                id: sheetId
                            })
                            .then(function (sheetInfo) {
                                totalMatches = 0;
                                var fieldsArray = [];
                                var taskNameId = 0;
                                var statusId = 0;
                                var startId = 0;
                                var finishId = 0;
                                var assignedId = 0;
                                var percentCompletedId = 0;
                                var totalPopulationId = 0;
                                var commentsId = 0;
                                var completionId = 0;
                                var migratedId = 0;
                                var percentMigratedId = 0;
                                var okToAdd = false;
                                var adjFinishId = 0;
                                var concernsId = 0;
                                var workID = 0;
                                var pcomplete = 0;

                                currProjectsFetched++;
                                var tasksForProject = "";

                                for (var n = 0; n < sheetInfo.columns.length; n++) {
                                    var columnData = sheetInfo.columns[n];

                                    switch (columnData.title.toLowerCase()) {
                                        case "task name":
                                        case "deliverable":
                                        case "feature/epic":
                                        case "key deliverables":
                                            taskNameId = columnData.id;
                                            break;
                                        case "start":
                                        case "start date":
                                            startId = columnData.id;
                                            break;
                                        case "finish":
                                        case "end date":
                                            finishId = columnData.id;
                                            break;
                                        case "assigned to":
                                            assignedId = columnData.id;
                                            break;
                                        case "status":
                                            statusId = columnData.id;
                                            break;
                                        case "comments":
                                            commentsId = columnData.id;
                                            break;
                                            // case "completion":
                                            //     completionId = columnData.id;
                                            //     break;
                                        case "total population":
                                            totalPopulationId = columnData.id;
                                            break;
                                        case "migrated":
                                            migratedId = columnData.id;
                                            break;
                                        case "percent migrated":
                                            percentMigratedId = columnData.id;
                                            break;
                                        case "adjusted finish":
                                            adjFinishId = columnData.id;
                                            break;
                                        case "concerns":
                                            concernsId = columnData.id;
                                            break;
                                        case "work":
                                            workID = columnData.id;
                                            break;
                                        case "% complete":
                                            percentCompletedId = columnData.id;
                                            break;
                                        case "duration":
                                        case "predecessors":
                                            break;
                                        case 'completion':
                                        case "status %":
                                            pcomplete = columnData.id;
                                            break;
                                        case "column14":
                                        case "pred.":
                                        case "monitor":
                                            break;
                                        default:
                                            console.log("Error should not be able to find a column id. Check the names for sheet id: " + sheetInfo.id + " Title: " + columnData.title);
                                            break;
                                    }
                                }

                                //console.log("assigneeColumnId: " + assignedId + " projId: " + sheetInfo.id);
                                //console.log("\n\n--------------------------------------------------\nProject: " + sheetInfo.name + "\n--------------------------------------------------");
                                okToAdd = false;
                                passedDatecheck = false;
                                if (assignedId !== 0) {
                                    tasksForProjectArray = [];
                                    for (var j = 0; j < sheetInfo.rows.length; j++) {
                                        usePercentageInstead = false;
                                        var taskName = "";
                                        var finishDate = "";
                                        var percentCompleted = "";
                                        var taskStatus = "";
                                        var startDate = "";
                                        var completion = "";
                                        var percentCompleted2 = "";
                                        matchAssignee = false;
                                        for (var k = 0; k < sheetInfo.rows[j].cells.length; k++) {
                                            var rowObj = sheetInfo.rows[j];
                                            var cellObj = rowObj.cells[k];

                                            try {
                                                if (taskNameId !== 0 && cellObj.columnId === taskNameId && cellObj.value !== null && cellObj.value !== undefined) {
                                                    okToAdd = true;
                                                    taskName = cellObj.value;
                                                    //taskRow = taskRow + "\n\n• " + cellObj.value;
                                                    //console.log("\n√ " + cellObj.value);
                                                    // fieldsArray.push({
                                                    //     "title": "Task",
                                                    //     "value": cellObj.value,
                                                    //     "short": false
                                                    // });
                                                }
                                                //Status id 8321226008487812
                                                else if (statusId !== 0 && cellObj.columnId === statusId && cellObj.value !== null && cellObj.value !== undefined) {
                                                    taskStatus = " - " + cellObj.value;
                                                    //taskRow = taskRow + "\n  Status: " + cellObj.value;
                                                    // fieldsArray.push({
                                                    //     "title": "Status",
                                                    //     "value": cellObj.value,
                                                    //     "short": true
                                                    // });
                                                }
                                                // Completion 
                                                else if (pcomplete !== 0 && cellObj.columnId === pcomplete && cellObj.displayValue !== null && cellObj.displayValue !== undefined) {
                                                    completion = cellObj.value;

                                                    switch (completion) {
                                                        case "Empty":
                                                            percentCompleted = " - 0%";
                                                            break;
                                                        case "Quarter":
                                                            percentCompleted = " - 25%";
                                                            break;
                                                        case "Half":
                                                            percentCompleted = " - 50%";
                                                            break;
                                                        case "Three Quarter":
                                                            percentCompleted = " - 75%";
                                                            break;
                                                        default:
                                                            usePercentageInstead = true;
                                                            break;
                                                    }
                                                }
                                                // Start
                                                else if (cellObj.columnId === startId && cellObj.value !== null && cellObj.value !== undefined) {
                                                    //taskRow = taskRow + "\n  Start: " + cellObj.value;

                                                    startDate = cellObj.value;

                                                    // fieldsArray.push({
                                                    //     "title": "Start",
                                                    //     "value": cellObj.value,
                                                    //     "short": true
                                                    // });
                                                }
                                                // Finish id 7195326101645188
                                                else if (finishId !== 0 && cellObj.columnId === finishId && cellObj.value !== null && cellObj.value !== undefined) {
                                                    //taskRow = taskRow + "\n  Finish: " + cellObj.value;
                                                    finishDate = " - " + cellObj.value.substr(0, 10);


                                                    // fieldsArray.push({
                                                    //     "title": "Finish",
                                                    //     "value": cellObj.value,
                                                    //     "short": true
                                                    // });
                                                }
                                                // else if (percentCompletedId !== 0 && cellObj.columnId === percentCompletedId && cellObj.value !== null && cellObj.value !== undefined) {
                                                //     //taskRow = taskRow + "\n  Finish: " + cellObj.value;
                                                //     percentCompleted = cellObj.value;
                                                //     // fieldsArray.push({
                                                //     //     "title": "% Completed",
                                                //     //     "value": cellObj.value,
                                                //     //     "short": true
                                                //     // });
                                                // }
                                                //Assigned To 
                                                else if (assignedId !== 0 && cellObj.columnId === assignedId && cellObj.value !== null && cellObj.value !== undefined) {
                                                    //taskRow = taskRow + "\n  Assignee: " + cellObj.value;
                                                    //console.log(" Assignee: " + cellObj.value);
                                                    if (cellObj.value.toLowerCase().includes(tryUserName) || cellObj.value.toLowerCase().includes(lastName)) {
                                                        matchAssignee = true;
                                                        itemsFound = true;
                                                        totalMatches++;
                                                    }
                                                    // fieldsArray.push({
                                                    //     "title": "Assigned To",
                                                    //     "value": cellObj.value,
                                                    //     "short": true
                                                    // });
                                                }
                                                //else if (cellObj.columnId === totalPopulationId && cellObj.value !== null && cellObj.value !== undefined) {
                                                //     //taskRow = taskRow + "\n  Total Population: " + cellObj.value;
                                                //     //console.log(" Assignee: " + cellObj.value);
                                                //     fieldsArray.push({
                                                //         "title": "Total Population",
                                                //         "value": cellObj.value,
                                                //         "short": true
                                                //     });
                                                // } else if (cellObj.columnId === migratedId && cellObj.value !== null && cellObj.value !== undefined) {
                                                //     //taskRow = taskRow + "\n  Migrated: " + cellObj.value;
                                                //     //console.log(" Assignee: " + cellObj.value);
                                                //     fieldsArray.push({
                                                //         "title": "Migrated",
                                                //         "value": cellObj.value,
                                                //         "short": true
                                                //     });
                                                // } else if (cellObj.columnId === percentMigratedId && cellObj.value !== null && cellObj.value !== undefined) {
                                                //     //taskRow = taskRow + "\n  % Migrated: " + cellObj.value;
                                                //     //console.log(" Assignee: " + cellObj.value);
                                                //     fieldsArray.push({
                                                //         "title": "% Migrated",
                                                //         "value": cellObj.value,
                                                //         "short": true
                                                //     });
                                                // } else if (cellObj.columnId === adjFinishId && cellObj.value !== null && cellObj.value !== undefined) {
                                                //     //taskRow = taskRow + "\n  Adjusted Finish: " + cellObj.value;
                                                //     //console.log(" Assignee: " + cellObj.value);
                                                //     const newLocal = fieldsArray.push({
                                                //         "title": "Adjusted Finish",
                                                //         "value": cellObj.value,
                                                //         "short": true
                                                //     });
                                                // } else if (cellObj.columnId === concernsId && cellObj.value !== null && cellObj.value !== undefined) {
                                                //     //taskRow = taskRow + "\n  Concerns: " + cellObj.value;
                                                //     //console.log(" Assignee: " + cellObj.value);
                                                //     fieldsArray.push({
                                                //         "title": "Concerns",
                                                //         "value": cellObj.value,
                                                //         "short": true
                                                //     });
                                                // } else if (cellObj.columnId === workID && cellObj.value !== null && cellObj.value !== undefined) {
                                                //     //taskRow = taskRow + "\n  Work: " + cellObj.value;
                                                //     //console.log(" Assignee: " + cellObj.value);
                                                //     fieldsArray.push({
                                                //         "title": "Work",
                                                //         "value": cellObj.value,
                                                //         "short": true
                                                //     });
                                                // }
                                                // commented out 6/10/19
                                                else if (percentCompletedId !== 0 && cellObj.columnId === percentCompletedId && cellObj.value !== null && cellObj.value !== undefined) {
                                                    //taskRow = taskRow + "\n  Finish: " + cellObj.value;
                                                    percentCompleted2 = " - " + cellObj.value * 100 + "%";


                                                    //console.log("% completed: " + percentCompleted);
                                                    // fieldsArray.push({
                                                    //     "title": "% Completed",
                                                    //     "value": cellObj.value,
                                                    //     "short": true
                                                    // });
                                                }


                                            } catch (err) {
                                                console.log(cellObj);
                                            }

                                            // if (matchAssignee && i === result.data.length) {
                                            //     arrayAttachment.push({

                                            //         "text": "",
                                            //         "fallback": "*Project: " + sheetInfo.name + "*",
                                            //         "color": "#3AA3E3",
                                            //         "attachment_type": "default",
                                            //         "title": "",
                                            //         "fields": fieldsArray,
                                            //         "actions": [{

                                            //             "text": "View Project",
                                            //             "type": "button",
                                            //             "url": sheetInfo.permalink,
                                            //             "style": "primary"
                                            //         }]
                                            //     });
                                            // }


                                        }

                                        if (startDate <= utc && percentCompleted !== 1 && taskStatus !== " - Completed" && completion.toLocaleLowerCase() !== "full" && matchAssignee) {
                                            tasksForProjectArray.push({
                                                "taskName": taskName.substr(0, 20),
                                                "finishDate": finishDate,
                                                "percentCompleted": percentCompleted,
                                                "taskStatus": taskStatus
                                            });
                                        }
                                    }
                                } // if no assignee don't do any adding of the user information. 


                                // if (matchAssignee) {
                                //     var payloadSlack = {
                                //         "payload": {
                                //             "slack": {
                                //                 "text": "*Project: " + sheetInfo.name + "*",
                                //                 "attachments": arrayAttachment
                                //             },
                                //             "outputContexts": [{
                                //                 "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/smartSheets"
                                //             }]
                                //         }
                                //     };
                                //     console.log(payloadSlack);
                                //     res.send(payloadSlack);
                                // }




                                if (totalMatches > 0) {

                                    //tasksForProjectArray = tasksForProjectArray.sort(sortUtil.sortByDate);



                                    blocks.push(addSlackSection(sheetInfo.name));

                                    for (var m = 0; m < tasksForProjectArray.length; m++) {
                                        tasksForProject = " *" + tasksForProjectArray[m].taskName + "*" + tasksForProjectArray[m].finishDate + tasksForProjectArray[m].percentCompleted;

                                        blocks.push(addSlackContext(tasksForProject));

                                    }


                                    blocks.push({
                                        "type": "actions",
                                        "elements": [{
                                            "type": "button",
                                            "url": sheetInfo.permalink,
                                            "text": {
                                                "type": "plain_text",
                                                "text": "View Project",

                                                "emoji": true
                                            },
                                            "value": "View Project"
                                        }]
                                    });
                                    blocks.push(addSlackDivider());

                                    // if (tasksForProject !== "") {
                                    //     arrayAttachment.push({

                                    //         "text": tasksForProject,
                                    //         "fallback": "Project: " + sheetInfo.name,
                                    //         "color": "#3AA3E3",
                                    //         "attachment_type": "default",
                                    //         "title": "Project: " + sheetInfo.name,
                                    //         //"fields": fieldsArray,
                                    //         "actions": [{

                                    //             "text": "View Project",
                                    //             "type": "button",
                                    //             "url": sheetInfo.permalink,
                                    //             "style": "primary"
                                    //         }]
                                    //     });
                                    // }
                                }
                                if (totalProjects === currProjectsFetched) {
                                    searchCompleted = true;
                                    if (itemsFound && blocks.length > 0) {
                                        var payloadSlack = {
                                            "payload": {
                                                "slack": {
                                                    "attachments": [{
                                                        "blocks": blocks
                                                    }]
                                                },
                                                "outputContexts": [{
                                                    "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/smartSheets"
                                                }]
                                            }
                                        };
                                        //console.log(payloadSlack);
                                        res.send(payloadSlack);
                                    } else {
                                        var payloadSlack = {
                                            "payload": {
                                                "slack": {
                                                    "text": "*SmartSheet Projects My Tasks*",
                                                    "attachments": [{

                                                        "text": "Nothing is currently assigned to you with a start date less than today's date (" + utc + ") in smartsheets.",
                                                        "fallback": "",
                                                        "color": "#3AA3E3",
                                                        "attachment_type": "default",
                                                        "title": "Nothing found!"
                                                    }]
                                                },
                                                "outputContexts": [{
                                                    "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/smartSheets"
                                                }]
                                            }
                                        };
                                        //console.log(payloadSlack);
                                        res.send(payloadSlack);
                                    }
                                }

                            })
                            .catch(function (error) {
                                console.log(error);
                                var payloadSlack = {
                                    "payload": {
                                        "slack": {
                                            "text": "*SmartSheet Projects My Tasks*",
                                            "attachments": [{

                                                "text": "Nothing was found assigned to you in smartsheets.",
                                                "fallback": "",
                                                "color": "#3AA3E3",
                                                "attachment_type": "default",
                                                "title": "Nothing found!"
                                            }]
                                        },
                                        "outputContexts": [{
                                            "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/smartSheets"
                                        }]
                                    }
                                };
                                //console.log(payloadSlack);
                                res.send(payloadSlack);
                            });


                    }
                    // if (searchCompleted) {
                    //     if (itemsFound) {
                    //         var payloadSlack = {
                    //             "payload": {
                    //                 "slack": {
                    //                     "text": "*SmartSheet Projects*",
                    //                     "attachments": arrayAttachment
                    //                 },
                    //                 "outputContexts": [{
                    //                     "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/smartSheets"
                    //                 }]
                    //             }
                    //         };
                    //         console.log(payloadSlack);
                    //         res.send(payloadSlack);
                    //     } else {
                    //         var payloadSlack = {
                    //             "payload": {
                    //                 "slack": {
                    //                     "text": "*SmartSheet Projects My Tasks*",
                    //                     "attachments": [{

                    //                         "text": "Nothing was found assigned to you in smartsheets.",
                    //                         "fallback": "",
                    //                         "color": "#3AA3E3",
                    //                         "attachment_type": "default",
                    //                         "title": "Nothing found!"
                    //                     }]
                    //                 },
                    //                 "outputContexts": [{
                    //                     "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/smartSheets"
                    //                 }]
                    //             }
                    //         };
                    //         console.log(payloadSlack);
                    //         res.send(payloadSlack);
                    //     }
                    // }

                })
                .catch(function (error) {
                    console.log(error);
                    var payloadSlack = {
                        "payload": {
                            "slack": {
                                "text": "*SmartSheet Projects My Tasks*",
                                "attachments": [{

                                    "text": "Nothing was found assigned to you in smartsheets.",
                                    "fallback": "",
                                    "color": "#3AA3E3",
                                    "attachment_type": "default",
                                    "title": "Nothing found!"
                                }]
                            },
                            "outputContexts": [{
                                "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/smartSheets"
                            }]
                        }
                    };
                    //console.log(payloadSlack);
                    res.send(payloadSlack);
                });
            if (searchCompleted && totalMatches === 0) {
                var payloadSlack = {
                    "payload": {
                        "slack": {
                            "text": "*SmartSheet Projects My Tasks*",
                            "attachments": [{

                                "text": "Nothing was found assigned to you in smartsheets.",
                                "fallback": "",
                                "color": "#3AA3E3",
                                "attachment_type": "default",
                                "title": "Nothing found!"
                            }]
                        },
                        "outputContexts": [{
                            "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/smartSheets"
                        }]
                    }
                };
                //console.log(payloadSlack);
                res.send(payloadSlack);
            }


        });

}

// function createServiceNowGeneralRequest(req, userName, opsDescription, opsImpact) {

//     var actionJSONPayload = JSON.parse(req.body.payload);
//     var is_prevented_working = actionJSONPayload.submission.ops_is_p === "Yes" ? actionJSONPayload.submission.ops_system + " Error: Unable to work" : actionJSONPayload.submission.ops_system + " Issue: Able to work";


//     var slackUserId = req.body.originalDetectIntentRequest.payload.data.event.user;
//     var options = {
//         method: 'GET',
//         url: 'https://ffn-chatbot-weather-dev.appspot.com/ideas/getSlackUserInfo',
//         qs: {
//             userid: slackUserId
//         },
//         headers: {
//             Host: 'ffn-chatbot-weather-dev.appspot.com',
//             Accept: 'applicaiton/json'
//         }
//     };

//     return rp(options)
//         .then(body => {

//             var slackUserData = JSON.parse(body);

//             console.log("oktaGroup: " + slackUserData.data.okta_group);
//             var slackUserData = JSON.parse(body);



//             //slackFullName = slackUserData.user.profile.real_name;

//             if (slackUserData.data.email !== undefined) {
//                 var splitName = slackUserData.data.email.split("@");
//                 //var indexOfAtSign = slackUserData.data.email.toString().indexOf("@");
//                 tryUserName = splitName[0];
//             } else {
//                 tryUserName = '';
//             }


//             var optionsSnowUser = {
//                 method: 'GET',
//                 url: 'https://freedomfinancialnetworkdev.service-now.com/api/now/table/sys_user',
//                 qs: {
//                     sysparm_query: 'user_name=' + tryUserName
//                 },
//                 headers: {
//                     'Accept-Encoding': 'gzip, deflate',
//                     Accept: 'application/json',
//                     Authorization: 'Basic SVRCdXNpbmVzc1N5c3RlbXM6ZjdBYzhsbTFkdXo5'
//                 }
//             };


//             return rp(optionsSnowUser)
//                 .then(body => {
//                     var jsonObj = JSON.parse(body);
//                     var snowSysId = jsonObj.result[0].sys_id;
//                     var locationId = jsonObj.result[0].location.value;
//                     var snowExtension = jsonObj.result[0].u_extension;

//                     var createRequestOptions = {
//                         method: 'POST',
//                         url: 'https://freedomfinancialnetworkdev.service-now.com/api/sn_sc/v1/servicecatalog/items/1c7de5b0db44d740244ff1fcbf9619e6/submit_producer',
//                         headers: {
//                             'Accept-Encoding': 'gzip, deflate',
//                             Accept: 'application/json',
//                             Authorization: 'Basic SVRCdXNpbmVzc1N5c3RlbXM6ZjdBYzhsbTFkdXo5'
//                         },
//                         body: {
//                             variables: {
//                                 caller: snowSysId,
//                                 opened_by: snowSysId,
//                                 how_impacts: is_prevented_working,
//                                 description: opsDescription,
//                                 location: locationId,
//                                 u_impact: opsImpact,
//                                 new_call_requester_variables: 'true',
//                                 contact_number: snowExtension
//                             },
//                             sysparm_item_guid: 'efef49da1b4cc4d064b1a9ffbd4bcb18',
//                             get_portal_messages: 'true',
//                             sysparm_no_validation: 'true'
//                         },
//                         json: true
//                     };
//                     return rp(options)
//                         .then(body => {
//                             // update ops_comm with the service now request ID and sys_id below. 

//                             var snowReqObj = JSON.parse(body);
//                             var ticketSysId = snowReqObj.result.sys_id;
//                             var ticketNumber = snowReqObj.result.number;

//                             console.log("Created SNOW ticket. sys_id: " + ticketSysId + " ticketNum: " + ticketNumber);

//                             var snowData = {
//                                 'success': 'Ok',
//                                 'sys_id': ticketSysId,
//                                 'ticket_number': ticketNumber
//                             };
//                             return snowData;
//                             // if (!mysqlPool) {
//                             //     mysqlPool = mysql.createPool(mysqlConfig);
//                             // }

//                             // mysqlPool.query("UPDATE ops_comm SET snow_sys_id=?, snow_id=?, is_resolved=?, mod_on=current_timestamp(), notes=? WHERE id=?", [assignee, assigneeSlackId, isClosed, notes, id], (err, results) => {
//                             //     if (err) {
//                             //         console.log("ERROR updating ops_comm: " + err);

//                             //     } else {
//                             //         var retData = {
//                             //             "data": results
//                             //         }

//                             //         if (retData.data.affectedRows === 1) {


//                             //             res.send('Successfully updated!<br><br><a href="https://storage.googleapis.com/ffn-images/img/index.html">Return to open items</a>');
//                             //         }
//                             //     }
//                             // });

//                         });
//                 });

//         });

// }

function salesforceHandler(req, res, next) {

    try {
        var sfToken = '';
        var enteredSearchForPhrase = req.body.queryResult.parameters.phraseToSearch.trim();
        var baseUrl = 'https://na119.salesforce.com'; // dev/staging 'https://cs24.salesforce.com';
        var searchForPhrase = encodeURI(enteredSearchForPhrase);
        var numItems = 0;
        var optionsSF = {
            method: 'POST',
            url: 'https://na119.salesforce.com/services/oauth2/token', // dev/staging 'https://cs24.salesforce.com/services/oauth2/token',
            qs: {
                grant_type: 'password',
                client_id: '3MVG9VmVOCGHKYBQuDOj4G0yV26sNZa.SXAPpjKFsoI9M03qiglOGIRed7oo_0A3PRWtaNJd4PwE0T8dSMSGH',
                client_secret: '684C5BDB4C1F1B822298C30550366384FC3D22DA42B5B5C2E5D0FF04BF3B0567',
                username: 'svc.franklin@freedomdebtrelief.com',
                password: 'A91mb29m19vz!KKY9WIxeUFGtPCvSGGy7EVPQ1Z'
            },
            headers: {
                Host: 'na119.salesforce.com', // dev staging 'cs24.salesforce.com',
                Accept: 'application/json',
                'Content-Type': 'application/json'
            }
        };

        return rp(optionsSF)
            .then(body => {
                var jsonDataToken = JSON.parse(body);

                sfToken = jsonDataToken.access_token;
                baseUrl = jsonDataToken.instance_url;
                console.log("Got token: " + sfToken);

                var options = {
                    method: 'GET',
                    url: 'https://na119.salesforce.com/services/data/v46.0/search/suggestTitleMatches',
                    qs: {
                        q: searchForPhrase
                    },
                    headers: {
                        Host: 'na119.salesforce.com', // dev staging 'cs24.salesforce.com',
                        Accept: 'application/json',
                        Authorization: 'OAuth ' + sfToken
                    }
                };

                return rp(options)
                    .then(body => {


                        var attachmentArray = [];


                        var jsonData = JSON.parse(body);
                        if (jsonData.autoSuggestResults !== undefined) {
                            for (var i = 0; i < jsonData.autoSuggestResults.length; i++) {
                                var sfArticle = jsonData.autoSuggestResults[i];
                                numItems++;
                                attachmentArray.push({

                                    "text": sfArticle.Title,
                                    "fallback": sfArticle.Title,
                                    "color": "#3AA3E3",
                                    "attachment_type": "default",
                                    "title": "Salesforce Article",
                                    "actions": [{
                                        "text": "View Article Now",
                                        "type": "button",
                                        "url": baseUrl + '/' + sfArticle.Id,
                                        "style": "primary"
                                    }]
                                });
                            }
                            if (numItems > 0) {
                                var payloadSlack = {
                                    "payload": {
                                        "slack": {
                                            "text": "*Salesforce Articles*\nGot it! We found the following results ...",
                                            "attachments": attachmentArray
                                        },
                                        "outputContexts": [{
                                            "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/salesforceKnowledgeSearch"
                                        }]
                                    }
                                };


                                res.send(payloadSlack);
                            } else {
                                var payloadSlack = {
                                    "payload": {
                                        "slack": {
                                            "text": "Salesforce Knowledge Results ...",
                                            "attachments": [{
                                                "text": "Nothing was found while searching for *" + enteredSearchForPhrase + "*. Try again maybe type less words or a specific keyword.",
                                                "fallback": "Knowledge Results ...: \nNothing was found while searching for " + enteredSearchForPhrase + ". Try again maybe type less words or a specific keyword.",
                                                "color": "#3AA3E3",
                                                "attachment_type": "default"
                                            }]
                                        },
                                        "outputContexts": [{
                                            "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/salesforceKnowledgeSearch"
                                        }]
                                    }
                                };
                                res.send(payloadSlack);
                            }
                        } else {
                            var payloadSlack = {
                                "payload": {
                                    "slack": {
                                        "text": "Salesforce Knowledge Results ...",
                                        "attachments": [{
                                            "text": "Error occured.",
                                            "fallback": "Error occured",
                                            "color": "#3AA3E3",
                                            "attachment_type": "default"
                                        }]
                                    },
                                    "outputContexts": [{
                                        "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/salesforceKnowledgeSearch"
                                    }]
                                }
                            };
                            res.send(payloadSlack);
                        }
                    });
                //console.log(statusCode, body, headers)
                // })
                // .catch((e) => {
                //     console.log(e);
                // });
            })
            .catch(function (err) {
                var payloadSlack = {
                    "payload": {
                        "slack": {
                            "text": err,
                            "attachments": [{
                                "text": "Salesforce Error occured.",
                                "fallback": "Error occured",
                                "color": "#3AA3E3",
                                "attachment_type": "default"
                            }]
                        },
                        "outputContexts": [{
                            "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/salesforceKnowledgeSearch"
                        }]
                    }
                };
                res.send(payloadSlack);
            });


    } catch (err) {
        console.log("salesforce error occured: " + err);
        var payloadSlack = {
            "payload": {
                "slack": {
                    "text": "Salesforce Knowledge Results ...",
                    "attachments": [{
                        "text": "Nothing was found while searching for *" + enteredSearchForPhrase + "*. Try again maybe type less words or a specific keyword.",
                        "fallback": "Knowledge Results ...: \nNothing was found while searching for " + enteredSearchForPhrase + ". Try again maybe type less words or a specific keyword.",
                        "color": "#3AA3E3",
                        "attachment_type": "default"
                    }]
                },
                "outputContexts": [{
                    "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/salesforceKnowledgeSearch"
                }]
            }
        };
        res.send(payloadSlack);
    }
}

function snowKnowledgeSearch(req, res, next) {
    //var searchFor = '';
    var searchForPhrase = req.body.queryResult.parameters.phraseToSearch;

    // if (req.body.queryResult.queryText.substring(0, 7) === "search ") {
    //     searchFor = req.body.queryResult.queryText.substirng(7, req.body.queryResult.queryText.length - 7).trim();
    //     //console.log("gggsearchFor: " + searchFor);
    //     //req.body.queryResult.queryText.toLowerCase().replace(/search for /g, "").replace(/search /g, "").trim();
    // }

    if (searchForPhrase !== '') {

        var options = {
            method: 'GET',
            url: 'https://freedomfinancialnetworkdev.service-now.com/api/now/table/kb_knowledge',
            qs: {
                //sysparm_query: 'short_descriptionLIKE' + searchFor
                // sysparm_query: 'metaLIKE' + searchFor +'^ORshort_descriptionLIKE' + searchFor + '^ORtextLIKE' + searchFor+'workflow_state=published'
                sysparm_query: 'metaLIKE' + searchForPhrase + '^ORshort_descriptionLIKE' + searchForPhrase + 'workflow_state=published'
            },
            headers: {
                cookie: 'JSESSIONID=AEC5C324298E1EA2671164F9C27EDF1E; glide_user_route=glide.4a1243702c7d00dde06024ce517dda5d; BIGipServerpool_freedomfinancialnetworkdev=679696394.43582.0000; glide_user_activity=U0N2MzpKTS9BU1RvZlBpd3pVSTZLd1R5UnVoSWViemIxZEJhQjpMR2lkOHI0a1NBSkQ0MDZnWUpLWkVBZ0RoQmYrNkFtSnk2dDdKQWpWcG1vPQ==; glide_user=U0N2MzpkTC9GN29RMDRVRDhHNWQyb3dXMnM4aHkxZ2ZvVUdwYjpTQ05KVmZvYmM5bEQvYUNlK0doYnMrWE1sUXRSazdhc2xaT2l6YWsyT0FjPQ==; glide_user_session=U0N2MzpkTC9GN29RMDRVRDhHNWQyb3dXMnM4aHkxZ2ZvVUdwYjpTQ05KVmZvYmM5bEQvYUNlK0doYnMrWE1sUXRSazdhc2xaT2l6YWsyT0FjPQ==',
                Host: 'freedomfinancialnetworkdev.service-now.com',
                Authorization: 'Basic SVRCdXNpbmVzc1N5c3RlbXM6ZjdBYzhsbTFkdXo5',
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        };

        return rp(options)
            .then(body => {
                var actionsArray = [];
                var attachmentArray = [];
                var jsonData = JSON.parse(body);
                var sortedData = jsonData.result.sort(sortUtils.compareSysViewCount);
                var numItems = sortedData.length;
                var articlesText = "";
                // add action buttons. 
                // url -> jsonData.result[i].kb_knowledge_base.link, is not right link 
                // the right article id to use is 
                for (var i = 0; i < numItems; i++) {
                    //articlesText = articlesText + "*" + sortedData[i].short_description + "* syscount: " + sortedData[i].sys_view_count;
                    //articlesText = articlesText + "*" + sortedData[i].short_description + "*\n" + sortedData[i].meta_description;

                    attachmentArray.push({

                        "text": sortedData[i].meta_description,
                        "fallback": sortedData[i].short_description,
                        "color": "#3AA3E3",
                        "attachment_type": "default",
                        "title": jsonData.result[i].short_description,
                        "fields": [{
                                "title": "Number",
                                "value": sortedData[i].number,
                                "short": true
                            },
                            {
                                "title": "Article Updated",
                                "value": sortedData[i].sys_updated_on,
                                "short": true
                            }
                        ],
                        "actions": [{
                                "text": "View Article Now",
                                "type": "button",
                                "url": "https://freedomfinancialnetwork.service-now.com/sp?id=kb_article&sys_id=" + sortedData[i].article_id,
                                "style": "primary"
                            }

                        ]
                    });
                    // actionsArray.push({

                    //     "text": "View " + sortedData[i].short_description.substring(0, 40) + " ...",
                    //     "type": "button",
                    //     "url": "https://freedomfinancialnetwork.service-now.com/sp?id=kb_article&sys_id=" + sortedData[i].article_id,
                    //     "style": "primary"
                    // });
                }

                if (numItems > 0) {
                    var payloadSlack = {
                        "payload": {
                            "slack": {
                                "text": "Got it! We found the following results ...",
                                "attachments": attachmentArray
                                // "attachments": [{
                                //     "text": articlesText,
                                //     "fallback": "Knowledge Results: \n" + articlesText + "\n",
                                //     "color": "#3AA3E3",
                                //     "attachment_type": "default" //,
                                //     //"actions": actionsArray
                                // }]
                            },
                            "outputContexts": [{
                                "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/SNOWKnowledgeSearch"
                            }]
                        }
                    };


                    res.send(payloadSlack);
                } else {
                    var payloadSlack = {
                        "payload": {
                            "slack": {
                                "text": "Knowledge Results ...",
                                "attachments": [{
                                    "text": "Nothing was found while searching for *" + searchForPhrase + "*. Try again maybe type less words or a specific keyword.",
                                    "fallback": "Knowledge Results ...: \nNothing was found while searching for " + searchForPhrase + ". Try again maybe type less words or a specific keyword.",
                                    "color": "#3AA3E3",
                                    "attachment_type": "default"
                                }]
                            },
                            "outputContexts": [{
                                "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/SNOWKnowledgeSearch"
                            }]
                        }
                    };
                    res.send(payloadSlack);
                }

            })
            .catch(function (err) {
                logError(err, req.body.originalDetectIntentRequest.payload.data.event.user, 'SNOWKnowledgeSearch', 'snowKnowledgeSearch');
            });
    } else {

        var payloadSlack = {
            "payload": {
                "slack": {
                    "text": "Knowledge Results ...",
                    "attachments": [{
                        "text": "Nothing was found while searching for *" + searchForPhrase + "*. Try again maybe type less words or a specific keyword.",
                        "fallback": "Knowledge Results ...: \nNothing was found while searching for " + searchForPhrase + ". Try again maybe type less words or a specific keyword.",
                        "color": "#3AA3E3",
                        "attachment_type": "default"
                    }]
                },
                "outputContexts": [{
                    "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/SNOWKnowledgeSearch"
                }]
            }
        };
        res.send(payloadSlack);
    }
}

function snowKnowledgeSearchbu(req, res, next) {
    var searchFor = '';
    if (req.body.queryResult.queryText) {
        searchFor = req.body.queryResult.queryText.toLowerCase().replace(/find /g, "").replace(/search for /g, "").replace(/search /g, "").trim();
    }

    if (searchFor !== '') {

        var options = {
            method: 'GET',
            url: 'https://freedomfinancialnetworkdev.service-now.com/api/now/table/kb_knowledge',
            qs: {
                sysparm_query: 'short_descriptionLIKE' + searchFor
            },
            headers: {
                cookie: 'JSESSIONID=AEC5C324298E1EA2671164F9C27EDF1E; glide_user_route=glide.4a1243702c7d00dde06024ce517dda5d; BIGipServerpool_freedomfinancialnetworkdev=679696394.43582.0000; glide_user_activity=U0N2MzpKTS9BU1RvZlBpd3pVSTZLd1R5UnVoSWViemIxZEJhQjpMR2lkOHI0a1NBSkQ0MDZnWUpLWkVBZ0RoQmYrNkFtSnk2dDdKQWpWcG1vPQ==; glide_user=U0N2MzpkTC9GN29RMDRVRDhHNWQyb3dXMnM4aHkxZ2ZvVUdwYjpTQ05KVmZvYmM5bEQvYUNlK0doYnMrWE1sUXRSazdhc2xaT2l6YWsyT0FjPQ==; glide_user_session=U0N2MzpkTC9GN29RMDRVRDhHNWQyb3dXMnM4aHkxZ2ZvVUdwYjpTQ05KVmZvYmM5bEQvYUNlK0doYnMrWE1sUXRSazdhc2xaT2l6YWsyT0FjPQ==',
                Host: 'freedomfinancialnetworkdev.service-now.com',
                Authorization: 'Basic SVRCdXNpbmVzc1N5c3RlbXM6ZjdBYzhsbTFkdXo5',
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        };

        return rp(options)
            .then(body => {
                var actionsArray = [];
                var jsonData = JSON.parse(body);
                var numItems = jsonData.result.length;
                var articlesText = "";
                // add action buttons. 
                // url -> jsonData.result[i].kb_knowledge_base.link, is not right link 
                // the right article id to use is 
                for (var i = 0; i < numItems; i++) {
                    articlesText = articlesText + "\n" + jsonData.result[i].short_description;

                    actionsArray.push({

                        "text": "View " + jsonData.result[i].short_description.substring(0, 40) + " ...",
                        "type": "button",
                        "url": "https://freedomfinancialnetwork.service-now.com/sp?id=kb_article&sys_id=" + jsonData.result[i].article_id,
                        "style": "primary"
                    });
                }

                if (numItems > 0) {
                    var payloadSlack = {
                        "payload": {
                            "slack": {
                                "text": "Knowledge Results ...",
                                "attachments": [{
                                    "text": articlesText,
                                    "fallback": "Knowledge Results: \n" + articlesText + "\n",
                                    "color": "#3AA3E3",
                                    "attachment_type": "default",
                                    "actions": actionsArray
                                }]
                            },
                            "outputContexts": [{
                                "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/SNOWKnowledgeSearch"
                            }]
                        }
                    };


                    res.send(payloadSlack);
                } else {
                    var payloadSlack = {
                        "payload": {
                            "slack": {
                                "text": "Knowledge Results ...",
                                "attachments": [{
                                    "text": "Nothing was found while searching for " + searchFor + ". Try again maybe type less words or a specific keyword.",
                                    "fallback": "Knowledge Results ...: \nNothing was found while searching for " + searchFor + ". Try again maybe type less words or a specific keyword.",
                                    "color": "#3AA3E3",
                                    "attachment_type": "default"
                                }]
                            },
                            "outputContexts": [{
                                "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/SNOWKnowledgeSearch"
                            }]
                        }
                    };
                    res.send(payloadSlack);
                }

            })
            .catch(function (err) {
                logError(err, req.body.originalDetectIntentRequest.payload.data.event.user, 'SNOWKnowledgeSearch', 'snowKnowledgeSearchbu');
            });
    } else {

        var payloadSlack = {
            "payload": {
                "slack": {
                    "text": "Knowledge Results ...",
                    "attachments": [{
                        "text": "Nothing was found while searching for " + searchFor + ". Try again maybe type less words or a specific keyword.",
                        "fallback": "Knowledge Results ...: \nNothing was found while searching for " + searchFor + ". Try again maybe type less words or a specific keyword.",
                        "color": "#3AA3E3",
                        "attachment_type": "default"
                    }]
                },
                "outputContexts": [{
                    "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/SNOWKnowledgeSearch"
                }]
            }
        };
        res.send(payloadSlack);
    }
}

function stockQuoteHandler(req, res, next) {

    var stockSymbol = '';
    if (req.body.queryResult.queryText) {
        stockSymbol = req.body.queryResult.queryText.toLowerCase().replace(/quote: /g, "").replace(/stock: /g, "").trim();
    }

    var urlYahooFinance = "https://finance.yahoo.com/quote/" + stockSymbol + "?p=" + stockSymbol + "&.tsrc=fin-srch";

    var payloadSlack = {
        "payload": {
            "slack": {
                "text": "Stock Quote",
                "attachments": [{
                    "text": 'Stock Symbol: ' + stockSymbol,
                    "fallback": 'Stock Quote for: ' + stockSymbol,
                    "color": "#3AA3E3",
                    "attachment_type": "default",
                    "actions": [{
                        "type": "button",
                        "text": "Yahoo Finance",
                        "url": urlYahooFinance,
                        "style": "primary"
                    }]
                }],
                "outputContexts": [{
                    "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/StockQuote"
                }]
            }
        }
    };
    res.send(payloadSlack);

    // var options = {
    //     method: 'GET',
    //     url: 'https://investors-exchange-iex-trading.p.rapidapi.com/stock/' + stockSymbol + '/quote',
    //     json: true,
    //     headers: {
    //         "X-RapidAPI-Host": "investors-exchange-iex-trading.p.rapidapi.com",
    //         "X-RapidAPI-Key": "f4cfeb952fmsh9f65fbc070cfeacp13df8cjsn002536a71bc2",
    //         Accept: "applicaiton/json"
    //     }
    // };

    // return rp(options)
    //     .then(body => {
    //         var payloadSlack = {
    //             "payload": {
    //                 "slack": {
    //                     "text": "*" + body.symbol + ": " + body.companyName + "*",
    //                     "attachments": [{
    //                         "text": "Stock quote received from iex-trading",
    //                         "fallback": body.symbol + ": " + body.companyName + " Open: " + body.open + " Close: " + body.close,
    //                         "color": "#3AA3E3",
    //                         "attachment_type": "default",
    //                         "fields": [{
    //                                 "title": "Primary Exchange",
    //                                 "value": body.primaryExchange,
    //                                 "short": false,
    //                             },
    //                             {
    //                                 "title": "Sector",
    //                                 "value": body.sector,
    //                                 "short": true
    //                             },
    //                             // {
    //                             //     "title": "Calculation Price",
    //                             //     "value": body.calculationPrice,
    //                             //     "short": true
    //                             // },
    //                             // {
    //                             //     "title": "Open",
    //                             //     "value": body.open,
    //                             //     "short": true
    //                             // },
    //                             // {
    //                             //     "title": "Open Time",
    //                             //     "value": convertToTime(body.openTime),
    //                             //     "short": true
    //                             // },
    //                             // {
    //                             //     "title": "Close",
    //                             //     "value": body.close,
    //                             //     "short": true
    //                             // },
    //                             // {
    //                             //     "title": "Close Time",
    //                             //     "value": convertToTime(body.closeTime),
    //                             //     "short": true
    //                             // },
    //                             {
    //                                 "title": "High",
    //                                 "value": body.high,
    //                                 "short": true
    //                             },
    //                             {
    //                                 "title": "Low",
    //                                 "value": body.low,
    //                                 "short": true
    //                             },
    //                             {
    //                                 "title": "Latest Price",
    //                                 "value": body.latestPrice,
    //                                 "short": true
    //                             },
    //                             // {
    //                             //     "title": "Latest Source",
    //                             //     "value": body.latestSource,
    //                             //     "short": true
    //                             // },
    //                             // {
    //                             //     "title": "Latest Time",
    //                             //     "value": body.latestTime,
    //                             //     "short": true
    //                             // },
    //                             // {
    //                             //     "title": "Latest Update",
    //                             //     "value": convertToTime(body.latestUpdate),
    //                             //     "short": true
    //                             // },
    //                             {
    //                                 "title": "Latest Volume",
    //                                 "value": numberWithCommas(body.latestVolume),
    //                                 "short": true
    //                             },
    //                             // {
    //                             //     "title": "iex Realtime Price",
    //                             //     "value": body.iexRealtimePrice,
    //                             //     "short": true
    //                             // },
    //                             // {
    //                             //     "title": "iex Realtime Size",
    //                             //     "value": body.iexRealtimeSize,
    //                             //     "short": true
    //                             // },
    //                             // {
    //                             //     "title": "iex Last Updated",
    //                             //     "value": convertToTime(body.iexLastUpdated),
    //                             //     "short": true
    //                             // },
    //                             // {
    //                             //     "title": "Delayed Price",
    //                             //     "value": body.delayedPrice,
    //                             //     "short": true
    //                             // },
    //                             // {
    //                             //     "title": "Delayed Price Time",
    //                             //     "value": convertToTime(body.delayedPriceTime),
    //                             //     "short": true
    //                             // },
    //                             // {
    //                             //     "title": "Extended Price",
    //                             //     "value": body.extendedPrice,
    //                             //     "short": true
    //                             // },
    //                             // {
    //                             //     "title": "Extended Change",
    //                             //     "value": body.extendedChange,
    //                             //     "short": true
    //                             // },
    //                             // {
    //                             //     "title": "Extended Change Percent",
    //                             //     "value": body.extendedChangePercent,
    //                             //     "short": true
    //                             // },
    //                             {
    //                                 "title": "Prev Close",
    //                                 "value": body.previousClose,
    //                                 "short": true
    //                             },
    //                             {
    //                                 "title": "Change",
    //                                 "value": body.change,
    //                                 "short": true
    //                             },
    //                             // {
    //                             //     "title": "Change Percent",
    //                             //     "value": body.changePercent,
    //                             //     "short": true
    //                             // },
    //                             // {
    //                             //     "title": "iex Market Percent",
    //                             //     "value": body.iexMarketPercent,
    //                             //     "short": true
    //                             // },
    //                             // {
    //                             //     "title": "iex Volume",
    //                             //     "value": numberWithCommas(body.iexVolume),
    //                             //     "short": true
    //                             // },
    //                             {
    //                                 "title": "AVG Total Volume",
    //                                 "value": numberWithCommas(body.avgTotalVolume),
    //                                 "short": true
    //                             },
    //                             // {
    //                             //     "title": "iex Bid Price",
    //                             //     "value": body.iexBidPrice,
    //                             //     "short": true
    //                             // },
    //                             // {
    //                             //     "title": "iex Bid Size",
    //                             //     "value": body.iexBidSize,
    //                             //     "short": true
    //                             // },
    //                             // {
    //                             //     "title": "iex Ask Price",
    //                             //     "value": body.iexAskPrice,
    //                             //     "short": true
    //                             // },
    //                             {
    //                                 "title": "Market Cap",
    //                                 "value": numberWithCommas(body.marketCap),
    //                                 "short": true
    //                             },
    //                             {
    //                                 "title": "PE Ratio",
    //                                 "value": body.peRatio,
    //                                 "short": true
    //                             },
    //                             {
    //                                 "title": "52 Week High",
    //                                 "value": body.week52High,
    //                                 "short": true
    //                             },
    //                             {
    //                                 "title": "52 Week Low",
    //                                 "value": body.week52Low,
    //                                 "short": true
    //                             },
    //                             {
    //                                 "title": "YTD Change",
    //                                 "value": body.ytdChange,
    //                                 "short": true
    //                             }
    //                         ],
    //                         "actions": [{
    //                             "type": "button",
    //                             "text": "Yahoo Finance",
    //                             "url": "https://finance.yahoo.com/quote/" + stockSymbol + "/",
    //                             "style": "primary"
    //                         }]
    //                     }]
    //                 },
    //                 "outputContexts": [{
    //                     "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/StockQuote"
    //                 }]
    //             }
    //         };
    //         res.send(payloadSlack);
    //     })
    //     .catch(function (err) {
    //         logError("QueryText: " + req.body.queryResult.queryText + " Error:" + err, req.body.originalDetectIntentRequest.payload.data.event.user, 'StockQuote', 'stockQuoteHandler');
    //     });
}

function tjiraSpecProjHandler(req, res, next) {
    var report = '';
    if (req.body.queryResult.queryText) {
        report = req.body.queryResult.queryText.toLowerCase().replace(/status of /g, "").replace(/status /g, "").trim();
    } else {
        report = 'top 10';
    }

    var options = {
        method: 'GET',
        url: 'https://billsdev.atlassian.net/rest/agile/1.0/board/305/epic/94481/issue',
        headers: {
            Authorization: 'Basic Z25laWdlckBmcmVlZG9tZmluYW5jaWFsbmV0d29yay5jb206ODVzSWNSSExTRGVua3VkaVlndkU0MUJG',
            Accept: 'application/json'
        }
    };

    var returnProjs = "";
    return rp(options)
        .then(body => {
            var matchCount = 0;
            var jsonData = JSON.parse(body);
            var numItems = jsonData.issues.length;
            //console.log("size: " + numItems);
            //console.log("BODY: " + body);
            for (var j = 0; j < numItems; j++) {
                var objData = jsonData.issues[j];
                var desc = "";
                if (objData.fields.status.name !== "Done" && (objData.fields.summary.trim().toLowerCase().includes(report.trim().toLowerCase()) || report.trim().includes('top 10'))) {

                    if (matchCount > 0) {
                        returnProjs = returnProjs + "\n\n----------------------------\n\n";
                    }
                    matchCount++;
                    if (objData.fields.description !== null) {
                        desc = objData.fields.description.replaceAll("*", "•"); //"&#x2022;");
                    }

                    var assigneeName = "";
                    if (objData.fields.assignee !== null) {
                        assigneeName = objData.fields.assignee.displayName;
                    }

                    if (objData.fields.customfield_13939 != null) {
                        switch (objData.fields.customfield_13939.value.toLowerCase()) {
                            case "green":
                                returnProjs = returnProjs + "*Project*: " + objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: " + objData.fields.status.name + " :thumbsup:\n*Highlights*:\n" + desc;
                                break;
                            case "yellow":
                                returnProjs = returnProjs + "*Project*: " + objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: " + objData.fields.status.name + " :thumbsup::thumbsdown:\n*Highlights*:\n" + desc;
                                break;
                            case "red":
                                returnProjs = returnProjs + "*Project*: " + objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: " + objData.fields.status.name + " :thumbsdown:\n*Highlights*:\n" + desc;
                                break;
                        }
                    } else {
                        returnProjs = returnProjs + "*Project*: " + objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: " + objData.fields.status.name + "\n" + desc;
                    }
                    //returnProjs = returnProjs + "*Project*: " + objData.fields.summary + " \n*Assignee*: " + assigneeName + "\n*Status*: :thumbsup:" + objData.fields.status.name + "\n*Highlights*:\n" + desc;
                    /*if(objData.fields.sprint !== null && objData.fields.sprint.startDate !== null && objData.fields.sprint.endDate !== null) {
                      var startDate = objData.fields.sprint.startDate;
                      
                      var endDate = objData.fields.sprint.endDate;
                      returnProjs = returnProjs + "\n*Start - End*: " + startDate + " - " + endDate;
                    }*/
                    if (objData.fields.customfield_13941 !== null) {
                        returnProjs = returnProjs + "\n*Project Slide*: " + objData.fields.customfield_13941;
                    }
                    if (objData.fields.customfield_13940 !== null) {
                        returnProjs = returnProjs + "\n*Project Schedule*: " + objData.fields.customfield_13940;
                    }
                    if (objData.fields.sprint !== null && objData.fields.sprint.state !== null) {
                        returnProjs = returnProjs + "\n*Sprint State*: " + objData.fields.sprint.state;
                    }
                    if (objData.fields.priority.name !== null) {
                        returnProjs = returnProjs + "\n*Priority*: " + objData.fields.priority.name;
                    }
                    if (objData.fields.timespent !== null) {
                        returnProjs = returnProjs + "\n*Time Spent*: " + objData.fields.timespent;
                    }
                    returnProjs = returnProjs + "\n*Progress / Total*: " + objData.fields.progress.progress + " / " + objData.fields.progress.total;
                    if (objData.fields.watches !== null && objData.fields.watches.watchCount !== null) {
                        returnProjs = returnProjs + "\n*Watch Count*: " + objData.fields.watches.watchCount;
                    }
                }

                //   console.log("Task: " + objData.fields.summary);
                //   console.log("Description: " + objData.fields.description);
            }
            if (returnProjs !== "") {
                var payloadSlack = {
                    "payload": {
                        "slack": {
                            "text": "IT JIRA Projects ...",
                            "attachments": [{
                                "text": returnProjs,
                                "fallback": "IT JIRA Projects: \n" + returnProjs,
                                "color": "#3AA3E3",
                                "attachment_type": "default",
                            }]
                        },
                        "outputContexts": [{
                            "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/JIRA-SpecProj"
                        }]
                    }
                };
                res.send(payloadSlack);


            } else {
                var payloadSlack = {
                    "payload": {
                        "slack": {
                            "text": "IT JIRA Projects ...",
                            "attachments": [{
                                "text": "Nothing was found while searching for " + report + ". Try again maybe type less words or a specific keyword.",
                                "fallback": "IT JIRA Projects: \nNothing was found while searching for " + report + ". Try again maybe type less words or a specific keyword.",
                                "color": "#3AA3E3",
                                "attachment_type": "default"
                            }]
                        },
                        "outputContexts": [{
                            "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/JIRA-SpecProj"
                        }]
                    }
                };
                res.send(payloadSlack);
            }
        })
        .catch(function (err) {
            logError(err, req.body.originalDetectIntentRequest.payload.data.event.user, 'TJIRA', 'tjiraSpecProjHandler');
        });
}


function jokeHandler(req, res, next) {
    var options = {
        uri: 'https://icanhazdadjoke.com/',
        method: 'GET',
        json: true,
        headers: {
            "Accept": 'text/plain'
        }
    };

    return rp(options)
        .then(result => {
            //console.log("joke received: " + result);
            var payloadSlack = {
                "payload": {
                    "slack": {
                        //"text": "Joke",
                        "attachments": [{
                            // "text": result,
                            // "fallback": 'Joke: ' + result,
                            // "color": "#3AA3E3",
                            // "attachment_type": "default",

                            "blocks": [{
                                    "type": "section",
                                    "text": {
                                        "type": "mrkdwn",
                                        "text": ":laughing: " + result,
                                    }
                                },
                                {
                                    "type": "actions",
                                    "elements": [{
                                            "type": "button",
                                            "text": {
                                                "type": "plain_text",
                                                "emoji": true,
                                                "text": "Tell Me a Dad Joke"
                                            },
                                            "style": "primary",
                                            "value": "click_another_joke"
                                        },
                                        {
                                            "type": "button",
                                            "text": {
                                                "type": "plain_text",
                                                "emoji": true,
                                                "text": "Tell Me a Lawyer Joke"
                                            },
                                            "style": "primary",
                                            "value": "click_lawyer_joke"
                                        },
                                        {
                                            "type": "button",
                                            "text": {
                                                "type": "plain_text",
                                                "emoji": true,
                                                "text": "Tell Me a IT Joke"
                                            },
                                            "style": "primary",
                                            "value": "click_it_joke"
                                        }
                                    ]
                                }
                            ]
                        }]
                    },
                    "outputContexts": [{
                        "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/Joke"
                    }]
                }
            };
            res.send(payloadSlack);
        })
        .catch(function (err) {
            console.log("joke Error: " + err);
            logError(err, req.body.originalDetectIntentRequest.payload.data.event.user, 'Joke', 'jokeHandler');
        });
}

//https://geek-jokes.sameerkumar.website/api

function joke2Handler(req, res, next) {
    var options = {
        uri: 'https://geek-jokes.sameerkumar.website/api',
        method: 'GET',
        json: true
    };

    return rp(options)
        .then(result => {
            var payloadSlack = {
                "payload": {
                    "slack": {
                        "text": "Information Technology Joke",
                        "attachments": [{
                            "text": result,
                            "fallback": 'Information Technology Joke: ' + result,
                            "color": "#3AA3E3",
                            "attachment_type": "default",
                        }]
                    },
                    "outputContexts": [{
                        "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/J2"
                    }]
                }
            };
            res.send(payloadSlack);
        })
        .catch(function (err) {
            logError(err, req.body.originalDetectIntentRequest.payload.data.event.user, 'J2', 'joke2Handler');
        });
}

function incidentMgtHandler(req, res, next) {
    var payloadSlack = {
        "payload": {
            "slack": {
                "text": "Incident Management (IM)",
                "attachments": [{
                    "text": "Incident Management Resources from ServiceNow below ...",
                    "attachment_type": "default",
                    "actions": [{
                            "text": "Outage Email",
                            "type": "button",
                            "url": "https://freedomfinancialnetwork.service-now.com/sp?id=kb_article_view&sys_kb_id=3f87de47dbdef240a035f97e0f9619d5",
                            "style": "primary"
                        },
                        {
                            "text": "Run an Outage",
                            "type": "button",
                            "url": "https://freedomfinancialnetwork.service-now.com/sp?id=kb_article&sys_id=9ec9d821db7dd7007deefb5aaf961944",
                            "style": "primary"
                        },
                        {
                            "text": "IM",
                            "type": "button",
                            "url": "https://freedomfinancialnetwork.service-now.com/sp?id=kb_article&sys_id=5b256931dbcaa3c0c4c9f06e0f9619fd",
                            "style": "primary"
                        }
                    ]
                }]
            },
            "outputContexts": [{
                "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/IncidentMgt"
            }]
        }
    };
    res.send(payloadSlack);
}

function lawyerJokesHandler(req, res, next) {
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
    var payloadSlack = {
        "payload": {
            "slack": {
                "text": "Lawyer joke...",
                "attachments": [{
                    "text": lJokes[index],
                    "fallback": 'Lawyer Joke: \n' + lJokes[index],
                    "color": "#3AA3E3",
                    "attachment_type": "default",
                }]
            },
            "outputContexts": [{
                "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/lawyerJokes"
            }]
        }
    };
    res.send(payloadSlack);
}

function showAnotherLawyerJokes(urlResponse) {
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

    response_body = {
        text: ":laughing: " + lJokes[index],
        "replace_original": false,
        response_type: 'in_channel',
    };

    var optionsResponse = {
        uri: urlResponse,
        method: 'POST',
        body: JSON.stringify(response_body)
    };
    return rp(optionsResponse);


}


function mathFactsHandler(req, res, next) {

    var options = {
        method: 'GET',
        url: 'http://numbersapi.com/random/math',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.131 Mobile Safari/537.36',
            Referer: 'http://numbersapi.com/',
            Host: 'numbersapi.com',
            Cookie: '__atuvc=1%7C19; __atuvs=5cd26ef23bcdc1e0000; __atssc=google%3B1; __utma=227565954.930010471.1557294835.1557294835.1557294835.1; __utmc=227565954; __utmz=227565954.1557294835.1.1.utmcsr=google|utmccn=(organic)|utmcmd=organic|utmctr=(not%20provided); __utmt=1; __utmb=227565954.1.10.1557294835',
            Connection: 'keep-alive',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate',
            Accept: 'text/plain, */*; q=0.01'
        }
    };


    return rp(options)
        .then(body => {
            var payloadSlack = {
                "payload": {
                    "slack": {
                        "text": "*Math Fact*",
                        "attachments": [{
                            "text": body,
                            "fallback": "Math Facts: " + body,
                            "color": "#3AA3E3",
                            "attachment_type": "default",
                        }]
                    },
                    "outputContexts": [{
                        "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/MathFacts"
                    }]
                }
            };
            res.send(payloadSlack);
        })
        .catch(function (err) {
            logError(err, req.body.originalDetectIntentRequest.payload.data.event.user, 'MathFacts', 'mathFactsHandler');
        });
}


function sendMessageToSlackResponseURL(responseURL, JSONmessage) {

    // var postOptions = {
    //     uri: responseURL,
    //     method: 'POST',
    //     headers: {
    //         'Content-type': 'application/json'
    //     },
    //     json: JSONmessage
    // }
    // request(postOptions, (error, response, body) => {
    //     if (error) {

    //     }
    // })
}

function sendClientMailHandler(req, res, next) {
    var templateType = '';
    var clientName = '';
    var clientId = req.body.queryResult.parameters.clientId;
    var emailTemplate = req.body.queryResult.parameters.emailTemplate;
    var slackUserId = req.body.originalDetectIntentRequest.payload.data.event.user;
    var templateName = '';
    var greeting = '';
    var emailStatus = '';
    var options = {
        method: 'GET',
        url: 'https://ffn-chatbot-weather-dev.appspot.com/ideas/getSlackUserInfo',
        qs: {
            userid: slackUserId
        },
        headers: {
            Host: 'ffn-chatbot-weather-dev.appspot.com',
            Accept: 'applicaiton/json'
        }
    };

    return rp(options)
        .then(body => {
            var slackUserData = JSON.parse(body);

            if (slackUserData.data.email !== undefined) {
                var splitName = slackUserData.data.email.split("@");
                //var indexOfAtSign = slackUserData.data.email.toString().indexOf("@");
                tryUserName = splitName[0];
            } else {
                tryUserName = '';
            }

            if (emailTemplate == 1) {
                templateName = "Dashboard";
                templateType = 'D';
            } else if (emailTemplate == 2) {
                templateName = "Settlement Opportunity";
                templateType = 'S';
            }

            if (clientId == "AAB053") {
                clientName = "Jane Doe";
                greeting = "Great! We are sending the (" + templateName + ") email to Jane Doe now...";
            } else if (clientId == "AAB054") {
                clientName = "John Doe";
                greeting = "Great! We are sending the (" + templateName + ") email to John Doe now...";
            }

            var options = {
                method: 'GET',
                url: 'http://gogettermobileapps.com/sm/sendmail.php',
                qs: {
                    "clientId": clientId,
                    "emailTemplate": templateType
                }
            };

            return rp(options)
                .then(body => {
                    emailStatus = "Successfully sent email to " + clientName + " :thumbsup:";
                    var payloadSlack = {
                        "payload": {
                            "slack": {
                                "text": "Sent client email...",
                                "attachments": [{
                                    "text": greeting + "\nclient: " + clientName + " templatename: " + templateName + " templateType: " + templateType + "\n" + emailStatus,
                                    "fallback": "client: " + clientName + " templatename: " + templateName + " templateType: " + templateType,
                                    "color": "#3AA3E3",
                                    "attachment_type": "default",
                                }]
                            },
                            "outputContexts": [{
                                "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/SendClientEmail"
                            }]
                        }
                    };
                    res.send(payloadSlack);
                })
                .catch(function (err) {
                    logError('sending email Error: ' + err, req.body.originalDetectIntentRequest.payload.data.event.user, 'SendClientEmail', 'sendClientMailHandler');
                });
        })
        .catch(function (err) {
            logError('initial request Error: ' + err, req.body.originalDetectIntentRequest.payload.data.event.user, 'SendClientEmail', 'sendClientMailHandler');
        });
}


function speedingExcuseHandler(req, res, next) {
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
    var payloadSlack = {
        "payload": {
            "slack": {
                "text": "Excuses for speeding...",
                "attachments": [{
                    "text": pExcuses[index],
                    "fallback": 'Yep I was speeding because... *' + pExcuses[index] + '*',
                    "color": "#3AA3E3",
                    "attachment_type": "default",
                }]
            },
            "outputContexts": [{
                "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/PExcuses"
            }]
        }
    };
    res.send(payloadSlack);
}

// commented out due to api not being available anymore. 
// get this error: zzz
// function opinionHandler(req, res, next) {
//     //https://opinionated-quotes-api.gigalixirapp.com/v1/quotes
//     let params = ['tags=business&lang=en', 'tags=ethics&lang=en', 'tags=knowledge&lang=en', 'tags=science&lang=en', 'tags=rationality&lang=en', 'tags=technology&lang=en', 'tags=society&lang=en', 'tags=reason&lang=en', 'tags=rationality&lang=en', 'tags=short&lang=en', 'tags=nature&lang=en', 'tags=programming&lang=en', 'tags=design&lang=en', 'tags=success&lang=en', 'tags=paradise engineering&lang=en'];
//     var pIndex = Math.random() * (14 - 0) + 0;
//     var index = Math.round(pIndex);

//     var options = {
//         uri: 'https://opinionated-quotes-api.gigalixirapp.com/v1/quotes?' + params[index],
//         method: 'GET',
//         json: true,
//         headers: {
//             "Accept": "application/json"
//         }
//     };

//     return rp(options)
//         .then(result => {
//             var payloadSlack = {
//                 "payload": {
//                     "slack": {
//                         "text": "Random Opinion ...",
//                         "attachments": [{
//                             "text": result.quotes[0].quote + '\nBy...*' + result.quotes[0].author + '*',
//                             "fallback": 'Random Opinion ' + result.quotes[0].quote + '\nBy...*' + result.quotes[0].author + '*',
//                             "color": "#3AA3E3",
//                             "attachment_type": "default",
//                         }]
//                     },
//                     "outputContexts": [{
//                         "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/OpinionQuote"
//                     }]
//                 }
//             };
//             res.send(payloadSlack);
//         }) 
//         .catch(function (err) {
//             logError(err, req.body.originalDetectIntentRequest.payload.data.event.user,'OpinionQuote',  'opinionHandler');
//         });
// }

function poemHandler(req, res, next) {
    //https://www.poemist.com/api/v1/randompoems

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
            var payloadSlack = {
                "payload": {
                    "slack": {
                        "text": "Random Poem ...",
                        "attachments": [{
                            "text": returnPoem,
                            "fallback": 'Random Poem:\n ' + returnPoem,
                            "color": "#3AA3E3",
                            "attachment_type": "default",
                        }]
                    },
                    "outputContexts": [{
                        "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/Poem"
                    }]
                }
            };
            res.send(payloadSlack);
        })
        .catch(function (err) {
            //logError(err, req.body.originalDetectIntentRequest.payload.data.event.user, 'Poem', 'poemHandler');
            console.log(err);
        });
}


function sportsScoreCardHandler(req, res, next) {
    var options = {
        method: 'GET',
        url: 'https://api-secure.sports.yahoo.com/v1/editorial/s/scoreboard',
        qs: {
            lang: 'en-US',
            region: 'US',
            tz: 'America%2FPhoenix',
            ysp_redesign: '1',
            ysp_platform: 'desktop',
            leagues: 'nfl',
            week: 'current',
            season: 'current',
            sched_states: 'current',
            v: '2',
            ysp_enable_last_update: '1'
        },
        headers: {
            'cache-control': 'no-cache',
            Connection: 'keep-alive',
            'accept-encoding': 'gzip, deflate',
            Host: 'api-secure.sports.yahoo.com',
            Accept: 'application/json',
            Referer: 'https://sports.yahoo.com/nfl/',
            Origin: 'https://sports.yahoo.com'
        }
    };

    return rp(options)
        .then(body => {
            var dataJson = JSON.parse(body);
            //console.log(body);
            for (var game in dataJson.service.scorecard.games) {
                console.log(game.gameid);
                console.log(game.start_time);

            }

            // for (var i = 0; i < result.length; i++) {
            //     returnPoem = '*TITLE* ' + result[i].title + '\n' + '*POEM* \n' + result[i].content + '\n\n';
            // }
            // var payloadSlack = {
            //     "payload": {
            //         "slack": {
            //             "text": "Current Sports Scorescards ...",
            //             "attachments": [{
            //                 "text": returnPoem,
            //                 "fallback": 'Random Poem:\n ' + returnPoem,
            //                 "color": "#3AA3E3",
            //                 "attachment_type": "default",
            //             }]
            //         },
            //         "outputContexts": [{
            //             "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/SportsScoreCard"
            //         }]
            //     }
            // };
            // res.send(payloadSlack);
            res.send("ok");
        })
        .catch(function (err) {
            //logError(err, req.body.originalDetectIntentRequest.payload.data.event.user, 'sportsScoreCard', 'sportsScoreCardHandler');
            console.log(err);
        });
}

function weatherHandler(req, res, next) {
    var city;
    if (req.body.queryResult.parameters['geo-city']) {
        city = req.body.queryResult.parameters['geo-city'];
    } else {
        city = 'tempe,US';
    }

    var options = {
        uri: 'http://api.openweathermap.org/data/2.5/weather?appid=4d99a546f80dec1c17855ad9a210734f&units=imperial&q=' + encodeURIComponent(city),
        method: 'POST',
        body: {},
        json: true,
        headers: {
            Accept: 'application/json'
        }
    };
    return rp(options)
        .then(body => {
            //console.log(JSON.stringify(body));
            var urlCurrentConditions = "http://openweathermap.org/img/w/" + body.weather[0].icon + ".png";
            var payload = '{"payload":{"slack":{"text":"","attachments":[{"fallback":"' + body.name + ' ' + Math.trunc(body.main.temp) + ' \u2109 ' + body.weather[0].description + '","title":"' + body.name + ' ' + Math.trunc(body.main.temp) + ' \u2109","image_url":"' + urlCurrentConditions + '"}]}},"outputContexts":[{"name":"projects/${PROJECT_ID}/agent/sessions/${SESSION_ID}/contexts/Weather"}]}';
            res.send(JSON.parse(payload));

        })
        .catch(function (err) {
            logError(err, req.body.originalDetectIntentRequest.payload.data.event.user, 'Weather', 'weatherHandler');
            console.log('weatherHandler error occured.' + err);
        });
}

function genericwhoIsLookupHandler(req, res, next) {
    var attachmentArray = [];
    var foundCount = 0;
    var searchFirstName = '';
    var searchLastName = '';
    var searchName = '';
    var searchQs = {};

    if (req.body.queryResult.queryText) {
        searchName = req.body.queryResult.queryText.toLowerCase().replace(/who is /g, "").replace(/lookup /g, "").trim();
    }

    var splitName = searchName.split(" ");
    searchFirstName = splitName[0];
    if (splitName.length > 1) {
        searchLastName = splitName[1];
    }

    // contains a fist and last name. 
    if (searchFirstName !== '' && searchLastName !== '') {

        searchQs = {
            sysparm_query: 'first_name=' + searchFirstName,
            last_name: searchLastName
        };
    } else if (searchFirstName !== '' && searchLastName === '') {

        searchQs = {
            sysparm_query: 'last_name=' + searchFirstName
        };
    }
    // else if (searchFirstName === '' && searchLastName !== '') {

    //     searchQs = {
    //         sysparm_query: 'last_name=' + searchLastName
    //     };
    // }

    var options = {
        method: 'GET',
        url: 'https://freedomfinancialnetworkdev.service-now.com/api/now/table/sys_user',
        qs: searchQs,
        headers: {
            Accept: 'application/json',
            Authorization: 'Basic SVRCdXNpbmVzc1N5c3RlbXM6ZjdBYzhsbTFkdXo5'
        }
    };

    return rp(options)
        .then(body => {
            var jsonData = JSON.parse(body);

            try {
                for (var i = 0; i < jsonData.result.length; i++) {
                    var jsonObj = jsonData.result[i];
                    foundCount++;

                    attachmentArray.push({

                        "text": jsonObj.title,
                        "fallback": jsonObj.name + " Title: " + jsonObj.title + " Phone: " + jsonObj.phone,
                        "color": "#3AA3E3",
                        "attachment_type": "default",
                        "title": jsonObj.name,
                        "fields": [{
                                "title": "Phone",
                                "value": jsonObj.phone,
                                "short": true
                            },
                            {
                                "title": "Ext",
                                "value": jsonObj.u_extension,
                                "short": true

                            },
                            {
                                "title": "Email",
                                "value": jsonObj.email,
                                "short": false
                            }

                        ]
                    });

                }
            } catch (err) {
                logError(err, req.body.originalDetectIntentRequest.payload.data.event.user, 'whoIsLookup', 'whoIsLookupHandler try Catch');
                console.log('People Lookup Error: ' + err);
            }

            if (foundCount > 0) {
                var payloadSlack = {
                    "payload": {
                        "slack": {
                            "text": "People search ...",
                            "attachments": attachmentArray,
                        },
                        "outputContexts": [{
                            "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/whoIsLookup"
                        }]
                    }
                };
                res.send(payloadSlack);

            } else { // no users were found.
                var payloadSlack = {
                    "payload": {
                        "slack": {
                            "text": "People search ... Nothing found",
                            "attachments": [{
                                "text": "Nothing was found for your search for " + searchName,
                                "fallback": "Nothing was found for your search for " + searchName,
                                "color": "#3AA3E3",
                                "attachment_type": "default",
                            }]
                        },
                        "outputContexts": [{
                            "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/whoIsLookup"
                        }]
                    }
                };
                res.send(payloadSlack);

            }
        })
        .catch(function (err) {
            logError(err, req.body.originalDetectIntentRequest.payload.data.event.user, 'whoIsLookup', 'whoIsLookupHandler API failed');
            console.log('People Lookup Error API failed: ' + err);
            var payloadSlack = {
                "payload": {
                    "slack": {
                        "text": "Error occured doing People search",
                        "attachments": [{
                            "text": "Error occured doing search for " + searchName,
                            "fallback": "Error occured doing search for " + searchName,
                            "color": "#3AA3E3",
                            "attachment_type": "default",
                        }]
                    },
                    "outputContexts": [{
                        "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/whoIsLookup"
                    }]
                }
            };
            res.send(payloadSlack);

        });

}

function whoIsLookupHandler(req, res, next) {

    var attachmentArray = [];
    var foundCount = 0;
    var searchFirstName = '';
    var searchLastName = '';
    var searchName = '';
    var searchQs = {};

    if (req.body.queryResult.queryText) {
        searchName = req.body.queryResult.queryText.toLowerCase().replace(/who is /g, "").replace(/lookup /g, "").trim();
    }

    var splitName = searchName.split(" ");
    searchFirstName = splitName[0];
    if (splitName.length > 1) {
        searchLastName = splitName[1];
    }

    // contains a fist and last name. 
    if (searchFirstName !== '' && searchLastName !== '') {

        searchQs = {
            sysparm_query: 'first_name=' + searchFirstName,
            last_name: searchLastName
        };
    } else if (searchFirstName !== '' && searchLastName === '') {

        searchQs = {
            sysparm_query: 'last_name=' + searchFirstName
        };
    }
    // else if (searchFirstName === '' && searchLastName !== '') {

    //     searchQs = {
    //         sysparm_query: 'last_name=' + searchLastName
    //     };
    // }

    var options = {
        method: 'GET',
        url: 'https://freedomfinancialnetworkdev.service-now.com/api/now/table/sys_user',
        qs: searchQs,
        headers: {
            Accept: 'application/json',
            Authorization: 'Basic SVRCdXNpbmVzc1N5c3RlbXM6ZjdBYzhsbTFkdXo5'
        }
    };

    return rp(options)
        .then(body => {
            var jsonData = JSON.parse(body);

            try {
                for (var i = 0; i < jsonData.result.length; i++) {
                    var jsonObj = jsonData.result[i];
                    foundCount++;

                    // var optionsLocation = {
                    //     method: 'GET',
                    //     url: 'https://freedomfinancialnetworkdev.service-now.com/api/now/table/cmn_location',
                    //     qs: {
                    //         sysparm_query: 'u_display_nameLIKE' + jsonObj.name.trim()
                    //     },
                    //     headers: {
                    //         Accept: 'application/json',
                    //         Authorization: 'Basic SVRCdXNpbmVzc1N5c3RlbXM6ZjdBYzhsbTFkdXo5'
                    //     }
                    // };

                    // return rp(optionsLocation)
                    //     .then(locationBody => {
                    //         foundCount++;
                    //         var jsonLocationObj = JSON.parse(locationBody);

                    //         attachmentArray.push({

                    //             "text": jsonObj.title,
                    //             "fallback": jsonObj.name + " Title: " + jsonObj.title + " Phone: " + jsonObj.phone,
                    //             "color": "#3AA3E3",
                    //             "attachment_type": "default",
                    //             "title": jsonObj.name,
                    //             "fields": [{
                    //                     "title": "Phone",
                    //                     "value": jsonObj.phone,
                    //                     "short": true
                    //                 },
                    //                 {
                    //                     "title": "Mobile",
                    //                     "value": jsonObj.mobile_phone,
                    //                     "short": true
                    //                 },
                    //                 {
                    //                     "title": "Email",
                    //                     "value": jsonObj.email,
                    //                     "short": false
                    //                 },
                    //                 {
                    //                     "title": "Location",
                    //                     "value": jsonLocationObj.result[0].u_display_name,
                    //                     "short": false
                    //                 }
                    //             ]
                    //         });
                    //     });

                    attachmentArray.push({

                        "text": jsonObj.title,
                        "fallback": jsonObj.name + " Title: " + jsonObj.title + " Phone: " + jsonObj.phone,
                        "color": "#3AA3E3",
                        "attachment_type": "default",
                        "title": jsonObj.name,
                        "fields": [{
                                "title": "Phone",
                                "value": jsonObj.phone,
                                "short": true
                            },
                            {
                                "title": "Ext",
                                "value": jsonObj.u_extension,
                                "short": true

                            },
                            {
                                "title": "Mobile",
                                "value": jsonObj.mobile_phone,
                                "short": true
                            },
                            {
                                "title": "Email",
                                "value": jsonObj.email,
                                "short": false
                            }

                        ]
                    });

                }
            } catch (err) {
                logError(err, req.body.originalDetectIntentRequest.payload.data.event.user, 'whoIsLookup', 'whoIsLookupHandler try Catch');
                console.log('People Lookup Error: ' + err);
            }

            if (foundCount > 0) {
                var payloadSlack = {
                    "payload": {
                        "slack": {
                            "text": "People search ...",
                            "attachments": attachmentArray,
                        },
                        "outputContexts": [{
                            "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/whoIsLookup"
                        }]
                    }
                };
                res.send(payloadSlack);

            } else { // no users were found.
                var payloadSlack = {
                    "payload": {
                        "slack": {
                            "text": "People search ... Nothing found",
                            "attachments": [{
                                "text": "Nothing was found for your search for " + searchName,
                                "fallback": "Nothing was found for your search for " + searchName,
                                "color": "#3AA3E3",
                                "attachment_type": "default",
                            }]
                        },
                        "outputContexts": [{
                            "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/whoIsLookup"
                        }]
                    }
                };
                res.send(payloadSlack);

            }

        })
        .catch(function (err) {
            logError(err, req.body.originalDetectIntentRequest.payload.data.event.user, 'whoIsLookup', 'whoIsLookupHandler API failed');
            console.log('People Lookup Error API failed: ' + err);
            var payloadSlack = {
                "payload": {
                    "slack": {
                        "text": "Error occured doing People search",
                        "attachments": [{
                            "text": "Error occured doing search for " + searchName,
                            "fallback": "Error occured doing search for " + searchName,
                            "color": "#3AA3E3",
                            "attachment_type": "default",
                        }]
                    },
                    "outputContexts": [{
                        "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/whoIsLookup"
                    }]
                }
            };
            res.send(payloadSlack);

        });
}

function todoNotifications(req, res, next) {
    var channelId = req.query.channel;

    // var userId = req.query.userid;
    // var channelId = '';

    // var options = {
    //     method: 'POST',
    //     url: 'https://slack.com/api/im.open',
    //     qs: {
    //         token: '',
    //         user: userId
    //     },
    //     headers: {
    //         Accept: 'application/json',
    //         Authorization: 'Bearer xoxb-2253441267-496152507652-UyJGCtu8aPAKU5EV63p94TTK'
    //     }
    // };

    // return rp(options)
    //     .then(body => {
    //         var jsonData = JSON.parse(body);
    //         channelId = jsonData.channel.id;
    //         console.log("ChannelID: " + channelId);

    var optionSendMessage = {
        method: 'POST',
        url: 'https://slack.com/api/chat.postMessage',
        headers: {
            Accept: 'application/json',
            Authorization: 'Bearer xoxb-2253441267-496152507652-UyJGCtu8aPAKU5EV63p94TTK'
        },
        body: {
            channel: channelId, //channelId,
            link_names: true,
            text: 'hey what up',
            blocks: [{
                "type": "section",
                "text": {
                    "type": "plain_text",
                    "text": "Hello world"
                }
            }]
        },
        json: true

    };
    return rp(optionSendMessage)
        .then(results => {
            res.send(results);
        });
    // })
    // .catch(function (err) {
    //     logError(err, req.body.originalDetectIntentRequest.payload.data.event.user, 'DEV', 'directMessage API failed');
    //     console.log('Error sending message to slack app instance: ' + err);
    //     var payloadSlack = {
    //         "payload": {
    //             "slack": {
    //                 "text": "Error sending message to slack app instance",
    //                 "attachments": [{
    //                     "text": "Error sending message to slack app instance",
    //                     "fallback": "Error sending message to slack app instance",
    //                     "color": "#3AA3E3",
    //                     "attachment_type": "default",
    //                 }]
    //             },
    //             "outputContexts": [{
    //                 "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/whoIsLookup"
    //             }]
    //         }
    //     };
    //     res.send(payloadSlack);

    // });
}

function sendDirectMessage(blocksToSend, channelId) {
    // console.log("Recieved channelID: " + channelId);
    // console.log("Blocks received: " + {
    //     "blocks": blocksToSend
    // });
    var optionSendMessage = {
        method: 'POST',
        url: 'https://slack.com/api/chat.postMessage',
        headers: {
            Accept: 'application/json',
            Authorization: 'Bearer xoxb-2253441267-496152507652-UyJGCtu8aPAKU5EV63p94TTK'
        },
        body: {
            channel: channelId,
            link_names: true,
            text: 'My Todo Items',
            blocks: blocksToSend
        },
        json: true

    };
    return rp(optionSendMessage)
        .then(results => {

            console.log(JSON.stringify(results));
            // console.log("it worked hip hip: " + results);
            console.log("it worked");
        });
}

function sendOpsChannelMessage(blocksToSend, channelId) {
    // console.log("Recieved channelID: " + channelId);
    // console.log("Blocks received: " + {
    //     "blocks": blocksToSend
    // });
    var optionSendMessage = {
        method: 'POST',
        url: 'https://slack.com/api/chat.postMessage',
        headers: {
            Accept: 'application/json',
            Authorization: 'Bearer xoxb-2253441267-496152507652-UyJGCtu8aPAKU5EV63p94TTK'
        },
        body: {
            channel: channelId,
            link_names: true,
            text: 'FDR Communications',
            blocks: blocksToSend
        },
        json: true

    };

    return rp(optionSendMessage)
        .then(results => {

            //console.log(JSON.stringify(results));
            // console.log("it worked hip hip: " + results);
            //console.log("it worked");
        });
}

function notifiyUserSnowRequestMessage(blocksToSend, channelId) {

    var optionSendMessage = {
        method: 'POST',
        url: 'https://slack.com/api/chat.postMessage',
        headers: {
            Accept: 'application/json',
            Authorization: 'Bearer xoxb-2253441267-496152507652-UyJGCtu8aPAKU5EV63p94TTK'
        },
        body: {
            channel: channelId,
            link_names: true,
            text: 'ServiceNow',
            blocks: blocksToSend
        },
        json: true

    };

    return rp(optionSendMessage)
        .then(results => {

            //console.log(JSON.stringify(results));
            // console.log("it worked hip hip: " + results);
            //console.log("it worked");
        });
}


// 07/31/2019 
// need to be able to reliably send a message to any slack instance. 
//In progress. 
// The idea is to call and get the channel based on a user. 
// However it just shows up in the a private channel for the user. 
// When try with DEMMAGX7G as the channel what ever is sent shows up in my personal Franklin instance. 
// updated database and to add the channel. 
// updated the db code and writing requests to record the channel. 
// commenting out function below however it does work to send a slack message to glenn neiger franklin instance. 
function directMessage(req, res, next) {
    var channelId = req.query.channel;
    //console.log("channelId: " + channelId);
    // var userId = req.query.userid;
    // var channelId = '';

    // var options = {
    //     method: 'POST',
    //     url: 'https://slack.com/api/im.open',
    //     qs: {
    //         token: '',
    //         user: userId
    //     },
    //     headers: {
    //         Accept: 'application/json',
    //         Authorization: 'Bearer xoxb-2253441267-496152507652-UyJGCtu8aPAKU5EV63p94TTK'
    //     }
    // };

    // return rp(options)
    //     .then(body => {
    //         var jsonData = JSON.parse(body);
    //         channelId = jsonData.channel.id;
    //         console.log("ChannelID: " + channelId);

    var optionSendMessage = {
        method: 'POST',
        url: 'https://slack.com/api/chat.postMessage',
        headers: {
            Accept: 'application/json',
            Authorization: 'Bearer xoxb-2253441267-496152507652-UyJGCtu8aPAKU5EV63p94TTK'
        },
        body: {
            channel: channelId, //channelId,
            link_names: true,
            text: 'hey what up',
            blocks: [{
                "type": "section",
                "text": {
                    "type": "plain_text",
                    "text": "Hello world"
                }
            }]
        },
        json: true

    };
    return rp(optionSendMessage)
        .then(results => {
            res.send(results);
        });
    // })
    // .catch(function (err) {
    //     logError(err, req.body.originalDetectIntentRequest.payload.data.event.user, 'DEV', 'directMessage API failed');
    //     console.log('Error sending message to slack app instance: ' + err);
    //     var payloadSlack = {
    //         "payload": {
    //             "slack": {
    //                 "text": "Error sending message to slack app instance",
    //                 "attachments": [{
    //                     "text": "Error sending message to slack app instance",
    //                     "fallback": "Error sending message to slack app instance",
    //                     "color": "#3AA3E3",
    //                     "attachment_type": "default",
    //                 }]
    //             },
    //             "outputContexts": [{
    //                 "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/whoIsLookup"
    //             }]
    //         }
    //     };
    //     res.send(payloadSlack);

    // });
}

function changeMgtHandler(req, res, next) {

    var payloadSlack = {
        "payload": {
            "slack": {
                "text": "Change Management Diagram",
                "attachments": [{
                    "fallback": "Change Management Diagram: https://www.lucidchart.com/documents/view/bb0c456b-e210-41e4-9ac0-fc93b901a9fa/0",
                    "title": "View the change management diagram.",
                    "actions": [{
                        "type": "button",
                        "text": "View Diagram",
                        "url": "https://www.lucidchart.com/documents/view/bb0c456b-e210-41e4-9ac0-fc93b901a9fa/0",
                        "style": "primary"
                    }]
                }]
            },
            "outputContexts": [{
                "name": "projects/${PROJECT_ID}/agent/sessions/${SESSION_ID}/contexts/changemgt"
            }]
        }
    };

    res.send(payloadSlack);
}

function gantHandler(req, res, next) {

    var payloadSlack = {
        "payload": {
            "slack": {
                "text": "Google Gantt Chart Example",
                "attachments": [{
                    "fallback": "Google Gantt Chart Example: https://storage.googleapis.com/ffn-images/img/ggant.html",
                    "title": "A Google gantt chart example.",
                    "actions": [{
                        "type": "button",
                        "text": "View Gantt Chart",
                        "url": "https://storage.googleapis.com/ffn-images/img/ggant.html",
                        "style": "primary"
                    }]
                }]
            },
            "outputContexts": [{
                "name": "projects/${PROJECT_ID}/agent/sessions/${SESSION_ID}/contexts/gant"
            }]
        }
    };

    res.send(payloadSlack);
}

function gchartHandler(req, res, next) {
    var payloadSlack = {
        "payload": {
            "slack": {
                "text": "Google Pie Chart Example",
                "attachments": [{
                    "fallback": "Google Pie Chart: https://storage.googleapis.com/ffn-images/img/gpie.html",
                    "title": "A Google pie diagram example.",
                    "actions": [{
                        "type": "button",
                        "text": "View Pie Diagram",
                        "url": "https://storage.googleapis.com/ffn-images/img/gpie.html",
                        "style": "primary"
                    }]
                }]
            },
            "outputContexts": [{
                "name": "projects/${PROJECT_ID}/agent/sessions/${SESSION_ID}/contexts/gchart"
            }]
        }
    };

    res.send(payloadSlack);
}

function genesysSalesforceHandler(req, res, next) {

    var payloadSlack = {
        "payload": {
            "slack": {
                "text": "*Genesys Salesforce Dataflow Diagram*",
                "attachments": [{
                    "fallback": "View the Genesys Salesforce Diagram at https://www.lucidchart.com/documents/view/8e338621-9101-4f9a-bb17-8ab61d44e73b",
                    "title": "Dataflow diagram for Salesforce updates required for the 'debt settlment builder'.",
                    "actions": [{
                        "type": "button",
                        "text": "View Dataflow Diagram",
                        "url": "https://www.lucidchart.com/documents/view/8e338621-9101-4f9a-bb17-8ab61d44e73b",
                        "style": "primary"
                    }]
                }]
            },
            "outputContexts": [{
                "name": "projects/${PROJECT_ID}/agent/sessions/${SESSION_ID}/contexts/GenesysSalesforce"
            }]
        }
    };

    res.send(payloadSlack);
}

function howFranklinWorksHandler(req, res, next) {

    var payloadSlack = {
        "payload": {
            "slack": {
                "text": "*Franklin - (How Franklin Works) Diagram*",
                "attachments": [{
                    "fallback": "View the Franklin - Asana Project Dataflow Diagram at https://www.lucidchart.com/documents/view/a6565a46-8e2e-4516-98dd-d77b1e9f47af",
                    "title": "Franklin is a Slack chatbot created by FFN.",
                    "actions": [{
                        "type": "button",
                        "text": "View Dataflow Diagram",
                        "url": "https://www.lucidchart.com/documents/view/a6565a46-8e2e-4516-98dd-d77b1e9f47af",
                        "style": "primary"
                    }]
                }]
            },
            "outputContexts": [{
                "name": "projects/${PROJECT_ID}/agent/sessions/${SESSION_ID}/contexts/HowFranklinWorks"
            }]
        }
    };

    res.send(payloadSlack);
}

function networkStateHandler(req, res, next) {
    var payloadSlack = {
        "payload": {
            "slack": {
                "text": "*CCP Network Map*",
                "attachments": [{
                    "fallback": "*CCP network map* to monitor basic up/down status as well as active production alarms at https://ms-pitmgmt-px2.freedomdebtrelief.com/public/mapshow.htm?id=19964&mapid=ccp-noc",
                    "title": "Used to monitor basic up/down status as well as active production alarms.",
                    "actions": [{
                        "type": "button",
                        "text": "View CCP Network Monitor",
                        "url": "https://prtg.freedomdebtrelief.com/public/mapshow.htm?id=19964&mapid=ccp-noc",
                        "style": "primary"
                    }]
                }]
            },
            "outputContexts": [{
                "name": "projects/${PROJECT_ID}/agent/sessions/${SESSION_ID}/contexts/NetworkState"
            }]
        }
    };

    res.send(payloadSlack);
}

function oktaHandler(req, res, next) {
    var payloadSlack = {
        "payload": {
            "slack": {
                "text": "*OKTA*",
                "attachments": [{
                    "fallback": "*OKTA* (View link, use the right arrow to view pages.) at https://freedomfinancialnetwork.domo.com/link/IRQqVTpIo8ZvVzEl",
                    "title": "(View link, use the right arrow to view pages.)",
                    "actions": [{
                        "type": "button",
                        "text": "View OKTA Data",
                        "url": "https://freedomfinancialnetwork.domo.com/link/IRQqVTpIo8ZvVzEl",
                        "style": "primary"
                    }]
                }]
            },
            "outputContexts": [{
                "name": "projects/${PROJECT_ID}/agent/sessions/${SESSION_ID}/contexts/okta"
            }]
        }
    };

    res.send(payloadSlack);
}

function roomLocationHandler(req, res, next) {
    var payloadSlack = {
        "payload": {
            "slack": {
                "text": "Can you ask 'Alfred' where rooms are? You will get a map to the conference room. Thank you!",
                "attachments": [{
                    "fallback": "Can you ask 'Alfred' where rooms are? You will get a map to the conference room. Thank you!",
                    "title": "Room Search Request"
                }]
            },
            "outputContexts": [{
                "name": "projects/${PROJECT_ID}/agent/sessions/${SESSION_ID}/contexts/roomLocation"
            }]
        }
    };

    res.send(payloadSlack);
}

function sacramentoHandler(req, res, next) {
    var payloadSlack = {
        "payload": {
            "slack": {
                "text": "Escalation Plan",
                "attachments": [{
                    "fallback": "Escalation Plan: https://billsdev.atlassian.net/browse/PLAN-279",
                    "title": "The escalation plan for IT urgent todo items.",
                    "actions": [{
                        "type": "button",
                        "text": "View Escalation in JIRA",
                        "url": "https://billsdev.atlassian.net/browse/PLAN-279",
                        "style": "primary"
                    }]
                }]
            },
            "outputContexts": [{
                "name": "projects/${PROJECT_ID}/agent/sessions/${SESSION_ID}/contexts/Sacremento"
            }]
        }
    };

    res.send(payloadSlack);
}

function sanmateoWeatherHandler(req, res, next) {
    var payloadSlack = {
        "payload": {
            "slack": {
                "text": "*Weather in San Mateo, CA*",
                "attachments": [{
                    "fallback": "Check the San Mateo, CA weather at https://weather.com/weather/today/l/USCA1005:1:US",
                    "title": "View San Mateo, CA weather.",
                    "actions": [{
                        "type": "button",
                        "text": "View San Mateo, CA Weather",
                        "url": "https://weather.com/weather/today/l/USCA1005:1:US",
                        "style": "primary"
                    }]
                }]
            },
            "outputContexts": [{
                "name": "projects/${PROJECT_ID}/agent/sessions/${SESSION_ID}/contexts/sanmateoweather"
            }]
        }
    };

    res.send(payloadSlack);
}

function tempeWeatherHandler(req, res, next) {
    var payloadSlack = {
        "payload": {
            "slack": {
                "text": "*Weather in Tempe, AZ*",
                "attachments": [{
                    "fallback": "Check the Tempe, AZ weather at https://weather.com/weather/today/l/USAZ0233:1:US",
                    "title": "View Tempe, AZ weather.",
                    "actions": [{
                        "type": "button",
                        "text": "View Tempe, AZ Weather",
                        "url": "https://weather.com/weather/today/l/USAZ0233:1:US",
                        "style": "primary"
                    }]
                }]
            },
            "outputContexts": [{
                "name": "projects/${PROJECT_ID}/agent/sessions/${SESSION_ID}/contexts/TempeWeather"
            }]
        }
    };


    res.send(payloadSlack);
}

function serviceNowHandler(req, res, next) {
    var payloadSlack = {
        "payload": {
            "slack": {
                "text": "*ServiceNow*",
                "attachments": [{
                    "fallback": "*ServiceNow* (View link, use the right arrow to view pages.) at https://freedomfinancialnetwork.domo.com/link/XnkCFJd07mwWJkFJ",
                    "title": "(View link, use the right arrow to view pages.)",
                    "actions": [{
                        "type": "button",
                        "text": "View ServiceNow Stats",
                        "url": "https://freedomfinancialnetwork.domo.com/link/XnkCFJd07mwWJkFJ",
                        "style": "primary"
                    }]
                }]
            },
            "outputContexts": [{
                "name": "projects/${PROJECT_ID}/agent/sessions/${SESSION_ID}/contexts/ServiceNow"
            }]
        }
    };

    res.send(payloadSlack);
}

function twilioDomoReports(req, res, next) {
    var payloadSlack = {
        "payload": {
            "slack": {
                "text": "*Twilio SMS delivered today, by hour*",
                "attachments": [{
                    "fallback": "*Twilio SMS delivered today, by hour* (View link, use the right arrow to view pages.) at https://freedomfinancialnetwork.domo.com/link/EVJ5clmABStJHbAs",
                    "title": "(View link, use the right arrow to view pages.)",
                    "actions": [{
                        "type": "button",
                        "text": "View Twilio Stats",
                        "url": "https://freedomfinancialnetwork.domo.com/link/EVJ5clmABStJHbAs",
                        "style": "primary"
                    }]
                }]
            },
            "outputContexts": [{
                "name": "projects/${PROJECT_ID}/agent/sessions/${SESSION_ID}/contexts/TwilioDomoReports"
            }]
        }
    };

    res.send(payloadSlack);
}

function unclearedPmtsProcessHandler(req, res, next) {
    var payloadSlack = {
        "payload": {
            "slack": {
                "text": "*Uncleared Payments Process Diagram*",
                "attachments": [{
                    "fallback": "*Uncleared Payments Process* Hey check out this diagram that outlines the process. at https://www.lucidchart.com/documents/view/206ec397-36df-475e-a186-ba3abcebc5b3",
                    "title": "Hey check out this diagram that outlines the process.",
                    "actions": [{
                        "type": "button",
                        "text": "View Diagram",
                        "url": "https://www.lucidchart.com/documents/view/206ec397-36df-475e-a186-ba3abcebc5b3",
                        "style": "primary"
                    }]
                }]
            },
            "outputContexts": [{
                "name": "projects/${PROJECT_ID}/agent/sessions/${SESSION_ID}/contexts/UnclearedPaymentsProcess"
            }]
        }
    };

    res.send(payloadSlack);
}

function brightIdeaHandler(req, res, next) {

    var payloadSlack = {
        "payload": {
            "slack": {
                "text": "",
                "attachments": [{
                    "fallback": "Complete the form to enter your idea at https://sites.google.com/freedomdebtrelief.com/ffn-bright-ideas/home",
                    "title": "Brilliant Idea...",
                    "text": "Complete the form to enter your idea by clicking the button *Create Idea*",
                    "actions": [{
                        "type": "button",
                        "text": "Create Idea",
                        "url": "https://sites.google.com/freedomdebtrelief.com/ffn-bright-ideas/home",
                        "style": "primary"
                    }]
                }]
            },
            "outputContexts": [{
                "name": "projects/${PROJECT_ID}/agent/sessions/${SESSION_ID}/contexts/brightIdea"
            }]
        }
    };

    res.send(payloadSlack);
}

function fdrSalesIntakeHandler(req, res, next) {
    var payloadSlack = {
        "payload": {
            "slack": {
                "text": "",
                "attachments": [{
                    "fallback": "Complete the form to submit your request by clicking the link. (This is not a ServiceNow request.) https://docs.google.com/forms/d/e/1FAIpQLSc4ObcOK7a5X-CeTV0MajMHcjbNpDmf1sDIfaFtZhOYqzyj7g/viewform",
                    "title": "FDR Intake ...",
                    "text": "Complete the form to submit your request by clicking the button *Create Request*. (This is not a ServiceNow request.)",
                    "actions": [{
                        "type": "button",
                        "text": "Create Request",
                        "url": "https://docs.google.com/forms/d/e/1FAIpQLSc4ObcOK7a5X-CeTV0MajMHcjbNpDmf1sDIfaFtZhOYqzyj7g/viewform",
                        "style": "primary"
                    }]
                }]
            },
            "outputContexts": [{
                "name": "projects/${PROJECT_ID}/agent/sessions/${SESSION_ID}/contexts/fdrSalesIntake"
            }]
        }
    };

    res.send(payloadSlack);

}

function franklinStatsHandler(req, res, next) {

    var payloadSlack = {
        "payload": {
            "slack": {
                "text": "",
                "attachments": [{
                    "fallback": "view Franklin - AI Bot's statistics, performance and metrics.",
                    "title": "Franklin Stats ...",
                    "text": "Click the button below to view Franklin - AI Bot's statistics, performance and metrics. ",
                    "actions": [{
                        "type": "button",
                        "text": "View My Statistics",
                        "url": "https://storage.googleapis.com/ffn-images/img/frankstats.html",
                        "style": "primary"
                    }]
                }]
            },
            "outputContexts": [{
                "name": "projects/${PROJECT_ID}/agent/sessions/${SESSION_ID}/contexts/franklinStatistics"
            }]
        }
    };

    res.send(payloadSlack);
}

function getMyTodoHandler(req, res, next) {
    var displayBlocks = [];
    //console.log("received from Slack: " + JSON.stringify(req.body));

    var sUserId = req.body.originalDetectIntentRequest.payload.data.event.user;
    var d = new Date();

    if (!mysqlPool) {
        mysqlPool = mysql.createPool(mysqlConfig);
    }

    if (sUserId !== '' || sUserId !== undefined) {

        mysqlPool.query("SELECT todos.id, todos.description, todos.is_completed, todos.slack_user_id, DATE(todos.modified_finish_ts) as mod_finish_date, DATE(todos.finish_ts) AS finish_date, DATE(todos.start_ts) AS start_date, todos.is_missed_goal, usermap.channel from todos inner join usermap on todos.slack_user_id = usermap.user  WHERE (todos.finish_ts < current_timestamp() AND (todos.is_completed IS NULL OR  todos.is_completed = 0)) OR (todos.modified_finish_ts is NOT NULL AND todos.modified_finish_ts < current_timestamp() AND (todos.is_completed IS NULL OR todos.is_completed = 0)) AND todos.slack_user_id='" + sUserId + "'", (err, results) => {
            if (err) {
                console.log("Unable to fetch todos for user: " + sUserId + " Error: " + err);

                res.status(500).send(err);
            } else {

                var retData = {
                    "data": results
                };

                displayBlocks.push({
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "*Todo Items - " + d.toLocaleDateString() + "*"
                    }
                });
                try {
                    for (var i = 0; i < retData.data.length; i++) {

                        displayBlocks.push({
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": retData.data[i].description
                            }
                        });
                        displayBlocks.push({
                            "type": "section",
                            "fields": [{
                                    "type": "mrkdwn",
                                    "text": "*Start:*\n" + retData.data[i].start_date
                                },
                                {
                                    "type": "mrkdwn",
                                    "text": "*Finish:*\n" + retData.data[i].finish_date
                                }
                            ]
                        });
                        displayBlocks.push({
                            "type": "actions",
                            "elements": [{
                                    "type": "button",
                                    "text": {
                                        "type": "plain_text",
                                        "emoji": true,
                                        "text": "Completed"
                                    },
                                    "style": "primary",
                                    "value": "click_me_123"
                                },
                                {
                                    "type": "button",
                                    "text": {
                                        "type": "plain_text",
                                        "emoji": true,
                                        "text": "Modify Finish Date"
                                    },
                                    "style": "danger",
                                    "value": "click_me_123"
                                }
                            ]
                        });
                    }
                    var payloadSlack = {
                        "payload": {

                            "slack": {
                                "attachments": [{
                                    "blocks": displayBlocks
                                }]
                            },
                            "outputContexts": [{
                                "name": "projects/${PROJECT_ID}/agent/sessions/${SESSION_ID}/contexts/myTodos"
                            }]
                        }
                    };
                    res.send(payloadSlack);

                } catch (err) {
                    console.log(err);
                    res.send("Error occured with fetching your todo items");
                }
            }
        });

    }

    // var options = {
    //     method: 'GET',
    //     url: 'https://ffn-chatbot-weather-dev.appspot.com/ideas/todosByUser',
    //     qs: {
    //         slackUserId: sUserId
    //     },
    //     headers: {
    //         Accept: 'application/json'
    //     }
    // };
    // return rp(options)
    //     .then(results => {
    //         var jsonObj = JSON.parse(results);
    //         // console.log("results TODO: " + jsonObj);
    //         displayBlocks.push({
    //             "type": "section",
    //             "text": {
    //                 "type": "mrkdwn",
    //                 "text": "*Todo Items - 2019-08-06*"
    //             }
    //         });
    //         try {
    //             for (var i = 0; i < jsonObj.data.length; i++) {

    //                 displayBlocks.push({
    //                     "type": "section",
    //                     "text": {
    //                         "type": "mrkdwn",
    //                         "text": jsonObj.data[i].description
    //                     }
    //                 });
    //                 displayBlocks.push({
    //                     "type": "section",
    //                     "fields": [{
    //                             "type": "mrkdwn",
    //                             "text": "*Start:*\n" + jsonObj.data[i].start_ts
    //                         },
    //                         {
    //                             "type": "mrkdwn",
    //                             "text": "*Finish:*\n" + jsonObj.data[i].finish_ts
    //                         }
    //                     ]
    //                 });
    //                 displayBlocks.push({
    //                     "type": "actions",
    //                     "elements": [{
    //                             "type": "button",
    //                             "text": {
    //                                 "type": "plain_text",
    //                                 "emoji": true,
    //                                 "text": "Completed"
    //                             },
    //                             "style": "primary",
    //                             "value": "click_me_123"
    //                         },
    //                         {
    //                             "type": "button",
    //                             "text": {
    //                                 "type": "plain_text",
    //                                 "emoji": true,
    //                                 "text": "Modify Finish Date"
    //                             },
    //                             "style": "danger",
    //                             "value": "click_me_123"
    //                         }
    //                     ]
    //                 });
    //             }

    //         } catch (err) {
    //             console.log(err);
    //         }
    //         var payloadSlack = {
    //             "payload": {

    //                 "slack": {
    //                     "attachments": [{
    //                         "blocks": displayBlocks
    //                     }]
    //                 },
    //                 "outputContexts": [{
    //                     "name": "projects/${PROJECT_ID}/agent/sessions/${SESSION_ID}/contexts/myTodos"
    //                 }]
    //             }
    //         };
    //         res.send(payloadSlack);

    //     });
}

function sendTodoNotifications(req, res, next) {
    var displayBlocks = [];
    var prevSlackUserId = '';
    var prevChannelId = '';


    var d = new Date();

    if (!mysqlPool) {
        mysqlPool = mysql.createPool(mysqlConfig);
    }


    mysqlPool.query("SELECT todos.id, todos.description, todos.is_completed, todos.slack_user_id, DATE(todos.modified_finish_ts) as mod_finish_date, DATE(todos.finish_ts) AS finish_date, DATE(todos.start_ts) AS start_date, todos.is_missed_goal, usermap.channel from todos inner join usermap on todos.slack_user_id = usermap.user  WHERE (DATE(todos.start_ts) <= DATE(current_timestamp()) AND (todos.is_completed IS NULL OR  todos.is_completed = 0)) OR (todos.modified_finish_ts is NOT NULL AND todos.modified_finish_ts < current_timestamp() AND (todos.is_completed IS NULL OR todos.is_completed = 0)) ORDER BY todos.slack_user_id", (err, results) => {
        if (err) {
            console.log("Unable to fetch all todos" + " Error: " + err);

            res.status(500).send(err);
        } else {

            var retData = {
                "data": results
            };



            displayBlocks.push({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "*Todo Items - " + d.toLocaleDateString() + "*"
                }
            });
            try {
                for (var i = 0; i < retData.data.length; i++) {

                    if (prevSlackUserId !== '' && prevSlackUserId !== retData.data[i].slack_user_id) {
                        // send slack message
                        if (prevChannelId === '') {
                            sendDirectMessage(displayBlocks, retData.data[i].channel);
                        } else {
                            sendDirectMessage(displayBlocks, prevChannelId);
                        }


                        // reset displayBlocks array 
                        displayBlocks = [];
                        displayBlocks.push({
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": "*Todo Items - " + d.toLocaleDateString() + "*"
                            }
                        });
                    }

                    displayBlocks.push({
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": retData.data[i].description
                        }
                    });
                    displayBlocks.push({
                        "type": "section",
                        "fields": [{
                                "type": "mrkdwn",
                                "text": "*Start:*\n" + retData.data[i].start_date
                            },
                            {
                                "type": "mrkdwn",
                                "text": "*Finish:*\n" + retData.data[i].finish_date
                            }
                        ]
                    });
                    displayBlocks.push({
                        "type": "actions",
                        "elements": [{
                                "type": "button",
                                "text": {
                                    "type": "plain_text",
                                    "emoji": true,
                                    "text": "Completed"
                                },
                                "style": "primary",
                                "value": "click_me_123"
                            },
                            {
                                "type": "button",
                                "text": {
                                    "type": "plain_text",
                                    "emoji": true,
                                    "text": "Modify Finish Date"
                                },
                                "style": "danger",
                                "value": "click_me_123"
                            }
                        ]
                    });

                    if (i === retData.data.length - 1) {
                        // send slack message
                        if (prevChannelId === '') {
                            sendDirectMessage(displayBlocks, retData.data[i].channel);
                        } else {
                            sendDirectMessage(displayBlocks, prevChannelId);
                        }
                    }

                    prevSlackUserId = retData.data[i].slack_user_id;
                    prevChannelId = retData.data[i].channel;
                }
                res.send("Completed Successfully");

            } catch (err) {
                console.log(err);
                res.send("Error occured with sending todo notifications");
            }
        }
    });
}

function mytestHandler(req, res, next) {
    var payloadSlack = {
        "payload": {
            "channel": "CHCPKHXGR",
            "blocks": [{
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "You have a new request:\n*<fakeLink.toEmployeeProfile.com|Fred Enriquez - New device request>*"
                    }
                },
                {
                    "type": "section",
                    "fields": [{
                            "type": "mrkdwn",
                            "text": "*Type:*\nComputer (laptop)"
                        },
                        {
                            "type": "mrkdwn",
                            "text": "*When:*\nSubmitted Aut 10"
                        },
                        {
                            "type": "mrkdwn",
                            "text": "*Last Update:*\nMar 10, 2015 (3 years, 5 months)"
                        },
                        {
                            "type": "mrkdwn",
                            "text": "*Reason:*\nAll vowel keys aren't working."
                        },
                        {
                            "type": "mrkdwn",
                            "text": "*Specs:*\n\"Cheetah Pro 15\" - Fast, really fast\""
                        }
                    ]
                },
                {
                    "type": "actions",
                    "elements": [{
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "emoji": true,
                                "text": "Approve"
                            },
                            "value": "click_me_123"
                        },
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "emoji": true,
                                "text": "Deny"
                            },
                            "value": "click_me_123"
                        }
                    ]
                }
            ]
        }
    };

    res.send(payloadSlack);
}

async function getMyTasks(req, res, next) {


    //console.log("inside getMyTasks");
    //var slackUserId = req.body.originalDetectIntentRequest.payload.data.event.user;
    //getSlackUserEmail(req, res, next);
    //  var userId = req.query.userid;
    //console.log('BEFORE async await');
    let blocks = await asyncsmartSheetsHandler(req, res, next);
    //console.log('after async await');
    var payloadSlack = {
        "payload": {
            "slack": {
                "attachments": [{
                    "blocks": blocks
                }]
            },
            "outputContexts": [{
                "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/smartSheets"
            }]
        }
    };
    //console.log(payloadSlack);
    res.send(payloadSlack);

    //res.send(slackUserData);

    // var slackUser = await getSlackUserName(req);
    // var slackAttachmentArray = [];
    // console.log("slack user from getMyTasks " + slackUser);

    // var jiraAttachmentArray = await getJiraMyTasks(slackUser);
    // if (jiraAttachmentArray.length > 0) {
    //     for (var i = 0; i < jiraAttachmentArray.length; i++) {
    //         slackAttachmentArray.push(jiraAttachmentArray[i]);
    //     }
    // }
    // var smartSheetsArray = await smartSheetsHandler2(slackUser);
    // //console.log(smartSheetsArray);
    // if (smartSheetsArray.length > 0) {
    //     for (var i = 0; i < smartSheetsArray.length; i++) {
    //         slackAttachmentArray.push(smartSheetsArray[i]);
    //     }
    // }


    // payload = {
    //     "payload": {
    //         "slack": {
    //             "text": "My Tasks ...",
    //             "attachments": slackAttachmentArray,
    //         },
    //         "outputContexts": [{
    //             "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/JIRA-MyTasks"
    //         }]
    //     }
    // };
    // res.send(payload);
}

function returnRequestHandler(req, res, next) {
    console.log(req.body);
    // return rp(null) 
    // .then(body => {
    //     var payloadSlack = {
    //         "payload": {
    //             "slack": {
    //                 "text": "ReturnRequest...",
    //                 "attachments": [{
    //                     "text": req.body,
    //                     "fallback": 'ReturnRequest:\n ' + req.body,
    //                     "color": "#3AA3E3",
    //                     "attachment_type": "default",
    //                 }]
    //             },
    //             "outputContexts": [{
    //                 "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/ReturnRequest"
    //             }]
    //         }
    //     };
    //     res.send(payloadSlack);
    // });
    //console.log(payloadSlack);
    //res.send(payloadSlack);
}

// router.get('/processDailyTodos', function (req, res, next) {
//     for (var i = 0; i < dailyTodoMembers.length; i++) {

//         // var jsonData = {
//         //     "responseId": "93ead3fb-cabe-41ee-a0d0-ab6b967de3c0-13076db6",
//         //     "queryResult": {
//         //         "queryText": "create todo",
//         //         "parameters": {},
//         //         "allRequiredParamsPresent": true,
//         //         "fulfillmentMessages": [{
//         //             "text": {
//         //                 "text": [""]
//         //             }
//         //         }],
//         //         "intent": {
//         //             "name": "projects/ffn-chatbot-weather-dev/agent/intents/d3ed328c-9124-421d-a9bf-977dd7290aa4",
//         //             "displayName": "createTodo"
//         //         },
//         //         "intentDetectionConfidence": 1,
//         //         "languageCode": "en"
//         //     },
//         //     "originalDetectIntentRequest": {
//         //         "source": "slack",
//         //         "payload": {
//         //             "data": {
//         //                 "event_id": "EvKXQKG4G7",
//         //                 "event": {
//         //                     "channel": "DEMMAGX7G",
//         //                     "client_msg_id": "014406c2-ab99-4841-ae4c-3634d34fce2b",
//         //                     "event_ts": "1561484421.000600",
//         //                     "user": dailyTodoMembers[i],
//         //                     "type": "message",
//         //                     "text": "create todo",
//         //                     "ts": "1561484421.000600",
//         //                     "channel_type": "im"
//         //                 },
//         //                 "team_id": "T027FCZ7V",
//         //                 "event_time": 1561484421,
//         //                 "type": "event_callback",
//         //                 "api_app_id": "AELDJ7GPP",
//         //                 "token": "CtYJ483Y5fCkK3wJU7NHhYOT",
//         //                 "authed_users": ["UEL4GEXK6"]
//         //             },
//         //             "source": "slack"
//         //         }
//         //     },
//         //     "session":  "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/createTodo"
//         // };
//         var jsonData = {
//             "queryResult": {
//                 "queryText": "create todo",
//                 "parameters": {},
//                 "allRequiredParamsPresent": true,
//                 "fulfillmentMessages": [{
//                     "text": {
//                         "text": [""]
//                     }
//                 }],
//                 "intent": {
//                     "name": "projects/ffn-chatbot-weather-dev/agent/intents/d3ed328c-9124-421d-a9bf-977dd7290aa4",
//                     "displayName": "createTodo"
//                 },
//                 "intentDetectionConfidence": 1,
//                 "languageCode": "en"
//             },
//             "originalDetectIntentRequest": {
//                 "source": "slack",
//                 "payload": {
//                     "data": {
//                         "event_id": "EvKXQKG4G7",
//                         "event": {
//                             "channel": "DEMMAGX7G",
//                             "user": "UDFLSFTL5",
//                             "type": "message",
//                             "text": "create todo",
//                             "ts": "1561484421.000600",
//                             "channel_type": "im"
//                         },
//                         "team_id": "T027FCZ7V",
//                         "type": "event_callback",
//                         "api_app_id": "AELDJ7GPP"
//                     },
//                     "source": "slack"
//                 }
//             }
//         };

//         var options = {
//             method: 'POST',
//             url: 'https://ffn-chatbot-weather-dev.appspot.com/ideas',
//             method: 'POST',
//             body: jsonData,
//             json: true,
//             headers: {
//                 Accept: 'application/json'
//             }
//         };

//         return rp(options)
//             .then(body => {
//                 if (i = )
//                     return true;
//                 // if(i === dailyTodoMembers.length -1) {
//                 //     res.send("successfully called all items");
//                 // }

//                 //var blocks = [];
//                 // blocks.push(addSlackSection("TESTING Probably not working yet....\n\n1. Add your top hightest priority item to complete today.\n\nNOTE: Your item will be due by the end of the day! Franklin will send you a reminder to see if you completed your task at the end of the day and if not give you a chance to move your task to the next day."));

//                 // paylaodSlack = {
//                 //     "payload": {
//                 //         "slack": {
//                 //             "attachments": [{
//                 //                 "blocks": blocks
//                 //             }]
//                 //         },
//                 //         "outputContexts": [{
//                 //             "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/createTodo"
//                 //         }]
//                 //     }
//                 // };
//                 // res.send(paylaodSlack);
//             });
//     }

// });

// function createTodoHandler(req, res, next) {

//     var blocks = [];
//     blocks.push(addSlackSection("TESTING Probably not working yet....\n\n1. Add your top hightest priority item to complete today.\n\nNOTE: Your item will be due by the end of the day! Franklin will send you a reminder to see if you completed your task at the end of the day and if not give you a chance to move your task to the next day."));

//     paylaodSlack = {
//         "payload": {
//             "slack": {
//                 "attachments": [{
//                     "blocks": blocks
//                 }]
//             },
//             "outputContexts": [{
//                 "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/createTodo"
//             }]
//         }
//     };
//     res.send(paylaodSlack);

// }
// router.get('/', function (req, res, next) {
//     res.send('Successfully connected to ideas');
// });

function handleTodoRequestHandler(req, res, next) {
    router.post('/addidea', function (req, res, next) {
        //console.log("addTodo TriggerID: " + req.body.trigger_id);
        var slackDialogUrl = "https://slack.com/api/dialog.open?trigger_id=" + req.body.trigger_id + '&dialog=%7B%22callback_id%22%3A%22ryde-46e2b0%22%2C%22title%22%3A%22Request%20a%20Ride%22%2C%22submit_label%22%3A%22Request%22%2C%22state%22%3A%22Limo%22%2C%22elements%22%3A%5B%7B%22type%22%3A%22text%22%2C%22label%22%3A%22Pickup%20Location%22%2C%22name%22%3A%22loc_origin%22%7D%2C%7B%22type%22%3A%22text%22%2C%22label%22%3A%22Dropoff%20Location%22%2C%22name%22%3A%22loc_destination%22%7D%5D%7D';
        //"&dialog=%7B%22callback_id%22%3A%22ryde-46e2b0%22%2C%22title%22%3A%22Request%20a%20Ride%22%2C%22submit_label%22%3A%22Request%22%2C%22state%22%3A%22Limo%22%2C%22elements%22%3A%5B%7B%22type%22%3A%22text%22%2C%22label%22%3A%22Pickup%20Location%22%2C%22name%22%3A%22loc_origin%22%7D%2C%7B%22type%22%3A%22text%22%2C%22label%22%3A%22Dropoff%20Location%22%2C%22name%22%3A%22loc_destination%22%7D%5D%7D";
        //"dialog=%7B%22callback_id%22%3A%22idea-46e2b0%22%2C%22title%22%3A%22Add%20New%20Idea%22%2C%22submit_label%22%3A%22Submit%22%2C%22notify_on_cancel%22%3Atrue%2C%22state%22%3A%22idea%22%2C%22elements%22%3A%5B%7B%22label%22%3A%22Idea%20Title%22%2C%22name%22%3A%22ideaTitle%22%2C%22type%22%3A%22text%22%2C%22placeholder%22%3A%22Enter%20a%20title%22%7D%2C%7B%22label%22%3A%22Detailed%20Description%22%2C%22name%22%3A%22ideaDescription%22%2C%22type%22%3A%22textarea%22%2C%22max_length%22%3A9999%2C%22hint%22%3A%22Provide%20as%20much%20details%20as%20possible%20for%20your%20idea.%22%7D%5D%7D";

        // var body  = "dialog=%7B%22callback_id%22%3A%22idea-46e2b0%22%2C%22title%22%3A%22Add%20New%20Idea%22%2C%22submit_label%22%3A%22Submit%22%2C%22notify_on_cancel%22%3Atrue%2C%22state%22%3A%22idea%22%2C%22elements%22%3A%5B%7B%22label%22%3A%22Idea%20Title%22%2C%22name%22%3A%22ideaTitle%22%2C%22type%22%3A%22text%22%2C%22placeholder%22%3A%22Enter%20a%20title%22%7D%2C%7B%22label%22%3A%22Detailed%20Description%22%2C%22name%22%3A%22ideaDescription%22%2C%22type%22%3A%22textarea%22%2C%22max_length%22%3A9999%2C%22hint%22%3A%22Provide%20as%20much%20details%20as%20possible%20for%20your%20idea.%22%7D%5D%7D";

        var options = {
            method: 'POST',
            url: slackDialogUrl,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: 'Bearer xoxb-2253441267-496152507652-UyJGCtu8aPAKU5EV63p94TTK'
            }
        };


        //     var options = { method: 'POST',
        //   url: 'https://slack.com/api/dialog.open',
        //   headers: 
        //    { 
        //      'Content-Type': 'application/json',
        //      Authorization: 'Bearer xoxb-2253441267-496152507652-UyJGCtu8aPAKU5EV63p94TTK' },
        //   body: 
        //    { trigger_id: req.body.trigger_id,
        //      dialog: '%7B%22callback_id%22%3A%22idea-46e2b0%22%2C%22title%22%3A%22Add%20New%20Idea%22%2C%22submit_label%22%3A%22Submit%22%2C%22notify_on_cancel%22%3Atrue%2C%22state%22%3A%22idea%22%2C%22elements%22%3A%5B%7B%22label%22%3A%22Idea%20Title%22%2C%22name%22%3A%22ideaTitle%22%2C%22type%22%3A%22text%22%2C%22placeholder%22%3A%22Enter%20a%20title%22%7D%2C%7B%22label%22%3A%22Detailed%20Description%22%2C%22name%22%3A%22ideaDescription%22%2C%22type%22%3A%22textarea%22%2C%22max_length%22%3A9999%2C%22hint%22%3A%22Provide%20as%20much%20details%20as%20possible%20for%20your%20idea.%22%7D%5D%7D' },
        //   json: true };


        // var options = {
        //     method: 'POST',
        //     url: slackDialogUrl,
        //     headers: {
        //         'Content-Type': 'application/json',
        //         'Authorization': 'Bearer ' + req.body.token,
        //         Accept: 'application/json'
        //     }
        // };

        return rp(options)
            .then(body => {
                //console.log('Received from dialog.open call: ' + body);
                // console.log("Post returned: " + body);
                // //res.send("Awesome please add your idea.")
                // var slackResponse = {
                //     "slack": {
                //         "trigger_id": req.body.trigger_id,
                //         "dialog": {
                //             "callback_id": "idea-46e2b0",
                //             "title": "Add New Idea",
                //             "submit_label": "Submit",
                //             "notify_on_cancel": true,
                //             "state": "idea",
                //             "elements": [{
                //                     "label": "Idea Title",
                //                     "name": "ideaTitle",
                //                     "type": "text",
                //                     "placeholder": "Enter a title"
                //                 },
                //                 {
                //                     "label": "Detailed Description",
                //                     "name": "ideaDescription",
                //                     "type": "textarea",
                //                     "max_length": 9999,
                //                     "hint": "Provide as much details as possible for your idea."
                //                 }
                //             ]
                //         }
                //     }
                // };
                res.status(200).send();
                //res.send(slackResponse);
            });

        /*
        
        https://slack.com/api/dialog.open?token=xoxb-such-and-such&trigger_id=13345224609.738474920.8088930838d88f008e0
    dialog=%7B%22callback_id%22%3A%22idea-46e2b0%22%2C%22title%22%3A%22Request%20a%20Ride%22%2C%22submit_label%22%3A%22Request%22%2C%22notify_on_cancel%22%3Atrue%2C%22state%22%3A%22Limo%22%2C%22elements%22%3A%5B%7B%22type%22%3A%22text%22%2C%22label%22%3A%22Pickup%20Location%22%2C%22name%22%3A%22loc_origin%22%7D%2C%7B%22type%22%3A%22text%22%2C%22label%22%3A%22Dropoff%20Location%22%2C%22name%22%3A%22loc_destination%22%7D%5D%7D 
    */

    });
}

function actionExampleHandler(req, res, next) {
    var payloadSlack = {
        "payload": {

            "slack": {
                "attachments": [{
                    "blocks": [{
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": "You have a new request:\n*<fakeLink.toEmployeeProfile.com|Fred Enriquez - New device request>*"
                            }
                        },
                        {
                            "type": "section",
                            "fields": [{
                                    "type": "mrkdwn",
                                    "text": "*Type:*\nComputer (laptop)"
                                },
                                {
                                    "type": "mrkdwn",
                                    "text": "*When:*\nSubmitted Aut 10"
                                },
                                {
                                    "type": "mrkdwn",
                                    "text": "*Last Update:*\nMar 10, 2015 (3 years, 5 months)"
                                },
                                {
                                    "type": "mrkdwn",
                                    "text": "*Reason:*\nAll vowel keys aren't working."
                                },
                                {
                                    "type": "mrkdwn",
                                    "text": "*Specs:*\n\"Cheetah Pro 15\" - Fast, really fast\""
                                }
                            ]
                        },
                        {
                            "type": "actions",
                            "elements": [{
                                    "type": "button",
                                    "text": {
                                        "type": "plain_text",
                                        "emoji": true,
                                        "text": "Approve"
                                    },
                                    "style": "primary",
                                    "value": "click_me_123"
                                },
                                {
                                    "type": "button",
                                    "text": {
                                        "type": "plain_text",
                                        "emoji": true,
                                        "text": "Deny"
                                    },
                                    "style": "danger",
                                    "value": "click_me_123"
                                }
                            ]
                        }
                    ]
                }]
            },
            "outputContexts": [{
                "name": "projects/${PROJECT_ID}/agent/sessions/${SESSION_ID}/contexts/actionExample"
            }]
        }
    };
    res.send(payloadSlack);

}

function todoTestHandler(req, res, next) {
    var payloadSlack = {
        "payload": {
            "slack": {
                "attachments": [{
                    "blocks": [{
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": "To add a new todo item click the button below.",
                            }
                        },
                        {
                            "type": "actions",
                            "elements": [{
                                "type": "button",
                                "text": {
                                    "type": "plain_text",
                                    "emoji": true,
                                    "text": "Add New Todo"
                                },
                                "style": "primary",
                                "value": "clickAddTodo"
                            }]
                        }
                    ]
                }]
            },
            "outputContexts": [{
                "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/todoTest"
            }]
        }
    };
    res.send(payloadSlack);
}

// function createNewTodoHandler(req, res, next) {

//     var blocks = [];
//     blocks.push(addSlackSection("TESTING Probably not working yet....\n\n1. Add your top hightest priority item to complete today.\n\nNOTE: Your item will be due by the end of the day! Franklin will send you a reminder to see if you completed your task at the end of the day and if not give you a chance to move your task to the next day."));

//     paylaodSlack = {
//         "payload": {
//             "slack": {
//                 "attachments": [{
//                     "blocks": blocks
//                 }]
//             },
//             "outputContexts": [{
//                 "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/createNewTodo"
//             }]
//         }
//     };
//     res.send(paylaodSlack);

// }


router.get('/', function (req, res, next) {    
    res.send('Successfully connected to ideas');
});

// function openDialog(payload, api_token, triggerId) {
//     var jsonToken = 'Bearer ' + api_token;
//     var options = {
//         'method': 'post',
//         'headers': {
//             'Authorization': jsonToken
//         },
//         'contentType': 'application/json;charset=utf-8',
//         'payload': JSON.stringify(payload)
//     };
//     var status = UrlFetchApp.fetch('https://slack.com/api/dialog.open?trigger_id=' + triggerId, options);
//     return status;
// }

router.post('/ideadialog', function (req, res, next) {
    var slackDialogUrl = "https://slack.com/api/dialog.open?trigger_id=" + req.body.trigger_id + '&dialog=%7B%22callback_id%22%3A%22idea-46a12ac%22%2C%22title%22%3A%22Add%20Idea%22%2C%22submit_label%22%3A%22Submit%22%2C%22state%22%3A%22Limo%22%2C%22elements%22%3A%5B%7B%22type%22%3A%20%22text%22%2C%22label%22%3A%20%22Title%22%2C%22name%22%3A%20%22idea_title%22%7D%2C%7B%22type%22%3A%20%22textarea%22%2C%22label%22%3A%20%22Description%22%2C%22name%22%3A%20%22idea_description%22%7D%5D%7D';
    var options = {
        method: 'POST',
        url: slackDialogUrl,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: 'Bearer xoxb-2253441267-496152507652-UyJGCtu8aPAKU5EV63p94TTK'
        }
    };
    return rp(options)
        .then(body => {
            addUpdateUserMap(req.body.user_id, req.body.channel_id);
            // if (!mysqlPool) {
            //     mysqlPool = mysql.createPool(mysqlConfig);
            // }
            // mysqlPool.query("CALL addUserMap(?,?)", [req.body.user_id, req.body.channel_id], (err, results) => {
            //     if (err) {
            //         console.log("ERROR GETTING creating usermap: " + err);
            //         res.status(400).send("Geeesh it didn't work there was an error. Check the error log.");
            //     }
            // });

            res.status(200).send();
        });
});

router.post('/addword', function (req, res, next) {
    res.status(200).send();
    addUpdateUserMap(req.body.user_id, req.body.channel_id);
    var triggerId = req.body.trigger_id;
    showDialogAddWord(triggerId);
});

router.post('/reportissue', function (req, res, next) {
    addUpdateUserMap(req.body.user_id, req.body.channel_id);
    //console.log("Request: " + JSON.stringify(req.body));
    // var date = convertUTCDateToLocalDate(new Date());
    // date.toLocaleString();
    // var localTimeNow = date.getHours().toString() + "%3A" + date.get.getMinutes().toString();

    // var clock=new Date().subTime(7, 00);
    // var hours24 = clock.getHours();
    // var minutes = clock.getMinutes();
    // var timeNow = hours24+'%3A'+minutes;
    //console.log("reportIssue TriggerID: " + req.body.trigger_id);
    var slackDialogUrl = "https://slack.com/api/dialog.open?trigger_id=" + req.body.trigger_id + '&dialog=%7B%22callback_id%22%3A%22ops-46e2bc%22%2C%22title%22%3A%22FDR%20System%20Issue%22%2C%22submit_label%22%3A%22Submit%22%2C%22state%22%3A%22Limo%22%2C%22elements%22%3A%5B%7B%22label%22%3A%22*%20System%22%2C%22type%22%3A%22select%22%2C%22name%22%3A%22ops_system%22%2C%22options%22%3A%5B%7B%22label%22%3A%22CAP%22%2C%22value%22%3A%22CAP%22%7D%2C%7B%22label%22%3A%22Docusign%22%2C%22value%22%3A%22Docusign%22%7D%2C%7B%22label%22%3A%22Foxit%20PDF%20%22%2C%22value%22%3A%22Foxit%20PDF%20%22%7D%2C%7B%22label%22%3A%22ICBM%22%2C%22value%22%3A%22ICBM%22%7D%2C%7B%22label%22%3A%22Interaction%20Desktop%20%22%2C%22value%22%3A%22Interaction%20Desktop%20%22%7D%2C%7B%22label%22%3A%22Outlook%22%2C%22value%22%3A%22Outlook%22%7D%2C%7B%22label%22%3A%22QuickBase%22%2C%22value%22%3A%22QuickBase%22%7D%2C%7B%22label%22%3A%22Salesforce%22%2C%22value%22%3A%22Salesforce%22%7D%2C%7B%22label%22%3A%22Sticky%20Notes%20%22%2C%22value%22%3A%22Sticky%20Notes%20%22%7D%2C%7B%22label%22%3A%22Web%20callback%20-%20WCB%20-%20FDR%22%2C%22value%22%3A%22Web%20callback%20-%20WCB%20-%20FDR%22%7D%2C%7B%22label%22%3A%22Other%22%2C%22value%22%3A%22Other%22%7D%5D%7D%2C%7B%22type%22%3A%22text%22%2C%22label%22%3A%22Lead%20ID%22%2C%22name%22%3A%22ops_lead_ids%22%2C%22optional%22%3Atrue%7D%2C%7B%22label%22%3A%22*%20Prevented%20From%20Working%22%2C%22type%22%3A%22select%22%2C%22name%22%3A%22ops_is_p%22%2C%22options%22%3A%5B%7B%22label%22%3A%22Yes%22%2C%22value%22%3A%22Yes%22%7D%2C%7B%22label%22%3A%22No%22%2C%22value%22%3A%22No%22%7D%5D%7D%2C%7B%22label%22%3A%22*%20How%20wide%20is%20the%20impact%3F%22%2C%22type%22%3A%22select%22%2C%22name%22%3A%22ops_impact%22%2C%22options%22%3A%5B%7B%22label%22%3A%22Single%20User%22%2C%22value%22%3A%224%22%7D%2C%7B%22label%22%3A%22Multiuser%22%2C%22value%22%3A%223%22%7D%2C%7B%22label%22%3A%22Department%22%2C%22value%22%3A%222%22%7D%5D%7D%2C%7B%22type%22%3A%22textarea%22%2C%22label%22%3A%22*%20Specific%20Error%20Message%20or%20System%20Issue%22%2C%22name%22%3A%22ops_error%22%7D%2C%7B%22type%22%3A%22textarea%22%2C%22label%22%3A%22*%20Description%20of%20Issue%22%2C%22name%22%3A%22ops_description%22%7D%5D%7D';


    var options = {
        method: 'POST',
        url: slackDialogUrl,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: 'Bearer xoxb-2253441267-496152507652-UyJGCtu8aPAKU5EV63p94TTK'
        }
    };
    return rp(options)
        .then(body => {
            if (!mysqlPool) {
                mysqlPool = mysql.createPool(mysqlConfig);
            }
            mysqlPool.query("CALL addUserMap(?,?)", [req.body.user_id, req.body.channel_id], (err, results) => {
                if (err) {
                    console.log("ERROR GETTING creating usermap: " + err);
                    res.status(400).send("Geeesh it didn't work there was an error. Check the error log.");
                }
            });

            res.status(200).send();
        });
});

// used for testing purposes only new functionality. 
// router.post('/getProjData', function (req, res, next) {
//     //req.setTimeout(30000);
//     //snowKnowledgeSearch(req, res, next);
//     //newjiraSpecProjHandler(req, res, next);s
//     //jiraMyTasksHandler(req, res, next);
//     //returnRequestHandler(req.res,next);
//     //jiraMyTasksHandler(req, res, next);
//     //mathFactsHandler(req,res,next);
//     //stockQuoteHandler(req,res,next);
//     //newjiraSpecProjHandler(req, res, next);
//     //testGetAllJiraProjects(req, res, next);
//     //jiraSearchITProj(req, res, next);
//     //snowKnowledgeSearch(req,res,next);
//     //getAllTimesForEachCity(req,res,next);
//     //useSnowKnowledgeSearch(req,res,next);
//     //calculateGrossIncome(req,res,next);
//     // var intentName = req.body.queryResult.intent.displayName;
//     // var retResults = logRequests(req.body.queryResult.queryText,req.body.originalDetectIntentRequest.payload.data.event.user,req.body.originalDetectIntentRequest.payload.data.event.ts,intentName);

//     // if(retResults)
//     //     res.send("recorded analytics");
//     // else
//     //     res.send("Failed to log. Check error log");
//     //smartSheetsHandler(req, res, next);
//     //getMyTasks(req, res, next);
//     //jiraMyTasksHandler(req, res, next);
//     // ofcourse().then(function (result) {
//     //     res.send(result);
//     // });

//     //smartSheetsHandler(req, res, next);
//     // var slackUserId = req.query.userid;
//     // smartSheetsHandler2(slackUserId, res);
//     // if (attachmentArray.length() > 0) {
//     //     req.send({
//     //         "data": attachmentArray
//     //     });
//     // } else {
//     //     req.send("Nothing found");
//     // }
//     //addNewIdeaWithName(req, res, next)
//     //getMyTasks(req, res, next)
//     //sportsScoreCardHandler(req,res,next);
//     //jiraSearchITProj(req, res, next);
//     //whoIsLookupHandler(req, res, next);
//     //directMessage(req, res, next);


// });


// //used for testing purposes only new functionality. 
// router.get('/getProjData', function (req, res, next) {
//     //snowKnowledgeSearch(req, res, next);
//     //newjiraSpecProjHandler(req, res, next);
//     //jiraMyTasksHandler(req, res, next);
//     //jiraGetIdeasHandler(req,res,next);
//     //mathFactsHandler(req, res, next);
//     //testGetAllJiraProjects(req, res, next);
//     sportsScoreCardHandler(req,res,next);
// });

router.post('/gdriverequestold', function (req, res, next) {
    //logGoogleDriveRequest(req, res, next);

    var isFormData = false;

    var retErrors = '';

    if (req.body.drive_name === undefined) {
        retErrors = retErrors + 'it is true drive_name is undefined';
    }

    if (req.body.share_outside_ffn === undefined) {
        retErrors = retErrors + '\nit is true share_outside_ffn is undefined';
    }
    if (retErrors.length > 2) {
        res.status(400).send(retErrors);
    }

    createGoogleDriveRequest(req.body.drive_name, req.body.share_outside_ffn, req.body.share_non_members, req.body.download_copy_print,
        req.body.shared_with_teams,
        req.body.contact, res);

});

router.post('/gdriverequest', function (req, res, next) {
    var jsonHeader = JSON.stringify(req.headers);
    var jsonBody = JSON.stringify(req.body);
    var retErrors = "";
    logGoogleDriveRequest(jsonHeader, jsonBody, "AT Start of POST Call: ");
    try {
        if (req.body.formData.se_text_short_1_5OmTsjSFo === undefined) {
            retErrors = retErrors + "1. it is true drive_name is undefined";
        }

        if (req.body.formData.se_choice_single_1_AQS3IbdC1 === undefined) {
            retErrors = retErrors + " 2. it is true se_text_short_1_5OmTsjSFo is undefined";
        }

        logGoogleDriveRequest(jsonHeader, jsonBody, retErrors);
        if (retErrors.length > 2) {
            res.status(400).send(retErrors);
        }
    } catch (err) {
        console.log(err);
        retErrors = retErrors + "1. it is true drive_name is undefined";
        retErrors = retErrors + " 2. it is true se_text_short_1_5OmTsjSFo is undefined";
        logGoogleDriveRequest(jsonHeader, jsonBody, retErrors + " Err: " + err);
        res.status(400).send(retErrors + " Error: " + err);
    }


    createGoogleDriveRequest(req.body.formData.se_text_short_1_5OmTsjSFo, req.body.formData.se_choice_single_1_AQS3IbdC1, req.body.formData.se_choice_single_1_e4ahR1yAi, req.body.formData.se_choice_single_1_boeFd0SV5,
        req.body.formData.se_text_short_1_1G4e7Ni0j,
        req.body.formData.se_text_short_1_AAQSikCET, res);

});

router.get('/alllogdata', function (req, res, next) {
    if (!mysqlPool) {
        mysqlPool = mysql.createPool(mysqlConfig);
    }

    mysqlPool.query("select log.id, log.ts, log.intent, log.function, log.user,  slackusers.fullname, log.is_resolved, log.ts_resolved, log.notes, log.error from log inner join slackusers on slackusers.userid = log.user", (err, results) => {
        if (err) {
            console.log("ERROR GETTING log data: " + err);
            res.status(400).send("Geeesh it didn't work there was an error. Check the error log.");
        } else {
            var retData = {
                "data": results
            }

            res.send(retData);
        }
    });
});

router.get('/logdata', function (req, res, next) {
    if (!mysqlPool) {
        mysqlPool = mysql.createPool(mysqlConfig);
    }

    mysqlPool.query("SELECT log.id, log.ts, log.intent, log.function, log.user,  slackusers.fullname, log.is_resolved, log.ts_resolved, log.notes, log.error FROM log inner join slackusers on slackusers.userid = log.user WHERE ts >= '" + req.query.fromdate + "' AND ts <= '" + req.query.todate + "'", (err, results) => {
        if (err) {
            console.log("ERROR GETTING log data: " + err);
            res.status(400).send("Geeesh it didn't work there was an error. Check the error log.\n" + err);
        } else {
            var retData = {
                "data": results
            }

            res.send(retData);
        }
    });
});


router.get('/newfranklinlog', function (req, res, next) {
    
    if (!mysqlPool) {
        mysqlPool = mysql.createPool(mysqlConfig);
    }

    mysqlPool.query("SELECT * FROM log WHERE is_resolved IS NULL", (err, results) => {
        if (err) {
            console.log("ERROR GETTING log information: " + err);
            res.status(400).send("Geeesh it didn't work there was an error. Check the error log.");
        } else {
            var retData = {
                "data": results
            }

            res.send(retData);
        }
    });
});

router.get('/fixedfranklinlog', function (req, res, next) {
    if (!mysqlPool) {
        mysqlPool = mysql.createPool(mysqlConfig);
    }

    mysqlPool.query("SELECT * FROM log WHERE is_resolved = 1", (err, results) => {
        if (err) {
            console.log("ERROR GETTING log information: " + err);
            res.status(400).send("Geeesh it didn't work there was an error. Check the error log.");
        } else {
            var retData = {
                "data": results
            }

            res.send(retData);
        }
    });
});

router.put('/franklinlog', function (req, res, next) {
    if (!mysqlPool) {
        mysqlPool = mysql.createPool(mysqlConfig);
    }
    var notes = req.body.notes;
    var id = req.body.id;


    mysqlPool.query("UPDATE log SET is_resolved = 1, ts_resolved=current_timestamp(), notes=? WHERE id=?", [notes, id], (err, results) => {
        if (err) {
            console.log("ERROR updating log: " + err);
            res.status(400).send("Geeesh it didn't work to update the log. Check the error log.");
        } else {
            var retData = {
                "data": results
            }

            res.send(retData);
        }
    });
});


router.post('/opscomupdate', function (req, res, next) {
    if (!mysqlPool) {
        mysqlPool = mysql.createPool(mysqlConfig);
    }
    //console.log("opscomupdate rec: " + JSON.stringify(req.body));

    var notes = req.body.notes;
    var id = req.body.id;
    var isClosed = req.body.status;
    var assignee = req.body.assignee;
    var assigneeSlackId = '';
    if (assignee !== undefined) {
        switch (assignee) {
            case "Patrick Kessel":
                assigneeSlackId = 'UF1QB639A';
                break;
            case "Sam Saad":
                assigneeSlackId = 'U32EKTZ9Q';
                break;
            case "Jessica Arevalo":
                assigneeSlackId = 'U979RJ6JV';
                break;
            case "Dayton Beck":
                assigneeSlackId = 'UG9DZP7QQ';
                break;
            default:
                assignee = null;
                assigneeSlackId = null;
                break;
        }
    }

    if (isClosed === "0" || isClosed === "2") {
        mysqlPool.query("UPDATE ops_comm SET assignee_name=?, assigned_slack_id=?, is_resolved=?, mod_on=current_timestamp(), notes=? WHERE id=?", [assignee, assigneeSlackId, isClosed, notes, id], (err, results) => {
            if (err) {
                console.log("ERROR updating ops_comm: " + err);

            } else {
                var retData = {
                    "data": results
                }

                if (retData.data.affectedRows === 1) {


                    res.send('Successfully updated!<br><br><a href="https://storage.googleapis.com/ffn-images/img/index.html">Return to open items</a>');
                }
            }
        });
    } else if (isClosed === "1") {
        mysqlPool.query("UPDATE ops_comm SET assignee_name=?, assigned_slack_id=?, is_resolved=?, mod_on=current_timestamp(), closed_on=current_timestamp(), notes=? WHERE id=?", [assignee, assigneeSlackId, isClosed, notes, id], (err, results) => {
            if (err) {
                console.log("ERROR updating ops_comm: " + err);

            } else {
                var retData = {
                    "data": results
                }

                if (retData.data.affectedRows === 1) {

                    res.send('Successfully updated!<br><br><a href="https://storage.googleapis.com/ffn-images/img/index.html">Return to open items</a>');
                }
            }
        });
    }
});



router.get('/getDriveRequests', function (req, res, next) {

    getGoogleDriveRequest(req, res, next);

});

router.get('/getDriveLog', function (req, res, next) {

    getGoogleLog(req, res, next);

});

router.get('/getSlackUserInfo', function (req, res, next) {

    var slackUserId = req.query.userid;
    if (slackUserId !== undefined && slackUserId !== null) {
        if (!mysqlPool) {
            mysqlPool = mysql.createPool(mysqlConfig);
        }

        mysqlPool.query("SELECT username,userid, fullname, email, status, `billing-active`, `okta_group` FROM slackusers WHERE userid='" + slackUserId + "'", (err, results) => {
            if (err) {
                console.log("GET Slack Email Error" + err);

                res.status(500).send(err);
            } else {

                var retData = {
                    "data": results[0]
                };

                res.send(retData);

                //res.send(JSON.stringify(results));
            }
        });
    } else {
        res.send("user not found");
    }

});

router.get('/todosByUser', function (req, res, next) {

    if (!mysqlPool) {
        mysqlPool = mysql.createPool(mysqlConfig);
    }

    var slackUserId = req.query.slackUserId;
    if (slackUserId !== '' || slackUserId !== undefined) {

        mysqlPool.query("SELECT todos.id, todos.description, todos.is_completed, todos.slack_user_id, todos.modified_finish_ts, todos.finish_ts, todos.start_ts, todos.is_missed_goal, usermap.channel from todos inner join usermap on todos.slack_user_id = usermap.user  WHERE (todos.finish_ts < current_timestamp() AND (todos.is_completed IS NULL OR  todos.is_completed = 0)) OR (todos.modified_finish_ts is NOT NULL AND todos.modified_finish_ts < current_timestamp() AND (todos.is_completed IS NULL OR todos.is_completed = 0)) AND todos.slack_user_id='" + slackUserId + "'", (err, results) => {
            if (err) {
                console.log("Unable to fetch todos for user: " + slackUserId + " Error: " + err);

                res.status(500).send(err);
            } else {

                var retData = {
                    "data": results
                };

                res.send(retData);
            }
        });
    } else {
        res.send("Missing slackUserId");
    }

});

router.get('/todos', function (req, res, next) {

    if (!mysqlPool) {
        mysqlPool = mysql.createPool(mysqlConfig);
    }

    mysqlPool.query("SELECT * from todos WHERE (DATE(start_ts) <= DATE(current_timestamp()) AND (is_completed IS NULL OR  is_completed = 0)) OR (modified_finish_ts is NOT NULL AND modified_finish_ts < current_timestamp() AND (is_completed IS NULL OR is_completed = 0))", (err, results) => {
        if (err) {
            console.log("Unable to get all incomplete todos: " + slackUserId + " Error: " + err);

            res.status(500).send(err);
        } else {

            var retData = {
                "data": results
            };

            res.send(retData);

            //res.send(JSON.stringify(results));
        }
    });

});


router.post('/processTodoStart', function (req, res, next) {
    askUsersPlanToday(req, res, next);
});

router.post('/createTodo', function (req, res, next) {

    var slackUserId = req.body.userid;
    var description = req.body.description;
    var finishTs = req.body.finish;

    if (slackUserId !== undefined && slackUserId !== null && description !== undefined && description !== null && finishTs !== undefined && finishTs !== null) {
        if (!mysqlPool) {
            mysqlPool = mysql.createPool(mysqlConfig);
        }

        mysqlPool.query("INSERT into todos (description, slack_user_id,finish_ts) VALUES('" + description + "','" + slackUserId + "','" + finishTs + "')", (err, results) => {
            if (err) {
                console.log("Unable to create todo for user: " + slackUserId + " Error: " + err);

                res.status(500).send(err);
            } else {

                var retData = {
                    "data": results[0]
                };

                res.send(retData);
            }
        });
    } else {
        res.send("Missing data required to create todo item for user. " + slackUserId);
    }
});

router.put('/completeTodo', function (req, res, next) {
    var id = req.query.id;
    var slackUserId = req.query.userid;

    if (slackUserId !== undefined && slackUserId !== null && id !== undefined && id !== null) {
        if (!mysqlPool) {
            mysqlPool = mysql.createPool(mysqlConfig);
        }

        mysqlPool.query("UPDATE  todos SET is_completed=1, actual_finish_ts=current_timestamp() where id=" + id + " AND slack_user_id='" + slackUserId + "'", (err, results) => {
            if (err) {
                console.log("Unable to mark todo completed: " + slackUserId + " Error: " + err);

                res.status(500).send(err);
            } else {

                var retData = {
                    "data": results[0]
                };

                res.send(retData);
            }
        });
    } else {
        res.send("Missing data for marking todo item complete.");
    }
});


router.put('/incompletedTodo', function (req, res, next) {
    var id = req.query.id;
    var slackUserId = req.query.userid;
    var newFinishTimeStamp = req.query.newFinishTimeStamp;

    if (id !== undefined && id !== null && slackUserId !== undefined && slackUserId !== null && newFinishTimeStamp !== undefined && newFinishTimeStamp !== null) {
        if (!mysqlPool) {
            mysqlPool = mysql.createPool(mysqlConfig);
        }

        mysqlPool.query("UPDATE todos SET is_completed=0, is_missed_goal=1, modified_finish_ts = '" + newFinishTimeStamp + "'  where id=" + id + " AND slack_user_id='" + slackUserId + "'", (err, results) => {
            if (err) {
                console.log("Unable to mark todo completed: " + slackUserId + " Error: " + err);

                res.status(500).send(err);
            } else {

                var retData = {
                    "data": results[0]
                };

                res.send(retData);
            }
        });
    } else {
        res.send("Missing data for marking todo item incomplete.");
    }
});

router.post('/send-user-message', function (req, res, next) {

    directMessage(req, res, next);
});

router.post('/send-todo-notifications', function (req, res, next) {
    sendTodoNotifications(req, res, next);
});

router.post('/ffn-action', function (req, res, next) {
    console.log(req.body);
    //return req.body;
    // if (req.body.callback_id !== null) {
    //     return req.body;
    // } else {
    //}
});

router.get('/opencomitems', function (req, res, next) {
    if (!mysqlPool) {
        mysqlPool = mysql.createPool(mysqlConfig);
    }
    mysqlPool.query('SELECT * FROM ops_comm WHERE is_resolved=0 OR is_resolved=2 order by created_on desc', (err, results) => {
        if (err) {
            console.log("Error on fetching data");
            res.send("Error on fetching data");
        } else {
            //console.log("dbResults: " + results);
            var retResults = {
                "data": results
            };
            res.send(retResults);
        }
    });
});

router.get('/closedcomitems', function (req, res, next) {
    if (!mysqlPool) {
        mysqlPool = mysql.createPool(mysqlConfig);
    }
    mysqlPool.query('SELECT * FROM ops_comm WHERE is_resolved=1 order by closed_on asc', (err, results) => {
        if (err) {
            console.log("Error on fetching data");
            res.send("Error on fetching data");
        } else {
            //console.log("dbResults: " + results);
            var retResults = {
                "data": results
            };
            res.send(retResults);
        }
    });
});


router.post('/slack-action', function (req, res, next) {

    var displayBlocks = [];
    var snowBlocks = [];
    var actionJSONPayload;

    console.log("req action: " + req.body.payload);
    try {
        actionJSONPayload = JSON.parse(req.body.payload);

    } catch (err) {
        console.log("Got err: " + err);
        //console.log("req body only: " + JSON.stringify(actionJSONPayload));
        actionJSONPayload = JSON.parse(req.body);
    }

    let slackUserId = actionJSONPayload.user.id;



    var urlResponse = actionJSONPayload.response_url !== undefined ? actionJSONPayload.response_url : "";
    let response_body;
    var dcName = '';
    var teamLead = '';
    res.status(200).send();

    if (actionJSONPayload.callback_id !== undefined && actionJSONPayload.callback_id === "ops-46e2bc") {

        var is_prevented_working = actionJSONPayload.submission.ops_is_p === "Yes" ? 1 : 0;
        var is_prevented_work_str = actionJSONPayload.submission.ops_is_p === "Yes" ? actionJSONPayload.submission.ops_system + " Error: Unable to work" : actionJSONPayload.submission.ops_system + " Issue: Able to work";
        var leadId = actionJSONPayload.submission.ops_lead_ids !== undefined ? actionJSONPayload.submission.ops_lead_ids : '';
        var ticketSysId = '';
        var ticketNumber = '';



        var tryUserName = '';

        try {
            logRequests("/ops_comm system:" + actionJSONPayload.submission.ops_system, slackUserId, actionJSONPayload.action_ts, "/ops_comm", actionJSONPayload.channel.id);
        } catch (logError) {
            console.log("error saving slash command ops_comm: " + logError);
        }

        var options = {
            method: 'GET',
            url: 'https://ffn-chatbot-weather-dev.appspot.com/ideas/getSlackUserInfo',
            qs: {
                userid: slackUserId
            },
            headers: {
                Host: 'ffn-chatbot-weather-dev.appspot.com',
                Accept: 'applicaiton/json'
            }
        };

        return rp(options)
            .then(body => {

                var slackUserData = JSON.parse(body);
                if (slackUserData.data.email !== undefined) {
                    var splitName = slackUserData.data.email.split("@");
                    tryUserName = splitName[0];
                } else {
                    tryUserName = '';
                }

                var optionsSnowUser = {
                    method: 'GET',
                    url: 'https://freedomfinancialnetworkdev.service-now.com/api/now/table/sys_user',
                    qs: {
                        sysparm_query: 'user_name=' + tryUserName
                    },
                    headers: {
                        Accept: 'application/json',
                        Authorization: 'Basic SVRCdXNpbmVzc1N5c3RlbXM6ZjdBYzhsbTFkdXo5'
                    }
                };
                return rp(optionsSnowUser)
                    .then(body => {
                        var jsonObj = JSON.parse(body);
                        dcName = jsonObj.result[0].name;

                        var optionsManager = {
                            method: 'GET',
                            url: 'https://freedomfinancialnetworkdev.service-now.com/api/now/table/sys_user/' + jsonObj.result[0].manager.value,
                            headers: {
                                Accept: 'application/json',
                                Authorization: 'Basic SVRCdXNpbmVzc1N5c3RlbXM6ZjdBYzhsbTFkdXo5'
                            }
                        };

                        return rp(optionsManager)
                            .then(body => {
                                var jsonMgrObj = JSON.parse(body);

                                teamLead = jsonMgrObj.result.name;

                                var optionsSnowUser = {
                                    method: 'GET',
                                    url: 'https://freedomfinancialnetworkdev.service-now.com/api/now/table/sys_user',
                                    qs: {
                                        sysparm_query: 'user_name=' + tryUserName
                                    },
                                    headers: {
                                        Accept: 'application/json',
                                        Authorization: 'Basic SVRCdXNpbmVzc1N5c3RlbXM6ZjdBYzhsbTFkdXo5'
                                    }
                                };


                                return rp(optionsSnowUser)
                                    .then(body => {

                                        var jsonObj = JSON.parse(body);
                                        var snowSysId = jsonObj.result[0].sys_id;
                                        var locationId = jsonObj.result[0].location.value;
                                        var snowExtension = jsonObj.result[0].u_extension;

                                        var createRequestOptions = {
                                            method: 'POST',
                                            url: 'https://freedomfinancialnetworkdev.service-now.com/api/sn_sc/v1/servicecatalog/items/1c7de5b0db44d740244ff1fcbf9619e6/submit_producer',
                                            headers: {
                                                Accept: 'application/json',
                                                Authorization: 'Basic SVRCdXNpbmVzc1N5c3RlbXM6ZjdBYzhsbTFkdXo5'
                                            },
                                            body: {
                                                variables: {
                                                    caller: snowSysId,
                                                    opened_by: snowSysId,
                                                    how_impacts: is_prevented_work_str,
                                                    description: actionJSONPayload.submission.ops_description,
                                                    location: locationId,
                                                    u_impact: actionJSONPayload.submission.ops_impact,
                                                    new_call_requester_variables: 'true',
                                                    contact_number: snowExtension
                                                },
                                                sysparm_item_guid: 'efef49da1b4cc4d064b1a9ffbd4bcb18',
                                                get_portal_messages: 'true',
                                                sysparm_no_validation: 'true'
                                            },
                                            json: true
                                        };
                                        return rp(createRequestOptions)
                                            .then(resultsOfCreateTicket => {
                                                ticketSysId = resultsOfCreateTicket.result.sys_id;
                                                ticketNumber = resultsOfCreateTicket.result.number;

                                                if (!mysqlPool) {
                                                    mysqlPool = mysql.createPool(mysqlConfig);
                                                }


                                                mysqlPool.query('INSERT into ops_comm (slack_id,system,lead_id,team_leads,dcs,is_work_stoppage,error,description,is_channel_notified, snow_impact,snow_sys_id,snow_id) VALUES ("' + actionJSONPayload.user.id + '","' + actionJSONPayload.submission.ops_system + '","' + leadId + '","' +
                                                    teamLead + '","' +
                                                    dcName + '",' +
                                                    is_prevented_working + ',"' + actionJSONPayload.submission.ops_error + '","' + actionJSONPayload.submission.ops_description + '",1,' + actionJSONPayload.submission.ops_impact + ',"' + ticketSysId + '","' + ticketNumber + '")', (err, results) => {
                                                        if (err) {
                                                            console.log("Error Writing to ops_comm db: " + err);
                                                            //res.status(500).send(err);
                                                        } else {
                                                            //console.log("dbResults: " + results);
                                                            //retSuccess = true;
                                                            //res.send(JSON.stringify(results));
                                                            //res.status(200).send();
                                                        }
                                                    });

                                                displayBlocks.push({
                                                    "type": "section",
                                                    "text": {
                                                        "type": "mrkdwn",
                                                        "text": "*New Issue*"
                                                    }
                                                });


                                                displayBlocks.push({
                                                    "type": "section",
                                                    "fields": [{
                                                            "type": "mrkdwn",
                                                            "text": "*DC*\n" + dcName
                                                        },
                                                        {
                                                            "type": "mrkdwn",
                                                            "text": "*Team Lead*\n" + teamLead
                                                        },
                                                        {
                                                            "type": "mrkdwn",
                                                            "text": "*System*\n" + actionJSONPayload.submission.ops_system
                                                        },
                                                        {
                                                            "type": "mrkdwn",
                                                            "text": "*Error*\n" + actionJSONPayload.submission.ops_error.trimEllip(50)
                                                        },
                                                        {
                                                            "type": "mrkdwn",
                                                            "text": "*Description*\n" + actionJSONPayload.submission.ops_description.trimEllip(80)
                                                        },
                                                        {
                                                            "type": "mrkdwn",
                                                            "text": "*Assigned To*\nUnassigned"
                                                        },
                                                        {
                                                            "type": "mrkdwn",
                                                            "text": "*ServiceNow Ticket ID*\n" + ticketNumber
                                                        }
                                                    ]
                                                });

                                                displayBlocks.push({
                                                    "type": "actions",
                                                    "elements": [{
                                                        "type": "button",
                                                        "text": {
                                                            "type": "plain_text",
                                                            "emoji": true,
                                                            "text": "View Open Issues"
                                                        },
                                                        "url": "https://storage.googleapis.com/ffn-images/img/index.html",
                                                        "style": "primary",
                                                        "value": "click_view_open_issues"
                                                    }]
                                                });
                                                // // post to channel this fdr-sales-intake this request. 
                                                sendOpsChannelMessage(displayBlocks, 'GM7F9UDBQ');

                                                if (!mysqlPool) {
                                                    mysqlPool = mysql.createPool(mysqlConfig);
                                                }
                                                var usersChannel = '';

                                                mysqlPool.query("select * from usermap where user='" + slackUserId + "'", (err, results) => {
                                                    if (err) {
                                                        console.log("Error getting usermap channel: " + err);
                                                        //res.status(500).send(err);
                                                    }
                                                    var dbResult = {
                                                        "data": results
                                                    };
                                                    usersChannel = dbResult.data[0].channel;
                                                });



                                                snowBlocks.push({
                                                    "type": "section",
                                                    "text": {
                                                        "type": "mrkdwn",
                                                        "text": "*Created Ticket*"
                                                    }
                                                });

                                                snowBlocks.push({
                                                    "type": "section",
                                                    "fields": [{
                                                            "type": "mrkdwn",
                                                            "text": "*System*\n" + actionJSONPayload.submission.ops_system
                                                        },
                                                        {
                                                            "type": "mrkdwn",
                                                            "text": "*Error*\n" + actionJSONPayload.submission.ops_error.trimEllip(50)
                                                        },
                                                        {
                                                            "type": "mrkdwn",
                                                            "text": "*Description*\n" + actionJSONPayload.submission.ops_description.trimEllip(80)
                                                        },
                                                        {
                                                            "type": "mrkdwn",
                                                            "text": "*ServiceNow ID*\n" + ticketNumber
                                                        }
                                                    ]
                                                });


                                                // send user a message letting them know a service now request was generated. 
                                                notifiyUserSnowRequestMessage(snowBlocks, slackUserId);


                                            });
                                    })
                                    .catch(function (err) {
                                        console.log("what erorr occured" + err);
                                        if (!mysqlPool) {
                                            mysqlPool = mysql.createPool(mysqlConfig);
                                        }
                                        teamLead = '';
                                        // ops_impact = 2 Dept, 3, multiuser, 4 single user 
                                        mysqlPool.query('INSERT into ops_comm (slack_id,system,team_leads,dcs,is_work_stoppage,error,description,snow_impact,snow_sys_id,snow_id) VALUES ("' + actionJSONPayload.user.id + '","' + actionJSONPayload.submission.ops_system + '","' +
                                            teamLead + '","' +
                                            dcName + '",' +
                                            is_prevented_working + ',"' + actionJSONPayload.submission.ops_error + '","' + actionJSONPayload.submission.ops_description + '",' + actionJSONPayload.submission.ops_impact + ',"' + ticketSysId + '","' + ticketNumber + '")', (err, results) => {
                                                if (err) {
                                                    console.log("Error Writing to ops_comm db: " + err);
                                                    //res.status(500).send(err);
                                                } else {
                                                    //console.log("dbResults: " + results);
                                                    //retSuccess = true;
                                                    //res.send(JSON.stringify(results));
                                                    //res.status(200).send();
                                                }
                                            });
                                    });

                                // if (!mysqlPool) {
                                //     mysqlPool = mysql.createPool(mysqlConfig);
                                // }

                                // mysqlPool.query("UPDATE ops_comm SET snow_sys_id=?, snow_id=?, is_resolved=?, mod_on=current_timestamp(), notes=? WHERE id=?", [assignee, assigneeSlackId, isClosed, notes, id], (err, results) => {
                                //     if (err) {
                                //         console.log("ERROR updating ops_comm: " + err);

                                //     } else {
                                //         var retData = {
                                //             "data": results
                                //         }

                                //         if (retData.data.affectedRows === 1) {


                                //             res.send('Successfully updated!<br><br><a href="https://storage.googleapis.com/ffn-images/img/index.html">Return to open items</a>');
                                //         }
                                //     }
                                // });

                            });
                    });
            });
    } else if (actionJSONPayload.view !== undefined && actionJSONPayload.view.callback_id !== undefined && actionJSONPayload.view.callback_id === "addtodox9ml") {

        // save to the database the new todo item. 
        var title = actionJSONPayload.view.state.values.tsk_title.title.value;
        var description = actionJSONPayload.view.state.values.tsk_desc.description.value;
        var startDate = actionJSONPayload.view.state.values.tsk_start.start.selected_date;
        var finishDate = actionJSONPayload.view.state.values.tsk_finish.finish.selected_date;

        try {
            var dmilliseconds = Date.now().toString();
            logRequests("added todo: " + title, slackUserId, dmilliseconds, "added todo", '');
        } catch (logError) {
            console.log("error saving slash command addtodo: " + logError);
        }

        if (!mysqlPool) {
            mysqlPool = mysql.createPool(mysqlConfig);
        }

        mysqlPool.query('INSERT INTO todos (title, plan_start, plan_finish, slack_user_id, description) VALUES ("' + title + '","' + startDate + '","' + finishDate + '","' +
            slackUserId + '","' +
            description + '")', (err, results) => {
                if (err) {
                    console.log("Error Writing to todos db: " + err);
                    //res.status(500).send(err);
                } else {
                    //console.log("dbResults: " + results);
                    //retSuccess = true;
                    //res.send(JSON.stringify(results));
                    //res.status(200).send();
                }
            });
        res.status(200).send();

        // TODO add response that the todo item was added.


    } else if (actionJSONPayload.callback_id !== undefined && actionJSONPayload.callback_id === "newwordjack") {

        var dictWord = actionJSONPayload.submission.dict_word;
        var dictKeyWords = actionJSONPayload.submission.dict_key_words;
        var dictDefinition = actionJSONPayload.submission.dict_def;

        try {
            logRequests("/addword: " + dictWord, slackUserId, actionJSONPayload.action_ts, "/addword", actionJSONPayload.channel.id);
        } catch (logError) {
            console.log("error saving slash command addword: " + logError);
        }

        if (!mysqlPool) {
            mysqlPool = mysql.createPool(mysqlConfig);
        }

        mysqlPool.query('INSERT into ffn_dictionary (word, key_words, definition, added_by) VALUES ("' + dictWord + '","' + dictKeyWords + '","' + dictDefinition + '","' +
            slackUserId + '")', (err, results) => {
                if (err) {
                    console.log("Error Writing to ffn_dictionary db: " + err);
                    if (err.toString().includes("ER_DUP_ENTRY")) {

                        var payloadSlack = {
                            "blocks": [{
                                    "type": "section",
                                    "text": {
                                        "type": "mrkdwn",
                                        "text": "*FFN Dictionary*\nThe word *" + dictWord + "* already exists...\n\nTo view just type: *define: " + dictWord + "*"
                                    }
                                },
                                {
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
                                }
                            ]
                        };

                        var options = {
                            method: 'POST',
                            url: urlResponse,
                            headers: {
                                Accept: 'application/json',
                                Authorization: 'Bearer xoxb-2253441267-496152507652-UyJGCtu8aPAKU5EV63p94TTK'
                            },
                            body: JSON.stringify(payloadSlack)
                        };
                        return rp(options)
                            .then(body => {
                                var jsonData = JSON.parse(body);
                            });

                    }
                } else {
                    //console.log("dbResults: " + results);
                    //retSuccess = true;
                    //res.send(JSON.stringify(results));
                    //res.status(200).send();

                    var payloadSlack = {
                        "blocks": [{
                                "type": "section",
                                "text": {
                                    "type": "mrkdwn",
                                    "text": "*FFN Dictionary*\nYour word *" + dictWord + "* was added."
                                }
                            },
                            {
                                "type": "section",
                                "fields": [{
                                    "type": "mrkdwn",
                                    "text": "*Definition*\n" + dictDefinition
                                }]
                            },
                            {
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
                            }
                        ]
                    };

                    var options = {
                        method: 'POST',
                        url: urlResponse,
                        headers: {
                            Accept: 'application/json',
                            Authorization: 'Bearer xoxb-2253441267-496152507652-UyJGCtu8aPAKU5EV63p94TTK'
                        },
                        body: JSON.stringify(payloadSlack)
                    };
                    return rp(options)
                        .then(body => {
                            var jsonData = JSON.parse(body);
                        });

                }
            });

    } else if (actionJSONPayload.callback_id !== undefined && actionJSONPayload.callback_id === "idea-46a12ac") {
        var ideaTitle = actionJSONPayload.submission.idea_title;
        var ideaDescription = actionJSONPayload.submission.idea_description;

        var jiraKey = '';
        var jiraUrl = '';

        var slackFullName = '';

        try {
            logRequests("/idea t:" + ideaTitle, slackUserId, actionJSONPayload.action_ts, "/idea", actionJSONPayload.channel.id);
        } catch (logError) {
            console.log("error saving slash command idea: " + logError);
        }

        var options = {
            method: 'GET',
            url: 'https://ffn-chatbot-weather-dev.appspot.com/ideas/getSlackUserInfo',
            qs: {
                userid: slackUserId
            },
            headers: {
                Host: 'ffn-chatbot-weather-dev.appspot.com',
                Accept: 'applicaiton/json'
            }
        };

        return rp(options)
            .then(body => {
                var slackUserData = JSON.parse(body);
                slackFullName = slackUserData.data.fullname;

                var optionsAddIdea = {
                    method: 'POST',
                    url: 'https://billsdev.atlassian.net/rest/api/3/issue',
                    headers: {
                        Authorization: 'Basic Z25laWdlckBmcmVlZG9tZmluYW5jaWFsbmV0d29yay5jb206ODVzSWNSSExTRGVua3VkaVlndkU0MUJG',
                        'Content-Type': 'application/json',
                        Accept: 'application/json'
                    },
                    body: {
                        update: {},
                        fields: {
                            project: {
                                id: '15541'
                            },
                            summary: ideaTitle,
                            issuetype: {
                                id: '10955'
                            },
                            assignee: {
                                id: '557058:f03f3f52-3cf0-4d4c-bbe8-65b062600de3'
                            },
                            //  no longer works with reporter filled out was causing an issue. Commented out on 6/13/19 - gtn 
                            //  reporter: {
                            //      id: '557058:f03f3f52-3cf0-4d4c-bbe8-65b062600de3'
                            // },
                            description: {
                                type: 'doc',
                                version: 1,
                                content: [{
                                    type: 'paragraph',
                                    content: [{
                                        type: 'text',
                                        text: ideaDescription + "\n Added by: " + slackFullName
                                    }]
                                }]
                            }
                        }
                    },
                    json: true
                };
                return rp(optionsAddIdea)
                    .then(body => {
                        var jiraKeysToMove = [];
                        jiraKey = body.key;
                        jiraKeysToMove.push(jiraKey);
                        jiraUrl = body.self;

                        var optionsMoveToIntakeSprint = {
                            method: 'POST',
                            url: 'https://billsdev.atlassian.net/rest/agile/1.0/sprint/1719/issue',
                            headers: {
                                Authorization: 'Basic Z25laWdlckBmcmVlZG9tZmluYW5jaWFsbmV0d29yay5jb206ODVzSWNSSExTRGVua3VkaVlndkU0MUJG',
                                'Content-Type': 'application/json',
                                Accept: 'application/json'
                            },
                            body: {
                                issues: jiraKeysToMove
                            },
                            json: true
                        };
                        return rp(optionsMoveToIntakeSprint)
                            .then(body => {
                                var keyTitle = jiraKey + ": " + ideaTitle;
                                var viewJiraUrl = "https://billsdev.atlassian.net/secure/RapidBoard.jspa?rapidView=305&projectKey=PLAN&view=planning&selectedIssue=" + jiraKey;

                                var payloadSlack = {
                                    "blocks": [{
                                            "type": "section",
                                            "text": {
                                                "type": "mrkdwn",
                                                "text": "*Your idea was added*"
                                            }
                                        },
                                        {
                                            "type": "section",
                                            "fields": [{
                                                    "type": "mrkdwn",
                                                    "text": "*Title*\n" + ideaTitle
                                                },
                                                {
                                                    "type": "mrkdwn",
                                                    "text": "*Created*\n" + keyTitle
                                                }
                                            ]
                                        },
                                        {
                                            "type": "actions",
                                            "elements": [{
                                                "type": "button",
                                                "text": {
                                                    "type": "plain_text",
                                                    "emoji": true,
                                                    "text": "View in JIRA"
                                                },
                                                "url": viewJiraUrl,
                                                "style": "primary",
                                                "value": "do_nothing"
                                            }]
                                        }
                                    ]
                                };

                                var options = {
                                    method: 'POST',
                                    url: urlResponse,
                                    headers: {
                                        Accept: 'application/json',
                                        Authorization: 'Bearer xoxb-2253441267-496152507652-UyJGCtu8aPAKU5EV63p94TTK'
                                    },
                                    body: JSON.stringify(payloadSlack)
                                };

                                return rp(options)
                                    .then(body => {
                                        var jsonData = JSON.parse(body);

                                    })
                                    .catch(function (err) {
                                        logError('eror occured on sending add idea. Error: ' + err, slackUserId, 'slack-action', 'slack-action /idea');
                                        console.log('error occured on communicating with user ' + jiraKey + ' to intake sprint. ' + err);
                                    });
                                // .catch(function (err) {
                                //     logError('error occured on moving ' + jiraKey + ' to intake sprint. Error: ' + err, slackUserId, 'slack-action', 'slack-action /idea');
                                //     console.log('error occured on moving ' + jiraKey + ' to intake sprint. ' + err);
                                // });

                            })
                            .catch(function (err) {
                                logError('error occured on inserting new idea to jira. Error: ' + err, slackUserId, 'slack-action', 'slack-action /idea');
                                console.log('error occured on inserting new idea to jira. ' + err);
                            });
                    })
                    .catch(function (err) {
                        logError('error occured on getting slack user details. Error: ' + err, slackUserId, 'slack-action', 'slack-action /idea');
                        console.log('error occured on getting slack user details. ' + err);
                    });
            });

    } else if (actionJSONPayload.actions !== undefined && actionJSONPayload.actions[0].value === "todo_add_new_task") {
        console.log("trigger: " + actionJSONPayload.trigger_id + " slackuser: " + actionJSONPayload.user.id);
        showAddToDoModal(actionJSONPayload.trigger_id, actionJSONPayload.user.id);


    } else if (actionJSONPayload.actions !== undefined && actionJSONPayload.actions[0].value === "click_add_todo") {
        console.log("ADD TODO req action: " + req.body.payload);
        console.log("actionJSONPayload: " + JSON.stringify(actionJSONPayload));
        var payloadSlack = {
            "replace_original": false,
            "blocks": [{
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "*Added your todo item*"
                }
            }]
        };

        var options = {
            method: 'POST',
            url: urlResponse,
            headers: {
                Accept: 'application/json',
                Authorization: 'Bearer xoxb-2253441267-496152507652-UyJGCtu8aPAKU5EV63p94TTK'
            },
            body: JSON.stringify(payloadSlack)
        };

        return rp(options)
            .then(body => {
                //var jsonData = JSON.parse(body);

            });


    } else if (actionJSONPayload.actions !== undefined && actionJSONPayload.actions[0].value === "click_add_todo_canceled") {
        var payloadSlack = {
            "replace_original": false,
            "blocks": [{
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "*CANCELED...adding your todo item*"
                }
            }]
        };

        var options = {
            method: 'POST',
            url: urlResponse,
            headers: {
                Accept: 'application/json',
                Authorization: 'Bearer xoxb-2253441267-496152507652-UyJGCtu8aPAKU5EV63p94TTK'
            },
            body: JSON.stringify(payloadSlack)
        };

        return rp(options)
            .then(body => {
                //var jsonData = JSON.parse(body);

            });


    } else if (actionJSONPayload.actions !== undefined && actionJSONPayload.actions[0].value === "add_another_word") {

        try {
            var dmilliseconds = Date.now().toString();
            logRequests("click add_another_word", slackUserId, dmilliseconds, "clickAddTodo", actionJSONPayload.channel.id);
        } catch (logError) {
            console.log("error action clickAddAnotherWord: " + logError);
        }
        showDialogAddWord(actionJSONPayload.trigger_id);

    } else if (actionJSONPayload.actions !== undefined && actionJSONPayload.actions[0].value === "click_view_mgr_report") {

        var payloadSlack = {
            "replace_original": false,
            "blocks": [{
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "*TEAM REPORT*"
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "*MEMBER*: Glenn Neiger"
                    }
                },

                {
                    "type": "divider"
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "*DESCRIPTION*\nConvert Idea to slash command with a dialog vs just text using slack UI."
                    }
                },
                {
                    "type": "section",
                    "fields": [{
                            "type": "mrkdwn",
                            "text": "*START DATE*\n09/27/2019"
                        },
                        {
                            "type": "mrkdwn",
                            "text": "*FINISH DATE*\n09/27/2019"
                        },
                        {
                            "type": "mrkdwn",
                            "text": "*Status*\nCompleted"
                        },
                        {
                            "type": "mrkdwn",
                            "text": "*DURATION*\n1:06"
                        }
                    ]
                },
                {
                    "type": "actions",
                    "elements": [{
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "emoji": true,
                                "text": "REQUEST PROMOTION"
                            },
                            "style": "primary",
                            "value": "click_request_promotion"
                        },
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "emoji": true,
                                "text": "SAVE TO MY NOTES"
                            },
                            "style": "primary",
                            "value": "click_save_notes"
                        },
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "emoji": true,
                                "text": "SCHEDULE 1:1"
                            },
                            "style": "primary",
                            "value": "click_schedule_1on1"
                        }
                    ]
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "*DESCRIPTION*\nCreate stats single page web application for Slack Franklin Stats."
                    }
                },
                {
                    "type": "section",
                    "fields": [{
                            "type": "mrkdwn",
                            "text": "*START DATE*\n09/27/2019"
                        },
                        {
                            "type": "mrkdwn",
                            "text": "*FINISH DATE*\n09/27/2019"
                        },
                        {
                            "type": "mrkdwn",
                            "text": "*Status*\nCompleted"
                        },
                        {
                            "type": "mrkdwn",
                            "text": "*DURATION*\n2:49"
                        }
                    ]
                },
                {
                    "type": "actions",
                    "elements": [{
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "emoji": true,
                                "text": "REQUEST PROMOTION"
                            },
                            "style": "primary",
                            "value": "click_request_promotion"
                        },
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "emoji": true,
                                "text": "SAVE TO MY NOTES"
                            },
                            "style": "primary",
                            "value": "click_save_notes"
                        },
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "emoji": true,
                                "text": "SCHEDULE 1:1"
                            },
                            "style": "primary",
                            "value": "click_schedule_1on1"
                        }
                    ]
                }
            ]
        };

        var options = {
            method: 'POST',
            url: urlResponse,
            headers: {
                Accept: 'application/json',
                Authorization: 'Bearer xoxb-2253441267-496152507652-UyJGCtu8aPAKU5EV63p94TTK'
            },
            body: JSON.stringify(payloadSlack)
        };

        return rp(options)
            .then(body => {
                var jsonData = JSON.parse(body);

            })


    } else if (actionJSONPayload.actions !== undefined && actionJSONPayload.actions[0].value === "click_request_promotion") {
        var payloadSlack = {
            "replace_original": false,
            "blocks": [{
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "*Glenn Neiger* has been promoted to *Manager*!\n Per your request to manager with an increase in pay and bonus.\n\n*ACTIONS COMPLETED*\n\n...A department email has been prepared and is in draft state ready to send at as you wish to broadcast the promotion to the department.\n...Active directory has been updated.\n...Service Now has been updated.\n...ADP has been updated.\n...ADP payment adjustment has been submitted.\n...ADP has been approved and submitted for direct deposit.\n...Company credit card has been ordered."
                }
            }]
        };

        var options = {
            method: 'POST',
            url: urlResponse,
            headers: {
                Accept: 'application/json',
                Authorization: 'Bearer xoxb-2253441267-496152507652-UyJGCtu8aPAKU5EV63p94TTK'
            },
            body: JSON.stringify(payloadSlack)
        };

        return rp(options)
            .then(body => {
                var jsonData = JSON.parse(body);

            })


    } else if (actionJSONPayload.actions !== undefined && actionJSONPayload.actions[0].value === "click_another_joke") {
        // add in fetching another joke here. 
        try {
            logRequests("click_another_joke", slackUserId, actionJSONPayload.action_ts, "click_another_joke", actionJSONPayload.channel.id);
        } catch (logError) {
            console.log("error saving click_another_joke: " + logError);
        }

        var options = {
            uri: 'https://icanhazdadjoke.com/',
            method: 'GET',
            json: true,
            headers: {
                "Accept": 'text/plain'
            }
        };

        return rp(options)
            .then(result => {
                response_body = {
                    text: ":laughing: " + result,
                    "replace_original": false,
                    response_type: 'in_channel',
                };

                var optionsResponse = {
                    uri: urlResponse,
                    method: 'POST',
                    body: JSON.stringify(response_body)
                };
                return rp(optionsResponse);
                // .catch(error);

            });
        /* } else if (actionJSONPayload.actions !== undefined && actionJSONPayload.actions[0].value === "click_view_open_issues") {*/

    } else if (actionJSONPayload.actions !== undefined && actionJSONPayload.actions[0].value === "click_lawyer_joke") {
        try {
            logRequests("lick_lawyer_joke", slackUserId, actionJSONPayload.action_ts, "lick_lawyer_joke", actionJSONPayload.channel.id);
        } catch (logError) {
            console.log("error saving lick_lawyer_joke: " + logError);
        }

        showAnotherLawyerJokes(urlResponse);

    } else if (actionJSONPayload.actions !== undefined && actionJSONPayload.actions[0].value === "click_it_joke") {


        // add in fetching another IT joke here. 
        try {
            logRequests("click_it_joke", slackUserId, actionJSONPayload.action_ts, "click_it_joke", actionJSONPayload.channel.id);
        } catch (logError) {
            console.log("error saving click_it_joke: " + logError);
        }


        var options = {
            uri: 'https://geek-jokes.sameerkumar.website/api',
            method: 'GET',
            json: true
        };

        return rp(options)
            .then(result => {
                response_body = {
                    text: ":laughing: " + result,
                    "replace_original": false,
                    response_type: 'in_channel',
                };

                var optionsResponse = {
                    uri: urlResponse,
                    method: 'POST',
                    body: JSON.stringify(response_body)
                };
                return rp(optionsResponse);
            })
            .catch(function (err) {
                logError(err, req.body.originalDetectIntentRequest.payload.data.event.user, 'J2', 'joke2Handler');
            });

    } else if (actionJSONPayload.actions !== undefined && actionJSONPayload.actions[0].value === "clickAddTodo") {
        try {
            logRequests("clickAddTodo slack-action", slackUserId, actionJSONPayload.action_ts, "clickAddTodo", actionJSONPayload.channel.id);
        } catch (logError) {
            console.log("error saving slash action clickAddTodo: " + logError);
        }

        var jsonData = JSON.parse(req.body);
        // jsonData.token + '&trigger_id=' +
        //console.log("TriggerId: " + jsonData.trigger_id);
        var options = {
            method: 'POST',
            url: 'https://slack.com/api/dialog.open?token=xoxb-2253441267-496152507652-UyJGCtu8aPAKU5EV63p94TTK&trigger_id=' + jsonData.trigger + '&dialog=%7B%22callback_id%22%3A%22clickAddTodo%22%2C%22title%22%3A%22Request+a+Ride%22%2C%22submit_label%22%3A%22Request%22%2C%22state%22%3A%22Limo%22%2C%22elements%22%3A%5B%7B%22type%22%3A%22text%22%2C%22label%22%3A%22Pickup+Location%22%2C%22name%22%3A%22loc_origin%22%7D%2C%7B%22type%22%3A%22text%22%2C%22label%22%3A%22Dropoff+Location%22%2C%22name%22%3A%22loc_destination%22%7D%5D%7D',
            // qs: {
            //     trigger_id: req.body.trigger_id,
            //     dialog: '%7B%22callback_id%22%3A%22clickAddTodo%22%2C%22title%22%3A%22Request+a+Ride%22%2C%22submit_label%22%3A%22Request%22%2C%22state%22%3A%22Limo%22%2C%22elements%22%3A%5B%7B%22type%22%3A%22text%22%2C%22label%22%3A%22Pickup+Location%22%2C%22name%22%3A%22loc_origin%22%7D%2C%7B%22type%22%3A%22text%22%2C%22label%22%3A%22Dropoff+Location%22%2C%22name%22%3A%22loc_destination%22%7D%5D%7D'
            // },
            // headers: {
            //     'Content-Type': 'application/json', //'application/x-www-form-urlencoded',
            //     Authorization: 'Bearer xoxb-2253441267-496152507652-UyJGCtu8aPAKU5EV63p94TTK'
            // }
        };


        return rp(options)
            .then(body => {
                //res.status(200).send();
            })
            .catch((err) => {
                console.log("dialog.open failed with error: " + err);
                res.sendStatus(500);
            });
    } else {
        console.log("WhatActionRec: " + req.body);
        if (urlResponse !== undefined && urlResponse !== null) {
            response_body = {
                text: 'Can do! Querying...',
                response_type: 'in_channel',
            };
        } else {
            response_body = {
                text: 'Issue with URL...',
                response_type: 'in_channel',
            };
        }

        // double checking rp post call below tested 6/27/19 works too
        var optionsGeneralResponse = {
            uri: urlResponse,
            method: 'POST',
            body: JSON.stringify(response_body)
        };
        return rp(optionsGeneralResponse);
    }
});

router.get('/ebooks', function (req, res, next) {

    //console.log("Headers: " + JSON.stringify(req.headers));
    if (!mysqlPool) {
        mysqlPool = mysql.createPool(mysqlConfig);
    }

    mysqlPool.query('SELECT * FROM  ebooks', (err, results) => {
        if (err) {
            console.log("Error getting ebooks data: Error: " + err);
            //res.status(500).send(err);
        } else {

            var retData = {
                "data": results
            };
            res.send(retData);
        }
    });
});

router.get('/ebooksbytitle', function (req, res, next) {

    //console.log("Headers: " + JSON.stringify(req.headers));
    if (!mysqlPool) {
        mysqlPool = mysql.createPool(mysqlConfig);
    }

    mysqlPool.query("SELECT * FROM  ebooks where title like '%"+ req.query.title + "%'", (err, results) => {
        if (err) {
            console.log("Error getting ebooks data for title" + req.query.title + ". Error: " + err);
            //res.status(500).send(err);
        } else {

            var retData = {
                "data": results
            };
            res.send(retData);
        }
    });
});


router.get('/ops_download', function (req, res, next) {

    //console.log("Headers: " + JSON.stringify(req.headers));
    if (!mysqlPool) {
        mysqlPool = mysql.createPool(mysqlConfig);
    }

    // ops_impact = 2 Dept, 3, multiuser, 4 single user need to add to db. Used for creating service now request. 
    mysqlPool.query('SELECT * FROM  ops_comm', (err, results) => {
        if (err) {
            console.log("Error getting ops_comm data. Error: " + err);
            //res.status(500).send(err);
        } else {

            var retData = {
                "data": results
            };
            var retCsv = '';
            var slackId = '';
            var assignedSlackId = '';
            var system = '';
            var teamLeads = '';
            var dcs = '';
            var isWorkStopage = '';
            var errorDetails = '';
            var description = '';
            var imagePath = '';
            var isResolved = '';
            var isChannelNotified = '';
            var notes = '';
            var closedOn = '';
            var assigneeName = '';
            var modOn = '';
            var leadId = '';
            var imageId = '';
            var snowSysId = '';
            var snowId = '';
            var snowImpact = '';


            retCsv = "id,slack_id,assigned_slack_id,system,team_leads,dcs,is_work_stopage,error,description,image_path,is_resolved,is_channel_notified,notes,closed_on,created_on,assignee_name,mod_on,lead_id,image_id,snow_sys_id,snow_id,snow_impact\n";
            for (var i = 0; i < retData.data.length; i++) {

                slackId = retData.data[i].slack_id !== null ? retData.data[i].slack_id : "";

                assignedSlackId = retData.data[i].assigned_slack_id !== null ? retData.data[i].assigned_slack_id : "";
                system = retData.data[i].system;
                teamLeads = retData.data[i].team_leads !== null ? retData.data[i].team_leads : "";
                dcs = retData.data[i].dcs !== null ? retData.data[i].dcs : "";
                isWorkStopage = retData.data[i].is_work_stoppage === 1 ? "Yes" : "No";
                errorDetails = retData.data[i].error !== null ? retData.data[i].error : "";
                description = retData.data[i].description !== null ? retData.data[i].description : "";
                imagePath = retData.data[i].image_path !== null ? retData.data[i].image_path : "";
                if (retData.data[i].is_resolved === 0) {
                    isResolved = "Open";
                } else if (retData.data[i].is_resolved === 1) {
                    isResolved = "Closed";
                } else {
                    isResolved = "In Progress";
                }

                isChannelNotified = retData.data[i].is_channel_notified !== null && retData.data[i].is_channel_notified === 1 ? "Yes" : "No";
                notes = retData.data[i].notes !== null ? retData.data[i].notes : "";
                closedOn = retData.data[i].closed_on !== null ? retData.data[i].closed_on : "";

                assigneeName = retData.data[i].assignee_name !== null ? retData.data[i].assignee_name : "";
                modOn = retData.data[i].mod_on !== null ? retData.data[i].mod_on : "";
                leadId = retData.data[i].lead_id !== null ? retData.data[i].lead_id : "";
                imageId = retData.data[i].image_id !== null ? retData.data[i].image_id : "";
                snowSysId = retData.data[i].snow_sys_id !== null ? retData.data[i].snow_sys_id : "";
                snowId = retData.data[i].snow_id !== null ? retData.data[i].snow_id : "";

                // ops_impact = 2 Dept, 3, multiuser, 4 single user 
                if (retData.data[i].snow_impact !== null && retData.data[i].snow_impact === 2) {
                    snowImpact = 'Dept';
                } else if (retData.data[i].snow_impact !== null && retData.data[i].snow_impact === 3) {
                    snowImpact = 'multiuser';
                } else if (retData.data[i].snow_impact !== null && retData.data[i].snow_impact === 4) {
                    snowImpact = 'single user ';
                }



                retCsv = retCsv + retData.data[i].id + ',"' + slackId + '","' + assignedSlackId + '","' + system + '","' + teamLeads + '","' + dcs + '","' + isWorkStopage + "," + errorDetails + '","' + description + '","' + imagePath + '","' + isResolved + '","' + isChannelNotified + '","' + notes + '","' + closedOn + '","' + retData.data[i].created_on + '","' + assigneeName + '","' + modOn + '","' + leadId + '","' + imageId + '","' + snowSysId + '","' + snowId + '","' + snowImpact + '"\n';
            }
            res.send(retCsv);

        }
    });
});

router.get('/stat_i_24', function (req, res, next) {

    if (!mysqlPool) {
        mysqlPool = mysql.createPool(mysqlConfig);
    }

    mysqlPool.query("select COUNT(id) as total, intent from requests where user<>'UDFLSFTL5' and created_on >= DATE_SUB(NOW(), INTERVAL 1 DAY)group by intent order by total desc", (err, results) => {
        if (err) {
            console.log("Error Writing to ops_comm db: " + err);
            //res.status(500).send(err);
        } else {

            var retData = {
                "data": results
            };
            res.send(retData);
        }
    });
});

router.get('/stats_i_30d', function (req, res, next) {

    if (!mysqlPool) {
        mysqlPool = mysql.createPool(mysqlConfig);
    }

    mysqlPool.query("select COUNT(id) as total, intent from requests where user<>'UDFLSFTL5' and created_on >= DATE_SUB(NOW(), INTERVAL 30 DAY)group by intent order by total desc", (err, results) => {
        if (err) {
            console.log("Error Writing to ops_comm db: " + err);
            //res.status(500).send(err);
        } else {

            var retData = {
                "data": results
            };
            res.send(retData);
        }
    });

});

router.get('/stats_i_60d', function (req, res, next) {

    if (!mysqlPool) {
        mysqlPool = mysql.createPool(mysqlConfig);
    }

    mysqlPool.query("select COUNT(id) as total, intent from requests where user<>'UDFLSFTL5' and created_on >= DATE_SUB(NOW(), INTERVAL 60 DAY)group by intent order by total desc", (err, results) => {
        if (err) {
            console.log("Error Writing to ops_comm db: " + err);
            //res.status(500).send(err);
        } else {

            var retData = {
                "data": results
            };
            res.send(retData);
        }
    });
});

router.get('/stats_i_90d', function (req, res, next) {

    if (!mysqlPool) {
        mysqlPool = mysql.createPool(mysqlConfig);
    }

    mysqlPool.query("select COUNT(id) as total, intent from requests where user<>'UDFLSFTL5' and created_on >= DATE_SUB(NOW(), INTERVAL 90 DAY)group by intent order by total desc", (err, results) => {
        if (err) {
            console.log("Error Writing to ops_comm db: " + err);
            //res.status(500).send(err);
        } else {

            var retData = {
                "data": results
            };

            res.send(retData);
        }
    });

});

router.get('/stats_i_all', function (req, res, next) {

    if (!mysqlPool) {
        mysqlPool = mysql.createPool(mysqlConfig);
    }

    mysqlPool.query("select COUNT(id) as total, intent from requests where user<>'UDFLSFTL5' group by intent order by total desc", (err, results) => {
        if (err) {
            console.log("Error Writing to ops_comm db: " + err);
            //res.status(500).send(err);
        } else {

            var retData = {
                "data": results
            };

            res.send(retData);
        }
    });

});


router.get('/stats_u_24h', function (req, res, next) {

    if (!mysqlPool) {
        mysqlPool = mysql.createPool(mysqlConfig);
    }

    mysqlPool.query("select COUNT(userid) as total, slackusers.fullname from requests as r inner join slackusers on slackusers.userid=r.user where user<>'UDFLSFTL5' and created_on >= DATE_SUB(NOW(), INTERVAL 1 DAY) group by userid order by total desc", (err, results) => {
        if (err) {
            console.log("Error Writing to ops_comm db: " + err);
            //res.status(500).send(err);
        } else {

            var retData = {
                "data": results
            };
            res.send(retData);
        }
    });
});

router.get('/stats_u_30d', function (req, res, next) {

    if (!mysqlPool) {
        mysqlPool = mysql.createPool(mysqlConfig);
    }


    mysqlPool.query("select COUNT(userid) as total, slackusers.fullname from requests as r inner join slackusers on slackusers.userid=r.user where user<>'UDFLSFTL5' and created_on >= DATE_SUB(NOW(), INTERVAL 30 DAY) group by userid order by total desc", (err, results) => {
        if (err) {
            console.log("Error Writing to ops_comm db: " + err);
            //res.status(500).send(err);
        } else {

            var retData = {
                "data": results
            };
            res.send(retData);
        }
    });
});


router.get('/stats_u_60d', function (req, res, next) {

    if (!mysqlPool) {
        mysqlPool = mysql.createPool(mysqlConfig);
    }


    mysqlPool.query("select COUNT(userid) as total, slackusers.fullname from requests as r inner join slackusers on slackusers.userid=r.user where user<>'UDFLSFTL5' and created_on >= DATE_SUB(NOW(), INTERVAL 60 DAY) group by userid order by total desc", (err, results) => {
        if (err) {
            console.log("Error Writing to ops_comm db: " + err);
            //res.status(500).send(err);
        } else {

            var retData = {
                "data": results
            };
            res.send(retData);
        }
    });
});

router.get('/stats_u_90d', function (req, res, next) {

    if (!mysqlPool) {
        mysqlPool = mysql.createPool(mysqlConfig);
    }


    mysqlPool.query("select COUNT(userid) as total, slackusers.fullname from requests as r inner join slackusers on slackusers.userid=r.user where user<>'UDFLSFTL5' and created_on >= DATE_SUB(NOW(), INTERVAL 90 DAY) group by userid order by total desc", (err, results) => {
        if (err) {
            console.log("Error Writing to ops_comm db: " + err);
            //res.status(500).send(err);
        } else {

            var retData = {
                "data": results
            };
            res.send(retData);
        }
    });
});

router.get('/stats_u_all', function (req, res, next) {

    if (!mysqlPool) {
        mysqlPool = mysql.createPool(mysqlConfig);
    }


    mysqlPool.query("select COUNT(userid) as total, slackusers.fullname from requests as r inner join slackusers on slackusers.userid=r.user where user<>'UDFLSFTL5' group by userid order by total desc", (err, results) => {
        if (err) {
            console.log("Error Writing to ops_comm db: " + err);
            //res.status(500).send(err);
        } else {

            var retData = {
                "data": results
            };
            res.send(retData);
        }
    });
});




router.post('/createtodo', function (req, res, next) {
    addUpdateUserMap(req.body.user_id, req.body.channel_id);
    console.log("received from Slack createtodo: " + JSON.stringify(req.body));
});


router.post('/addidea', function (req, res, next) {
    //console.log("received from Slack slash command add idea: " + JSON.stringify(req.body));
    //console.log("TriggerID: " + req.body.trigger_id);
    var slackDialogUrl = "https://slack.com/api/dialog.open?token=xoxb-2253441267-496152507652-UyJGCtu8aPAKU5EV63p94TTK&trigger_id=" + req.body.trigger_id + "&dialog=%7B%22callback_id%22%3A%22ryde-46e2b0%22%2C%22title%22%3A%22Request%20a%20Ride%22%2C%22submit_label%22%3A%22Request%22%2C%22state%22%3A%22Limo%22%2C%22elements%22%3A%5B%7B%22type%22%3A%22text%22%2C%22label%22%3A%22Pickup%20Location%22%2C%22name%22%3A%22loc_origin%22%7D%2C%7B%22type%22%3A%22text%22%2C%22label%22%3A%22Dropoff%20Location%22%2C%22name%22%3A%22loc_destination%22%7D%5D%7D";
    //"dialog=%7B%22callback_id%22%3A%22idea-46e2b0%22%2C%22title%22%3A%22Add%20New%20Idea%22%2C%22submit_label%22%3A%22Submit%22%2C%22notify_on_cancel%22%3Atrue%2C%22state%22%3A%22idea%22%2C%22elements%22%3A%5B%7B%22label%22%3A%22Idea%20Title%22%2C%22name%22%3A%22ideaTitle%22%2C%22type%22%3A%22text%22%2C%22placeholder%22%3A%22Enter%20a%20title%22%7D%2C%7B%22label%22%3A%22Detailed%20Description%22%2C%22name%22%3A%22ideaDescription%22%2C%22type%22%3A%22textarea%22%2C%22max_length%22%3A9999%2C%22hint%22%3A%22Provide%20as%20much%20details%20as%20possible%20for%20your%20idea.%22%7D%5D%7D";

    // var body  = "dialog=%7B%22callback_id%22%3A%22idea-46e2b0%22%2C%22title%22%3A%22Add%20New%20Idea%22%2C%22submit_label%22%3A%22Submit%22%2C%22notify_on_cancel%22%3Atrue%2C%22state%22%3A%22idea%22%2C%22elements%22%3A%5B%7B%22label%22%3A%22Idea%20Title%22%2C%22name%22%3A%22ideaTitle%22%2C%22type%22%3A%22text%22%2C%22placeholder%22%3A%22Enter%20a%20title%22%7D%2C%7B%22label%22%3A%22Detailed%20Description%22%2C%22name%22%3A%22ideaDescription%22%2C%22type%22%3A%22textarea%22%2C%22max_length%22%3A9999%2C%22hint%22%3A%22Provide%20as%20much%20details%20as%20possible%20for%20your%20idea.%22%7D%5D%7D";

    var options = {
        method: 'POST',
        url: slackDialogUrl,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        }
    };
    // var options = {
    //     method: 'POST',
    //     url: 'https://slack.com/api/dialog.open',
    //     qs: {
    //         trigger_id: req.body.trigger_id,
    //         dialog: '%7B%22callback_id%22%3A%22ryde-46e2b0%22%2C%22title%22%3A%22Request%20a%20Ride%22%2C%22submit_label%22%3A%22Request%22%2C%22state%22%3A%22Limo%22%2C%22elements%22%3A%5B%7B%22type%22%3A%22text%22%2C%22label%22%3A%22Pickup%20Location%22%2C%22name%22%3A%22loc_origin%22%7D%2C%7B%22type%22%3A%22text%22%2C%22label%22%3A%22Dropoff%20Location%22%2C%22name%22%3A%22loc_destination%22%7D%5D%7D'
    //     },
    //     headers: {
    //         'Content-Type': 'application/x-www-form-urlencoded',
    //         Authorization: 'Bearer xoxb-2253441267-496152507652-UyJGCtu8aPAKU5EV63p94TTK'
    //     }
    //     //,
    // body: {
    //     "callback_id": "ryde-46e2b0",
    //     "title": "Request a Ride",
    //     "submit_label": "Request",
    //     "state": "Limo",
    //     "elements": [{
    //             "type": "text",
    //             "label": "Pickup Location",
    //             "name": "loc_origin"
    //         },
    //         {
    //             "type": "text",
    //             "label": "Dropoff Location",
    //             "name": "loc_destination"
    //         }
    //     ]
    // },
    // json: true
    // };


    //     var options = { method: 'POST',
    //   url: 'https://slack.com/api/dialog.open',
    //   headers: 
    //    { 
    //      'Content-Type': 'application/json',
    //      Authorization: 'Bearer xoxb-2253441267-496152507652-UyJGCtu8aPAKU5EV63p94TTK' },
    //   body: 
    //    { trigger_id: req.body.trigger_id,
    //      dialog: '%7B%22callback_id%22%3A%22idea-46e2b0%22%2C%22title%22%3A%22Add%20New%20Idea%22%2C%22submit_label%22%3A%22Submit%22%2C%22notify_on_cancel%22%3Atrue%2C%22state%22%3A%22idea%22%2C%22elements%22%3A%5B%7B%22label%22%3A%22Idea%20Title%22%2C%22name%22%3A%22ideaTitle%22%2C%22type%22%3A%22text%22%2C%22placeholder%22%3A%22Enter%20a%20title%22%7D%2C%7B%22label%22%3A%22Detailed%20Description%22%2C%22name%22%3A%22ideaDescription%22%2C%22type%22%3A%22textarea%22%2C%22max_length%22%3A9999%2C%22hint%22%3A%22Provide%20as%20much%20details%20as%20possible%20for%20your%20idea.%22%7D%5D%7D' },
    //   json: true };


    // var options = {
    //     method: 'POST',
    //     url: slackDialogUrl,
    //     headers: {
    //         'Content-Type': 'application/json',
    //         'Authorization': 'Bearer ' + req.body.token,
    //         Accept: 'application/json'
    //     }
    // };

    return rp(options)
        .then(body => {
            // console.log("Post returned: " + body);
            // //res.send("Awesome please add your idea.")
            // var slackResponse = {
            //     "slack": {
            //         "trigger_id": req.body.trigger_id,
            //         "dialog": {
            //             "callback_id": "idea-46e2b0",
            //             "title": "Add New Idea",
            //             "submit_label": "Submit",
            //             "notify_on_cancel": true,
            //             "state": "idea",
            //             "elements": [{
            //                     "label": "Idea Title",
            //                     "name": "ideaTitle",
            //                     "type": "text",
            //                     "placeholder": "Enter a title"
            //                 },
            //                 {
            //                     "label": "Detailed Description",
            //                     "name": "ideaDescription",
            //                     "type": "textarea",
            //                     "max_length": 9999,
            //                     "hint": "Provide as much details as possible for your idea."
            //                 }
            //             ]
            //         }
            //     }
            // };
            res.status(200).send();
            //res.send(slackResponse);
        });

    /*
    
    https://slack.com/api/dialog.open?token=xoxb-such-and-such&trigger_id=13345224609.738474920.8088930838d88f008e0
dialog=%7B%22callback_id%22%3A%22idea-46e2b0%22%2C%22title%22%3A%22Request%20a%20Ride%22%2C%22submit_label%22%3A%22Request%22%2C%22notify_on_cancel%22%3Atrue%2C%22state%22%3A%22Limo%22%2C%22elements%22%3A%5B%7B%22type%22%3A%22text%22%2C%22label%22%3A%22Pickup%20Location%22%2C%22name%22%3A%22loc_origin%22%7D%2C%7B%22type%22%3A%22text%22%2C%22label%22%3A%22Dropoff%20Location%22%2C%22name%22%3A%22loc_destination%22%7D%5D%7D 
*/

});

router.post('/imageupload', function (req, res, next) {

    // uses fs and 
    // var form = new formidable.IncomingForm();
    // form.parse(req, function (err, fields, files) {
    //     var oldpath = files.filetoupload.path;
    //     var newpath = 'C:/Users/Your Name/' + files.filetoupload.name;
    //     fs.rename(oldpath, newpath, function (err) {
    //     if (err) throw err;
    //     res.write('File uploaded and moved!');
    //     res.end();
    //     });

    /*var httpPostedFile = HttpContext.Current.Request.Files["UploadFiles"];
    var fileSave = HttpContext.Current.Server.MapPath("UploadedFiles");
    var fileSavePath = Path.Combine(fileSave, httpPostedFile.FileName);
    if (!System.IO.File.Exists(fileSavePath))
    {
        httpPostedFile.SaveAs(fileSavePath);
        // Get the current file name
        var oldName = httpPostedFile.FileName;
        // Get the additional data as name in server end by corresponding key.
        var newName = HttpContext.Current.Request.Form["fileName"];
        // Rename the file
        File.Move(oldName, newName);
        HttpResponse Response = System.Web.HttpContext.Current.Response;
        Response.Clear();
        Response.ContentType = "application/json; charset=utf-8";
        // Sending the file path to client side
        Response.StatusDescription = fileSavePath;
        Response.End();
    }*/
    res.status(200).send();
})

// todo convert this functio for handling queue task
// todo working on converting base64 to string so that can use the data.

// router.post('/taskhandler', (req, res, next) => {

//     //router.use(bodyParser.raw({type: 'application/octet-stream'}));
//     try {
//         var text = Base64.decode(req.body);
//         // var bytes = base64.decode(req.body);
//         // var text = utf8.decode(bytes);

//         //var reqString = new Buffer(JSON.stringify(req.body), 'base64').toString('utf8');
//         //new Buffer(JSON.stringify(req.body), 'base64').toString('ascii');
//         //req.body.toString('ascii');
//         var jsonObj = JSON.parse(text);
//         var intentName = jsonObj.data.queryResult.intent.displayName;;
//         console.log(intentName);
//         console.log("TASKHandler rec: " + JSON.stringify(jsonObj));

//         // var intent = req.body.data.queryResult.intent.displayName;
//         // var slackUserId = req.body.slackUserId;
//         // var channelId = req.body.channelId;
//         // switch (intent) {
//         //     case "JIRA-SpecProj":
//         //             taskHandlerJiraSearchITProj(slackUserId, channelId, JSON.parse(req.body.data));
//         //         break;
//         // }
//         // // Log the request payload
//         // console.log('Received task with payload: %s', JSON.stringify(req.body));
//         res.send(`Printed task payload: ${jsonObj}`).end();
//     } catch (err) {
//         console.log("taskHandler error: " + err);
//         res.send("nothing returned").end();
//     }
// });


router.post('/', function (req, res, next) {
	console.log('post called!');
   // var intentName = req.body.queryResult.intent.displayName;
   
   var intentName = req.body.intentname;
   console.log(intentName);

    try {
        logRequests(req.body.queryResult.queryText, req.body.originalDetectIntentRequest.payload.data.event.user, req.body.originalDetectIntentRequest.payload.data.event.ts, intentName, req.body.originalDetectIntentRequest.payload.data.event.channel);
    } catch (logError) {
        console.log("error saving request: " + logError);
    }

    try {
        // logRequests(req.body.queryResult.queryText, req.body.originalDetectIntentRequest.payload.data.event.user, req.body.originalDetectIntentRequest.payload.data.event.ts, intentName, req.body.originalDetectIntentRequest.payload.data.event.channel);
        //if (!retResults) console.log("Error: Failed to write analytics");
        //console.log("received from Slack: " + JSON.stringify(req.body));
        //console.log("entire req from Slack: " + JSON.stringify(req));
        switch (intentName) {
            case "JIRA-NewIdea":
                // add new JIRA idea to Intake sprint
                //addNewIdeaWithOutName(req, res, next);
                addNewIdeaWithName(req, res, next);
                break;
            case "bookSearch":
                bookSearchHandler(req, res, next);
                break;
            case "Help":
                // displays help for Franklin
                helpHandler(req, res, next);
                break;
            case "BuzzWord":
                // corporate buzz word generator
                buzzWordHandler(req, res, next);
                break;
                // case "JIRA-Proj":
                //     // Top IT Projects
                //     jiraProjHandler(req, res, next);
                //     break;
            case "JIRA-SpecProj":
                // Returns specific JIRA project
                //testGetAllJiraProjects(req, res, next);
                //newjiraSpecProjHandler(req, res, next);
                //jiraSpecProjHandler(req, res, next);
                // var payloadSlack = {
                //     "payload": {
                //         "slack": {
                //             "text": "IT JIRA Projects ...",
                //             "attachments": [{
                //                 "text": "Processing your JIRA search ...",
                //                 "fallback": "Processing your JIRA search ...",
                //                 "color": "#3AA3E3",
                //                 "attachment_type": "default"
                //             }]
                //         },
                //         "outputContexts": [{
                //             "name": "projects/${PROJECT_ID}/agt/sessions/${SESSION_ID}/contexts/JIRA-SpecProj"
                //         }]
                //     }
                // };
                // res.send(payloadSlack);

                jiraSearchITProj(req, res, next);
                break;
            case "JIRA-MyTasks":
            case "MyTask":
                // Top IT Projects
                jiraMyTasksHandler(req, res, next);
                break;
            case "JIRAGETAllIdeas":
                jiraGetIdeasHandler(req, res, next);
                break;
            case "TJIRA":
                tjiraSpecProjHandler(req, res, next);
                break;
            case "IncidentMgt":
                // Returns incident management info
                incidentMgtHandler(req, res, next);
                break;
            case "Joke":
            case "Joker":
                // joke (Dad jokes)
                jokeHandler(req, res, next);
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
                // deleted OpinionQuote on 5/20/19
                // case "OpinionQuote": // training words... oq, opinion, quote
                //     // random opinion
                //     opinionHandler(req, res, next);
                //     break;
            case "Poem":
                // random poem
                poemHandler(req, res, next);
                break;
            case "SNOWKnowledgeSearch":
                snowKnowledgeSearch(req, res, next);
                break;
            case "salesforceKnowledgeSearch":
                salesforceHandler(req, res, next);
                break;
            case "USESnowSearch":
                useSnowKnowledgeSearch(req, res, next);
                break;
            case "SendClientEmail":
                sendClientMailHandler(req, res, next);
                break;
            case "Weather":
                // weather for any city
                weatherHandler(req, res, next);
                break;
            case "mytest":
                mytestHandler(req, res, next);
                break;
            case "MathFacts":
                mathFactsHandler(req, res, next);
                break;
            case "StockQuote":
                stockQuoteHandler(req, res, next);
                break;
            case "TimeNow":
                getAllTimesForEachCity(req, res, next);
                break;
            case "CalculateGrossIncome":
                calculateGrossIncome(req, res, next);
                break;
            case "smartSheets":
                smartSheetsHandler(req, res, next);
                break;
            case "sportsScoreCard":
                sportsScoreCardHandler(req, res, next);
                break;
            case "whoIsLookup":
                var slackUserId = req.body.originalDetectIntentRequest.payload.data.event.user;
				//var slackUserId = '830303725520.1357199786049';
                var options = {
                    method: 'GET',
                    url: 'https://ffn-chatbot-weather-dev.appspot.com/ideas/getSlackUserInfo',
                    qs: {
                        userid: slackUserId
                    },
                    headers: {
                        Host: 'ffn-chatbot-weather-dev.appspot.com',
                        Accept: 'applicaiton/json'
                    }
                };

                return rp(options)
                    .then(body => {

                        var slackUserData = JSON.parse(body);

                        console.log("oktaGroup: " + slackUserData.data.okta_group);
                        if ((slackUserData.data.okta_group !== undefined && slackUserData.data.okta_group === '94f7f52a-ee17-4e63-a1b1-155099a38901' || slackUserData.data.okta_group === 'c7fd8f98-ca95-11e9-a0e7-42010a800232') || slackUserData.data.userid === 'UDFLSFTL5') {
                            whoIsLookupHandler(req, res, next);
                        } else {
                            genericwhoIsLookupHandler(req, res, next);
                        }
                    });
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
            case "ServiceNow":
                // ADD CHECK IF MANAGER OTHERWISE RETURN ... generic response.
                var slackUserId = req.body.originalDetectIntentRequest.payload.data.event.user;
                var options = {
                    method: 'GET',
                    url: 'https://ffn-chatbot-weather-dev.appspot.com/ideas/getSlackUserInfo',
                    qs: {
                        userid: slackUserId
                    },
                    headers: {
                        Host: 'ffn-chatbot-weather-dev.appspot.com',
                        Accept: 'applicaiton/json'
                    }
                };

                return rp(options)
                    .then(body => {

                        var slackUserData = JSON.parse(body);

                        console.log("oktaGroup: " + slackUserData.data.okta_group);
                        if (slackUserData.data.okta_group !== undefined && slackUserData.data.okta_group === '94f7f52a-ee17-4e63-a1b1-155099a38901') {
                            serviceNowHandler(req, res, next);
                        } else {
                            genericResponse(req, res, next);
                        }
                    });
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
            case "myTodos":
                getMyTodoHandler(req, res, next);
                break;
            case "brightIdea":
                brightIdeaHandler(req, res, next);
                break;
            case "ReturnRequest":
                returnRequestHandler(req, res, next);
                break;
            case "fdrSalesIntake":
                fdrSalesIntakeHandler(req, res, next);
                break;
            case "addTodo":
                handleTodoRequestHandler(req, res, next);
                break;
                // case "createNewTodo":
                //     createNewTodoHandler(req, res, next);
                //     break;
            case "todoTest":
                todoTestHandler(req, res, next);
                break;
            case "franklinStatistics":
                franklinStatsHandler(req, res, next);
                break;
            case "managerReport":
                managerReportHandler(req, res, next);
                break;
            case "createNewTodo":
                createNewTodoHandler(req, res, next);
                break;
            case "orderCafeteria":
                orderCafeteriaHandler(req, res, next);
                break;
            case "taskManager":
                taskManagerHandler(req, res, next);
                break;
            case "defineThisWord":
                wordLookupHandler(req, res, next);
                break;
            case "listAllFFNDictionary":
                listAllFFNDictionaryHandler(req, res, next);
                break;
            case "actionExample":
                actionExampleHandler(req, res, next);
                break;
                // case "createTodo":
                //     createTodoHandler(req, res, next);
                //     break;
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

module.exports = router;
