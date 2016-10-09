var jsonfile = require('jsonfile')
var express = require('express');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var app = express();

var server_port = process.env.OPENSHIFT_NODEJS_PORT || 8080
var server_ip_address = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1'
 
app.listen(server_port, server_ip_address, function () {
    console.log( "Listening on " + server_ip_address + ", port " + server_port )
});

var fs = require('fs'); // this engine requires the fs module
app.engine('ntl', function (filePath, options, callback) { // define the template engine
  fs.readFile(filePath, function (err, content) {
    if (err) return callback(new Error(err));
    // this is an extremely simple template engine
    var rendered = content.toString().replace('#routingOutput#', options.routingOutput);
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

var Routific = require("routific");
// Load the demo data. https://routific.com/demo.json
var data = require('./demo.json');
var token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJfaWQiOiI1NDFiNzU2MWZkMmJlMzA4MDAyY2VlYmIiLCJpYXQiOjE0MTEwODU2NjV9.5jb_61ykdHA2RyhfVWFMowb2oSB9gWAY4mPKHk1iCiI";

var client = new Routific.Client({token: token});
var vrp = new Routific.Vrp();

var depot = null;
var problem = {};
problem.visits = [];
problem.fleet = [];

//Converter Class 
var Converter = require("csvtojson").Converter;
var converterVehicle = new Converter({});

// Mapping of location id to the latitude and longtitude
var locationMapping = {};

//record_parsed will be emitted each csv row being processed 
var visits = {};
converterVehicle.on("record_parsed", function (jsonObj) {
    var order = {};
    order['location'] = {};
    order['location']['name'] = lookupAddress(jsonObj['Latitude'], jsonObj['Longtitude']);
    order['location']['lat'] = jsonObj['Latitude'];
    order['location']['lng'] = jsonObj['Longtitude'];
    if (jsonObj['Earliest']) order['start'] = jsonObj['Earliest'];
    if (jsonObj['Latest']) order['end'] = jsonObj['Latest'];
    order['duration'] = jsonObj['Duration'];
    if (depot == null) {
        depot = order['location'];
        depot['id'] = "depot";
        locationMapping['depot'] = { "lat" : jsonObj['Latitude'], "long" : jsonObj['Longtitude']};
    };
    // console.log("Add visit " + order['location']['name']);
    vrp.addVisit(new String(jsonObj['SG Postal Code']), order);
    problem.visits.push(order);
    locationMapping[jsonObj['SG Postal Code']] = { "lat" : jsonObj['Latitude'], "long" : jsonObj['Longtitude']};
});
require("fs").createReadStream("./data/vrptw_8.csv").pipe(converterVehicle);

var converterFleet = new Converter({});
//record_parsed will be emitted each csv row being processed 
converterFleet.on("record_parsed", function (js) {
    var vehicle = {};
    vehicle['start_location'] = depot;
    vehicle['end_location'] = depot;
    vehicle['shift_start'] = js['Shift start'];
    vehicle['shift_end'] = js['Shift end'];
    vehicle['capacity'] = js['Capacity'];
    problem.fleet.push(vehicle);
    vrp.addVehicle(js['Vehicle'], vehicle);
    // console.log("Add vehicle " + vehicle.start_location);
});

// when parsing the vehicle finished then start the fleet data parsing
converterVehicle.on("end_parsed", function (jsonArray) {
    require("fs").createReadStream("./data/Fleet.csv").pipe(converterFleet);
});

// when fleet data parsing finished then call the Routific API
converterFleet.on("end_parsed", function (jsonArray) {
    // console.log(JSON.stringify(vrp, null, 2));
    // write the input for the routing
    jsonfile.writeFile("routingInput.json", JSON.stringify(vrp, null, 2));

    console.log("Requesting the optimized route .....");
    // Process the route
    client.route(vrp, function(error, solution) {
        if (error) throw error
        for (driver in solution['solution']) {
            for (i in solution['solution'][driver]) {
                solution['solution'][driver][i]['geocode'] = [
                    locationMapping[solution['solution'][driver][i]['location_id']]['long'],
                    locationMapping[solution['solution'][driver][i]['location_id']]['lat']
                ];
            }
        }
        // write the solution from Routific
        jsonfile.writeFile("routingOutput.json", JSON.stringify(solution, null, 2));
        console.log("Optimization result = " + solution['status']);
        console.log("Total travel time = " + solution['total_travel_time']);

        // define root handler after finish querying the route
        app.get('/', function (req, res) {
            res.render('mapbox', { routingOutput: JSON.stringify(solution, null, 2)});
        });

    });
});

