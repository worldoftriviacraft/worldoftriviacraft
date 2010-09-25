var express = require("express");
var querystring = require("querystring");
var http = require('http');
var url = require("url");
var io = require("./static/libs/socketio");

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

var currentQuestion = "";
var currentCountdown = "";

var freebase = http.createClient(80, "api.freebase.com");
var cursor = true;
var getNextMovie = function(callback) {
    var params = {
        "cursor": cursor,
        "query":[
            {
                "type":          "/film/film",
                "a:initial_release_date>=": "1980",
                "a:initial_release_date<=": "2010",
                "a:/film/film/country": "United States of America",
                "a:/film/film/rating<=": "S",
                "sort":          "-/film/film/initial_release_date",
                "name":          null,
                "id":            null,
                "/film/film/initial_release_date": null,
                "/film/film/directed_by": null,
                "/film/film/genre": null,
                "/film/film/starring": [],
                "limit":         1
            }
        ]
    }

    var url = "/api/service/mqlread?query=";
    url += escape(JSON.stringify(params));
    var request = freebase.request("GET", url);
    request.end();
    request.on("response", function(response) {
        console.log("Movie list request status: " + response.statusCode);
        response.setEncoding('utf8');
        var fullResponse = "";
        response.on("data", function(chunk) {
            fullResponse += chunk;
        });
        response.on("end", function() {
            console.log("Movie list response: " + fullResponse);
            var info = JSON.parse(fullResponse);
            cursor = info.cursor;
            if(callback) {
                callback(info);
            }
        });
    });
}

var getMovieDetails = function(info, callback) {
    var details = {
                    id: info.id,
                    title: info.name,
                    year: info["/film/film/initial_release_date"],
                    director: info["/film/film/directed_by"],
                    genre: info["/film/film/genre"]
                  };
    var url = "http://www.freebase.com/experimental/topic/standard?id=";
    url += escape(info.id);

    var request = freebase.request("GET", url);
    request.end();
    request.on("response", function(response) {
        console.log("Movie details request status: " + response.statusCode);
        response.setEncoding('utf8');
        var fullResponse = "";
        response.on("data", function(chunk) {
            fullResponse += chunk;
        });
        response.on("end", function() {
            console.log("Movie details response: " + fullResponse);
            var details = JSON.parse(fullResponse);
            if(callback) {
                callback(info);
            }
        });
    });
}

getNextMovie();

app.get("/request_one.json", function(request, response) {
    var query = url.parse(request.url, true).query;
    var result = {youSaid: query.say};
    sendResponse(response, query, result);
});


app.get('/question', function(request, response) {
    var question = {'text': 'a question', answers:['answer1', 'answer2']};
    response.send(JSON.stringify(question));
});

app.configure(function() {
    app.use(app.router);
    app.use(express.methodOverride());
    app.use(express.bodyDecoder());
    app.use(express.staticProvider("static"));
    app.use(express.errorHandler());
});

app.listen(3000);
