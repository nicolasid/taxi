# -*- coding: utf-8 -*-
"""
Created on Sat Feb 25 22:13:40 2017

@author: Nicolas Andres A0135922H
"""

import requests
import json
import csv
from datetime import datetime
from datetime import timedelta



## ============================================================
# Collecting taxi availability data

# data.gov.sg API token
api_token ='q9uIgGTCfDJrlwHzaJkEPRGrKY1Y4q5i'
# base URL for taxi availability API
taxi_url = 'https://api.data.gov.sg/v1/transport/taxi-availability'

# starting time for collection
start_time = datetime(2017, 3, 10, 4, 50, 0)
# ending time for collection
end_time = datetime(2017, 3, 15, 23, 59, 0)

# time to query
query_time = start_time

with open('/home/training/project/taxi/taxi_count.csv', 'w') as taxiCountFile:
    writer = csv.writer(taxiCountFile, delimiter=',')
    writer.writerow(['timestamp', 'count'])
    while (query_time <= end_time):
        # build request URL
        request_url = taxi_url + '?date_time=' + query_time.strftime('%Y-%m-%dT%H:%M:%S')
        # send request to get taxi availability
        response = requests.get(request_url, headers = {'api-key' : api_token})
        if response.status_code != 200:
            print 'Failed request with response ' + response.text
            raise ValueError
        taxi_available = json.loads(response.text)
        with open('/home/training/project/taxi/' + query_time.strftime('%Y%m%d_%H%M%S') + '.json', 'w') as outputfile:
            json.dump(taxi_available, outputfile, indent=2)
        taxi_count = taxi_available['features'][0]['properties']['taxi_count']
        api_timestamp = taxi_available['features'][0]['properties']['timestamp']
        writer.writerow([api_timestamp, taxi_count])
        query_time = query_time + timedelta(minutes = 1)


## ============================================================
# Collecting weather information

# data.gov.sg API token
api_token ='q9uIgGTCfDJrlwHzaJkEPRGrKY1Y4q5i'
# base URL for taxi availability API
rainfall_url = 'https://api.data.gov.sg/v1/environment/rainfall'

# starting time for collection
start_time = datetime(2017, 2, 25, 8, 20, 0)
# ending time for collection
end_time = datetime(2017, 3, 4, 23, 59, 0)

# time to query
query_time = start_time

while (query_time <= end_time):
    # build request URL
    request_url = rainfall_url + '?date_time=' + query_time.strftime('%Y-%m-%dT%H:%M:%S')
    # send request to get taxi availability
    response = requests.get(request_url, headers = {'api-key' : api_token})
    if response.status_code != 200:
        print 'Failed request with response ' + response.text
        raise ValueError
    taxi_available = json.loads(response.text)
    with open('/home/training/project/rainfall/' + query_time.strftime('%Y%m%d_%H%M') + '.json', 'w') as outputfile:
        json.dump(taxi_available, outputfile, indent=2)    
    query_time = query_time + timedelta(minutes = 5)


## ============================================================ 

# Collecting flight data
app_key = 'a8ffcecb24b9986b71f57751c1621cc7'
app_id = 'a1cd95ee'
# starting time for flight collection
flight_start_time = datetime(2017, 3, 23, 0, 0, 0)
# ending time for flight collection
flight_end_time = datetime(2017, 3, 26, 23, 0, 0)
flight_query_time = flight_start_time

fligtstats_url = 'https://api.flightstats.com/flex/flightstatus/rest/v2/json/airport/status/SIN/arr/{0}/{1}/{2}/{3}'
#writer = csv.writer(flightCountFile, delimiter=',')
#writer.writerow(['carrier_code', 'flight_number', 'departure_airport',
#                 'departure_time', 'arrival_time', 'duration', 'arrival_terminal', 'airplane'])
while (flight_query_time <= flight_end_time):
    # build request URL
    request_url = fligtstats_url.format(flight_query_time.year, flight_query_time.month,
                                        flight_query_time.day, flight_query_time.hour)
    # send request to get taxi availability
    response = requests.get(request_url, params = {'appId' : app_id,
                                                   'appKey' : app_key,
                                                   'utc' : 'false', 'numHours' : 6 })
    if response.status_code != 200:
        print 'Failed request with response ' + response.text
        raise ValueError
    flight_data = json.loads(response.text)
    with open('/home/training/project/flightstats/' + flight_query_time.strftime('%Y%m%d_%H%M%S') + '.json', 'w') as outputfile:
        json.dump(flight_data, outputfile, indent=2)

    flight_query_time = flight_query_time + timedelta(hours = 6)

# Define function to extract one flight status on the JSON structure of flightstats
def extractFlightStatus(f_status):
    departure = ""
    if f_status['operationalTimes'].get('estimatedGateDeparture'):
        departure = f_status['operationalTimes']['estimatedGateDeparture']
    elif f_status.get('departureDate'):
        departure = f_status['departureDate']
    elif f_status['operationalTimes'].get('publishedDeparture'):
        departure = f_status['operationalTimes']['publishedDeparture']
    # remove the seconds and just use until minutes
    departure_time = departure['dateLocal'][:-6] + '00'

    arrival = ""
    if f_status['operationalTimes'].get('actualGateArrival'):
        arrival = f_status['operationalTimes']['actualGateArrival']
    elif f_status['operationalTimes'].get('actualRunwayArrival'):
        arrival = f_status['operationalTimes']['actualRunwayArrival']
    elif f_status['operationalTimes'].get('publishedArrival'):
        arrival = f_status['operationalTimes']['publishedArrival']
    # remove the seconds and just use until minutes
    arrival_time = arrival['dateLocal'][:-6] + '00'
    
    # get duration
    duration = ""
    if f_status.get('flightDurations'):
        if f_status['flightDurations'].get('scheduledBlockMinutes'):
            duration = f_status['flightDurations']['scheduledBlockMinutes']
        elif f_status['flightDurations'].get('scheduledAirMinutes'):
            duration = f_status['flightDurations']['scheduledAirMinutes']
    
    # get arrival terminal
    arrival_terminal = ""
    if f_status.get('airportResources') and f_status['airportResources'].get('arrivalTerminal'):
        arrival_terminal = f_status['airportResources']['arrivalTerminal']
    # get airplane model
    airplane = ""
    if f_status.get('flightEquipment'):
        if f_status['flightEquipment'].get('actualEquipmentIataCode'):
            airplane = f_status['flightEquipment']['actualEquipmentIataCode']
        elif f_status['flightEquipment'].get('scheduledEquipmentIataCode'):
            airplane = f_status['flightEquipment']['scheduledEquipmentIataCode']

    return [f_status['carrierFsCode'], f_status['flightNumber'], f_status['departureAirportFsCode'],
            departure_time, arrival_time, duration, arrival_terminal, airplane]

## Read all json flight data
from os import listdir
with open('/home/training/project/flight.csv', 'w') as flightCountFile:
    writer = csv.writer(flightCountFile, delimiter=',')
    writer.writerow(['carrier_code', 'flight_number', 'departure_airport',
                     'departure_time', 'arrival_time', 'duration', 'arrival_terminal', 'airplane'])
    dir_path = '/home/training/project/flightstats'
    for jsonFile in [f for f in listdir(dir_path) if f.endswith('.json')]:
        print('read: ' + jsonFile)
        with open(dir_path + '/' + jsonFile) as flight_sample:
            flight_data = json.load(flight_sample)
            for f_status in flight_data['flightStatuses']:
                # only extract flight that had landed
                if f_status['status'] == 'L':
                    writer.writerow(extractFlightStatus(f_status))