/*
 * ==================================================================================================================
 *  Dynamic taxi surcharge
 *  - Read taxi data from the collected json
 *  - Create data fram and filter taxi coordinate only for changi airport
 * ==================================================================================================================
 */

// hdfs dfs -put taxi /project/

// read all files in HDFS directory
val taxi = sc.wholeTextFiles("/user/training/")
// replace the new line with empty string
val taxi_no_newline = taxi.map(aTaxiFile => aTaxiFile._2.split("\n").mkString(""))
// read json and select the timestamp and coordinates value
var taxi_sql = sqlContext.read.json(taxi_no_newline).select($"features.properties.timestamp".getItem(0), $"features.geometry.coordinates".getItem(0))
// Spark 1.3: var taxi_sql = sqlContext.jsonRDD(taxi_no_newline).select($"features.properties.timestamp".getItem(0), $"features.geometry.coordinates".getItem(0))
// show the current data frame
taxi_sql.take(2)
// create taxi dataframe from all coordinates
val taxidf = taxi_sql.flatMap(row => {
    var coordinateList :Array[(String, Double, Double)] = Array(("", 0.0,0.0))
    for (coor <- row.getAs[Seq[Seq[Double]]](1)) {
        coordinateList = (row.getString(0), coor.apply(0), coor.apply(1)) +: coordinateList
    }
    coordinateList
  }).toDF("Timestamp", "Longitude", "Latitude")

// show the first five row in data frame
taxidf.take(5)


//Changi Coordinates:
//103.9800
//1.36622
//103.9937
//1.345411


val taxichangi = taxidf.filter(taxidf("Longitude") > 103.98).filter(taxidf("Longitude") < 103.9937).
filter(taxidf("Latitude") > 1.345411).filter(taxidf("Latitude") < 1.36622
taxichangi.show()

val taxicount = taxichangi.groupBy("Timestamp").count()






// ====================== Flight Data ======================
// read all files in HDFS directory
val flight = sc.wholeTextFiles("/project/flightstats")
// replace the new line with empty string
val flight_no_newline = flight.map(aFlightFile => aFlightFile._2.split("\n").mkString(""))
// read json and select the timestamp and arrival time
var flight_sql = sqlContext.read.json(flight_no_newline).select(
    $"flightStatuses.carrierFsCode".alias("carrierCode"),
    $"flightStatuses.flightNumber".alias("flightNumber"),
    $"flightStatuses.flightEquipment.scheduledEquipmentIataCode".alias("planeType"),
    $"flightStatuses.operationalTimes.actualGateArrival.dateLocal".alias("gateArrival"),
    $"flightStatuses.operationalTimes.actualRunwayArrival.dateLocal".alias("runwayArrival"),
    $"flightStatuses.operationalTimes.publishedArrival.dateLocal".alias("publishedArrival"))
// show the current data frame
flight_sql.show()
// define column zipping function
val zipColumns = udf((col1: Seq[String], col2: Seq[String], col3: Seq[String], col4: Seq[String], col5: Seq[String], col6: Seq[String])
    => (col1.zip(col2).zip(col3).zip(col4).zip(col5).zip(col6)) map {
  case (((((c1,c2),c3),c4),c5),c6) => (c1,c2,c3,c4,c5,c6)
})

// create flight dataframe
var flightdf = flight_sql.withColumn("columns", explode(zipColumns($"carrierCode", $"flightNumber", $"planeType", $"gateArrival", $"runwayArrival",
    $"publishedArrival"))).select($"columns._1".alias("carrierCode"), $"columns._2".alias("flightNumber"),  $"columns._3".alias("planeType"),
    $"columns._4".alias("gateArrival"), $"columns._5".alias("runwayArrival"), $"columns._6".alias("publishedArrival"))

// show flight data frame
flightdf.take(5)

// define function to determine flight arrival time
val extractArrivalTime = udf((gate: String, runway: String, published: String)
    => {
        var arrTime = ""
        if (gate != null) arrTime = gate
        else if (runway != null) arrTime = runway
        else arrTime = published
        var date = arrTime.split("T")(0)
        var hour = arrTime.split("T")(1).split(":")(0)
        var minute = arrTime.split("T")(1).split(":")(1)
        (date, hour, minute)
    })

// determine flight arrival time based on extractArrivalTime function
val flightdf_arrTime = flightdf.withColumn("arrivalTime", extractArrivalTime($"gateArrival", $"runwayArrival", $"publishedArrival")).select(
    flightdf.col("*"), $"arrivalTime._1".alias("arrivalDate"), $"arrivalTime._2".alias("arrivalHour"), $"arrivalTime._3".alias("arrivalMinute")).show()



// ====================== Rainfall Data ======================
import org.apache.spark.sql._
// read all files in HDFS directory
val rainfall = sc.wholeTextFiles("/project/rainfall")
// replace the new line with empty string
val rainfall_no_newline = rainfall.map(aRainfallFile => aRainfallFile._2.split("\n").mkString(""))
// read json and select the timestamp and coordinates value
val rainfall_sql = sqlContext.read.json(rainfall_no_newline).select($"items.timestamp".getItem(0), $"items.readings".getItem(0))
// show current content of rainfall_sql
rainfall_sql.show()
// create rainfall dataframe by flattening the dataframe
var rainfalldf = rainfall_sql.flatMap(row => {
    var readingList :Array[(String, String, Double)] = Array(("", "", 0.0))
    for (reading <- row.getAs[Seq[Row]](1)) {
        readingList = (row.getString(0), reading.getString(0), reading.getDouble(1)) +: readingList
    }
    readingList
  }).toDF("Timestamp", "StationId", "Value")

// define function to parse timestamp
val expandTimestamp = udf((timestamp: String)
    => {
        var date = timestamp.split("T")(0)
        var hour = timestamp.split("T")(1).split(":")(0)
        var minute = timestamp.split("T")(1).split(":")(1)
        (date, hour, minute)
    })
rainfalldf = rainfalldf.withColumn("time", expandTimestamp($"Timestamp")).select(rainfalldf.col("*"), $"time._1".alias("Date"),
    $"time._2".alias("Hour"), $"time._3".alias("Minute"))
// show data frame containing timestamp and rainfall reading
rainfalldf.show()


