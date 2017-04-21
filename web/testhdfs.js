/*var WebHDFS = require('webhdfs');
var hdfs = WebHDFS.createClient({
  host: '192.168.56.101',
  port: 50070,
  path: '/webhdfs/v1'
});
 
var remoteFileStream = hdfs.createReadStream('/loudacre/kb/KBDOC-00001.html');
 
remoteFileStream.on('error', function onError (err) {
    console.log("Error.." + err);
});
 
remoteFileStream.on('data', function onChunk (chunk) {
    console.log(chunk);
});
 
remoteFileStream.on('finish', function onFinish () {
    console.log("Finished");
});
*/

var csvParser = require('csv-parse');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var xmlHttp = new XMLHttpRequest();
var urlRequest = "http://192.168.56.101:50075/webhdfs/v1/user/training/user.csv?op=OPEN&namenoderpcaddress=localhost:8020&offset=0";
xmlHttp.open("GET", urlRequest, false);
xmlHttp.send(null);

var csvData = [];
csvParser(xmlHttp.responseText, {delimiter: ','}
    ).on('data', function(csvrow) {
        console.log(csvrow);
        //do something with csvrow
        csvData.push(csvrow);
    }).on('end',function() {
      //do something wiht csvData
      console.log(csvData);
    });
