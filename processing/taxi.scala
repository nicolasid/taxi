hdfs dfs -put taxi /project/

// read all files in HDFS directory
val taxi = sc.wholeTextFiles("/user/training")
// replace the new line with empty string
val taxi_no_newline = taxi.map(aTaxiFile => aTaxiFile._2.split("\n").mkString(""))
// read json and select the timestamp and coordinates value
// Spark 1.6.1: var taxi_sql = sqlContext.read.json(taxi_no_newline).select($"features.properties.timestamp".getItem(0), $"features.geometry.coordinates".getItem(0))
var taxi_sql = sqlContext.jsonRDD(taxi_no_newline).select($"features.properties.timestamp".getItem(0), $"features.geometry.coordinates".getItem(0))
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