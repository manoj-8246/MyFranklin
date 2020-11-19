const bodyParser = require('body-parser');
const express = require('express');
const taskRouter = express();



taskRouter.get('/', (req, res) => {
    // Basic index to verify app is serving
    res.send('Hello, World!').end();
});

module.exports = taskRouter;