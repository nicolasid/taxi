/*
 * ==================================================================================================================
 *  Dynamic taxi surcharge
 *  - Read taxi data from the collected json
 *  - Create taxi data frame and filter taxi coordinate only for changi airport
 *  - Read flight data from the collected json
 *  - Create flight data frame and map the number of passengers with the predefined number
 *  - Read rainfall data from the collected json
 *  - Create rainfall data frame
 * ==================================================================================================================
 */



// ====================== Taxi Data ======================
// read all files in HDFS directory
val taxi = sc.wholeTextFiles("/project/taxi/")
// replace the new line with empty string
val taxi_no_newline = taxi.map(aTaxiFile => aTaxiFile._2.split("\n").mkString(""))
// read json and select the timestamp and coordinates value
var taxi_sql = sqlContext.read.json(taxi_no_newline).select($"features.properties.timestamp".getItem(0), $"features.geometry.coordinates".getItem(0))
// Spark 1.3: var taxi_sql = sqlContext.jsonRDD(taxi_no_newline).select($"features.properties.timestamp".getItem(0), $"features.geometry.coordinates".getItem(0))
// show the current data frame
taxi_sql.show
// create taxi dataframe from all coordinates
val taxidf = taxi_sql.flatMap(row => {
    var coordinateList :Array[(String, Double, Double)] = Array(("", 0.0,0.0))
    for (coor <- row.getAs[Seq[Seq[Double]]](1)) {
        coordinateList = (row.getString(0).split(":")(0), coor.apply(0), coor.apply(1)) +: coordinateList
    }
    coordinateList
  }).toDF("DateHour", "Longitude", "Latitude")

// show the first five row in data frame
taxidf.show

/***** Filter taxi in Changi Airport *****/
//Changi Coordinates:
//103.9800
//1.36622
//103.9937
//1.345411
val taxichangi = taxidf.filter(taxidf("Longitude") > 103.98).filter(taxidf("Longitude") < 103.9937).filter(
    taxidf("Latitude") > 1.345411).filter(taxidf("Latitude") < 1.36622)
taxichangi.show()

// Group number of taxi by hour
val taxicount = taxichangi.groupBy("DateHour").count().alias("nbTaxi")
taxicount.show()








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
flightdf.show()

// define function to determine flight arrival time
val extractArrivalTime = udf((gate: String, runway: String, published: String)
    => {
        var arrTime = ""
        if (gate != null) arrTime = gate
        else if (runway != null) arrTime = runway
        else arrTime = published
        var dateHour = arrTime.split(":")(0)
        dateHour
    })

// determine flight arrival time based on extractArrivalTime function
val flightdf_arrTime = flightdf.withColumn("arrivalTime", extractArrivalTime($"gateArrival", $"runwayArrival", $"publishedArrival")).select(
    flightdf.col("*"), $"arrivalTime".alias("arrivalDateHour")).na.fill("NA")

// show flight data frame after adding arrival time
flightdf_arrTime.show()

// read plane type to number of passenger mapping
import org.apache.spark.sql.types.{StructType,StructField,StringType,IntegerType};
import org.apache.spark.sql._

val csv = sc.textFile("/project/flightstats/planeType.csv")
val rows = csv.map(line => line.split(",").map(_.trim))
val header = rows.first
val data = rows.filter(_(0) != header(0))
val rdd = data.map(row => Row(row(0),row(1),row(2)))

val schema = new StructType().add(StructField("iataCode", StringType, true)).add(
    StructField("nbPassenger", StringType, true)).add(StructField("name", StringType, true))

val planeTypeDf = sqlContext.createDataFrame(rdd, schema).na.fill({"" => "NA"})
planeTypeDf.show()

/***** Get passenger number from the static mapping of plane type to passenger number ****/
val flightInfo = flightdf_arrTime.join(planeTypeDf, flightdf_arrTime("planeType") === planeTypeDf("iataCode"), "left_outer")
flightInfo.show
val passengerCount = flightInfo.groupBy("dateHour").sum("nbPassenger").alias("nbPassenger")
passengerCount.show









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
var rainfallMapped = rainfall_sql.flatMap(row => {
    var readingList :Array[(String, String, Double)] = Array(("", "", 0.0))
    for (reading <- row.getAs[Seq[Row]](1)) {
        readingList = (row.getString(0), reading.getString(0), reading.getDouble(1)) +: readingList
    }
    readingList
  }).toDF("Timestamp", "StationId", "Value")

// define function to parse timestamp
val expandTimestamp = udf((timestamp: String)
    => {
        var dateHour = timestamp.split(":")(0)
        dateHour
    })
val rainfalldf = rainfallMapped.withColumn("time", expandTimestamp($"Timestamp")).select(rainfallMapped.col("*"), $"time".alias("dateHour"))
// show data frame containing timestamp and rainfall reading
rainfalldf.show()

/***** Calculate Rainfall effect based on selected region *****/
/* S33 : west (Jurong Pier Road)
   S79 : south (Somerset Road)
   S29 : north (Pasir Ris Drive 12)
   S84 : east (Simei Avenue) */
val filteredRainfallDf = rainfalldf.filter($"StationId" === "S33" || $"StationId" === "S79" || $"StationId" === "S29" || $"StationId" === "S84")
val rainfallEffectDf = filteredRainfallDf.withColumn("Rain", when($"Value" === 0.0, 0).otherwise(1)).groupBy("dateHour").sum("Rain").alias("RainEffect")
rainfallEffectDf.show()










// ################################## Analytics Processing ##################################
// Merge the three data frame based on dateHour column
val mergedFlightRain = passengerCount.join(rainfallEffectDf, passengerCount("dateHour") === rainfallEffectDf("dateHour"))
val mergedAllDf = mergedFlightRain.join(taxicount, mergedFlightRain("dateHour") === taxicount("dateHour"))

// calculate surcharge
val surcharge = udf((nbTaxi: Int, nbPassenger: Int, rainEffect: Int)
    => {
        (nbPassenger / nbTaxi) * (1 + (rainEffect/4))
    })
val calculatedSurcharge = mergedAllDf.withColumn("Surcharge", surcharge($"nbTaxi", $"nbPassenger", $"RainEffect"))
calculatedSurcharge.show

// stored the calculate surchage data
calculatedSurcharge.saveAsTextFile("/project/surchage")





