const mysql = require('mysql');

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

mysqlConfig.socketPath = `/cloudsql/${connectionName}`;

let mysqlPool = mysql.createPool(mysqlConfig);

exports.saveBookData = function (slackUserId, bookId, title, author, language, fileSize, extension, download, bookImage) {

    if (!mysqlPool) {
        mysqlPool = mysql.createPool(mysqlConfig);
    }

    mysqlPool.query('INSERT into `ebooks` (slack_id,book_id,title,author,language,`file_size`,extension,download,`book_image`) VALUES ("' + slackUserId + '","' + bookId + '","' + title + '","' + author + '","' + language + '","' + fileSize + '","' + extension + '","' + download + '","' + bookImage + '") ON DUPLICATE KEY UPDATE title="' + title + '"', (err, results) => {
        if (err) {
            console.log("Unable to add book item to ebooks for " + slackUserId + " Error: " + err);
        }
    });
}

exports.logError = function (error, slackUser, intent, function_name) {
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

module.exports = mysqlPool;
