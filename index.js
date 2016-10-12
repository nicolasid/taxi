var jsonfile = require('jsonfile')
var express = require('express');
var bodyParser = require('body-parser');
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
    var rendered = content.toString().replace('#routingOutput#', options.routingOutput).replace('#outputDetail#', options.outputDetail);
    return callback(null, rendered);
  });
});
app.set('views', './views'); // specify the views directory
app.set('view engine', 'ntl'); // register the template engine

var Routific = require("routific");
var token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJfaWQiOiI1NDFiNzU2MWZkMmJlMzA4MDAyY2VlYmIiLCJpYXQiOjE0MTEwODU2NjV9.5jb_61ykdHA2RyhfVWFMowb2oSB9gWAY4mPKHk1iCiI";

var client = new Routific.Client({token: token});
var defaultVrp = new Routific.Vrp();

var depot = null;
var problem = {};
problem.visits = [];
problem.fleet = [];

//Converter Class 
var Converter = require("csvtojson").Converter;
var converterVehicle = new Converter({});

// Mapping of location id to the latitude and longtitude
var locationMapping = {};

var defaultSolution = null;

function lookupAddress(latitude, longtitude) {
    var xmlHttp = new XMLHttpRequest();
    var urlRequest = "https://maps.googleapis.com/maps/api/geocode/json?key=AIzaSyDynHMnqFWU0O1dOK4UxMq1ChABmlh4Kfs&latlng=" + latitude + "," + longtitude;
    xmlHttp.open("GET", urlRequest, false);
    xmlHttp.send(null);
    var res = JSON.parse(xmlHttp.responseText);
    return res['results'][0]['formatted_address'];
}

function findBestRoute(vrp, outputMessage, response) {
        // console.log(JSON.stringify(vrp, null, 2));
    // write the input for the routing
    jsonfile.writeFile("routingInput.json", JSON.stringify(vrp, null, 2));

    console.log("Requesting the optimized route .....");
    /*
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open( "POST", "https://api.routific.com/v1/vrp", false ); // false for synchronous request
    xmlHttp.setRequestHeader("Content-Type", "application/json");
    xmlHttp.setRequestHeader("Authorization", "bearer " + token);
    xmlHttp.send( JSON.stringify(vrp, null, 2) );
    console.log("Status = " + xmlHttp.status);
    console.log("Response = " + xmlHttp.responseText);
    var solution = xmlHttp.responseText;
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
    */

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
        // assign the first solution found as default solution
        if (defaultSolution == null) {
            defaultSolution = solution;
        }
        // check if we need to send the result to the response
        if (response) {
            response.render('mapbox', { routingOutput: JSON.stringify(solution, null, 2), outputDetail: outputMessage});
        }
    });
}


//record_parsed will be emitted each csv row being processed
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
    defaultVrp.addVisit(new String(jsonObj['SG Postal Code']), order);
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
    defaultVrp.addVehicle(js['Vehicle'], vehicle);
    // console.log("Add vehicle " + vehicle.start_location);
});

// when parsing the vehicle finished then start the fleet data parsing
converterVehicle.on("end_parsed", function (jsonArray) {
    require("fs").createReadStream("./data/Fleet.csv").pipe(converterFleet);
});

// when fleet data parsing finished then call the Routific API
converterFleet.on("end_parsed", function (jsonArray) {
    console.log("Finish parsing data");
    // build default solution
    defaultVrp.addOption("traffic", "slow");
    findBestRoute(defaultVrp, "Route is generated based on default order time and traffic is slow", null);
    // define root handler
    app.get('/', function (req, res) {
        var outputMessage = "Route is generated based on default order time and traffic is slow";
        res.render('mapbox', { routingOutput: JSON.stringify(defaultSolution, null, 2), outputDetail: outputMessage});
    });
    app.post('/', function (req, res) {
        var vrp = new Routific.Vrp();
        vrp.data = JSON.parse(JSON.stringify(defaultVrp.data));
        var outputMessage = "Route is generated based on " + req.body.orderTime + " minute(s) order time and traffic is " + req.body.traffic;
        if (req.body.orderTime) {
            console.log("message = " + outputMessage);
            // update the order time based on input
            for (order in vrp.data.visits) {
                vrp.data.visits[order]['duration'] = req.body.orderTime;
            }
        } else {
            outputMessage = "Route is generated based on default order time and traffic is " + req.body.traffic;
        }
        vrp.addOption("traffic", req.body.traffic);    
        findBestRoute(vrp, outputMessage, res);
    });
});

