#!/bin/sh
# Start taxi data ingestion using flume in background
nohup flume-ng agent --conf-file taxi.conf --name agentTaxi -Dflume.root.logger=INFO,console &

# Start flight data ingestion using flume in background
nohup flume-ng agent --conf-file flightstats.conf --name agentFlightstats -Dflume.root.logger=INFO,console &

# Start rainfall data ingestion using flume in background
nohup flume-ng agent --conf-file rainfall.conf --name agentRainfall -Dflume.root.logger=INFO,console &