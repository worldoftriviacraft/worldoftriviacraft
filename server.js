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

var maxMovies = 100;
var chunkSize = 100;
var movies = [];
var actors = [];
var directors = [];
var currentQueston = "";
var currentAnswers = [];

var freebase = http.createClient(80, "api.freebase.com");
var cursor = true;
var getNextMovie = null;
getNextMovie = function(perMovieCallback, endCallback) {
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
                "/film/film/directed_by": [],
                "/film/film/genre": [],
                "/film/film/starring": [
                    {
                        "/film/performance/actor": null,
                        "/film/performance/character": null
                    }
                ],
                "limit":         chunkSize
            }
        ]
    }

    var url = "/api/service/mqlread?query=";
    url += escape(JSON.stringify(params));
    console.log("Requesting movies");
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
            //console.log("Movie list response: " + fullResponse);
            var info = JSON.parse(fullResponse);
            cursor = info.cursor;
            if(info.result && info.result.length > 0 && perMovieCallback) {
                for(var cur in info.result) {
                    perMovieCallback(info.result[cur]);
                }
            }
            if(endCallback) {
                endCallback();
            }
        });
    });
}

var storeMovieDetails = null;
storeMovieDetails = function(info) {
    var details = {
                    id: info.id,
                    title: info.name,
                    year: info["/film/film/initial_release_date"],
                    director: null,
                    genre: null,
                    actors: [],
                    characters: []
                  };

    if(info["/film/film/genre"])
        details.genre = info["/film/film/genre"][0];
    if(info["/film/film/directed_by"])
        details.director = info["/film/film/directed_by"][0];

    var starInfo = info["/film/film/starring"];
    for(var curStar in starInfo) {
        var curDetails = starInfo[curStar];
        var actorName = null;
        var characterName = null;
        if(curDetails["/film/performance/actor"]) {
            actorName = curDetails["/film/performance/actor"];
        }
        if(curDetails["/film/performance/character"]) {
            characterName = curDetails["/film/performance/character"];
        }
        details.actors.push({actor: actorName, character: characterName});
        details.characters.push({actor: actorName, character: characterName});
    }

    console.log("Adding movie: " + details.title);
    movies.push(details);
}

var requestMoreMovies = null;
requestMoreMovies = function() {
    console.log("Have " + movies.length + " movies");
    if(movies.length < maxMovies) {
        setTimeout(function() {
            getNextMovie(storeMovieDetails, requestMoreMovies);
        }, 1000);
    }
}

getNextMovie(storeMovieDetails, requestMoreMovies);

app.get("/request_one.json", function(request, response) {
    var query = url.parse(request.url, true).query;
    var result = {youSaid: query.say};
    sendResponse(response, query, result);
});

function constructAnswers(question, realAnswer, alternates) {
    var realAnswerIndex = Math.floor(Math.random() * 4);

    for (var i = 0; i < 4; ++i) {
        if (i === realAnswerIndex) {
            question['answers'][i] = realAnswer;
        } else {
            if (alternates.length != 0) {
                question['answers'][i] = alternates[Math.floor(Math.random() * alternates.length)];
            } else {
                question['answers'][i] = "Beer is good";
            }
        }
    }
}

function constructQuestion() {
    if (movies.length != 0) {
        var movieIndex = Math.floor(Math.random() * movies.length);
        var info = movies[movieIndex];

        var questionIndex = Math.floor(Math.random() * 4 /* hardcoded */);
        var question = {'text': "", 'answers': []};
        console.log(questionIndex);
        switch(questionIndex) {
            case 0:
                    question['text'] = "When was " + info.title + " released?";

                    var realAnswerIndex = Math.floor(Math.random() * 4);
                    for (var i = 0; i < 4; ++i) {
                        var answer = 0;
                        if (i === realAnswerIndex) {
                            answer = info.year;
                        } else {
                            answer = 1980 + Math.floor(Math.random() * 20);
                        }
                        question['answers'][i] = answer;
                    }
                    break;
            case 1:
                    question['text'] = "Who directed the " + info.year + " " + info.genre + " movie?";
                    constructAnswers(question, info.director, directors);
                    break;
            case 2:
                    question['text'] = "Who starred in the " + info.year + " movie " + info.title + "?";
                    constructAnswers(question, info.actors[0].actor, actors);
                    break;
            case 3:
                    question['text'] = "Who played " + info.characters[0].character + " in " + info.title + "?";
                    constructAnswers(question, info.actors[0].actor, actors);
                    break;
        }

        return question;
    } else {
        return {'text': "I'm drunk - are you?", answers:['yes', 'no']};
    }
}

app.get('/question', function(request, response) {
    var question = constructQuestion();
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
