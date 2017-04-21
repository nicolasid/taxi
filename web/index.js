var jsonfile = require('jsonfile')
var express = require('express');
var bodyParser = require('body-parser');
var csvParser = require('csv-parse');
var fs = require('fs');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var app = express();

var server_port = process.env.OPENSHIFT_NODEJS_PORT || 8080
var server_ip_address = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1'

app.use(bodyParser.urlencoded({ extended: true }));
app.listen(server_port, server_ip_address, function () {
    console.log( "Listening on " + server_ip_address + ", port " + server_port )
});

var fs = require('fs'); // this engine requires the fs module
app.engine('ntl', function (filePath, options, callback) { // define the template engine
  fs.readFile(filePath, function (err, content) {
    if (err) return callback(new Error(err));
    // this is an extremely simple template engine
    var rendered = content.toString().replace('#routingOutput#', options.routingOutput).replace('#outputDetail#', options.outputDetail).replace('#jsonOutput#', options.jsonOutput).replace('#jsonInput#', options.jsonInput);
    return callback(null, rendered);
  });
});
app.set('views', './views'); // specify the views directory
app.set('view engine', 'ntl'); // register the template engine

function lookupAddress(latitude, longtitude) {
    var xmlHttp = new XMLHttpRequest();
    var urlRequest = "https://maps.googleapis.com/maps/api/geocode/json?key=AIzaSyDynHMnqFWU0O1dOK4UxMq1ChABmlh4Kfs&latlng=" + latitude + "," + longtitude;
    xmlHttp.open("GET", urlRequest, false);
    xmlHttp.send(null);
    var res = JSON.parse(xmlHttp.responseText);
    return res['results'][0]['formatted_address'];
}

// define root handler
app.get('/', function (req, res) {
    console.log("New request received on root path ...");
    res.render('mapbox');
});

function parseCSV(csvFile) {
    var csvData = [];
    csvParser(rawCsv, {delimiter: ','}
    ).on('data', function(csvrow) {
        csvData.push(csvrow);
    }).on('end',function() {
        return csvData;
    });
}

app.get('/getTaxiData', function (req, res) {
    var csvData = [];
    fs.createReadStream('/Users/nicolas/study/H1_2017/Big Data/CA/taxi_coordinates.csv')
        .pipe(csvParser({delimiter: ','}))
        .on('data', function (row) {
            console.log('Row: %s', row[0]);
            csvData.push(row[0]);})
        .on('end', function() {
            res.writeHead(200, { 'Content-Type': 'text/plain' }); 
            res.end(csvData.toString());
        });
});

/*
app.get('/getTaxiData', function (req, res) {
    console.log("New request received on /getTaxiData with parameter = " + req.query.timestamp);
    jsonfile.readFile("/Users/nicolas/study/H1_2017/Big Data/CA/taxi/" + req.query.timestamp + ".json", function(err, obj) {
        res.writeHead(200, { 'Content-Type': 'application/json' }); 
        res.end(JSON.stringify(obj));
        console.error(err);
    })
});
*/

// host static files
app.use('/static', express.static('public'));

app.get('/about', function (req, res) {
    console.log("New request received on /about");
    res.render('about');
});