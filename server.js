var express = require("express");
var url = require("url");

var app = express.createServer();

var sendResponse = function(response, query, result) {
    response.writeHead(200, { "Content-Type": "text/plain"});
    if(query.callback) {
        response.write(query.callback + "(");
    }
    response.write(JSON.stringify(result));
    if(query.callback) {
        response.write(");");
    }
    response.end();
}

app.get("/request_one.json", function(request, response) {
    var query = url.parse(request.url, true).query;
    var result = {youSaid: query.say};
    sendResponse(response, query, result);
});


app.get('/question', function(request, response) {
    response.send('a question')
})

app.configure(function() {
    app.use(app.router);
    app.use(express.methodOverride());
    app.use(express.bodyDecoder());
    app.use(express.staticProvider("static"));
    app.use(express.errorHandler());
});

app.listen(3000);
