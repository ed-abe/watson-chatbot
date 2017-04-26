
var request = require('request');

function weatherAPI(path, qs, done) {
    console.log(url, qs);
    request({
        url: url,
        method: "GET",
        headers: {
            "Content-Type": "application/json;charset=utf-8",
            "Accept": "application/json"
        },
        qs: qs
    }, function(err, req, data) {
        if (err) {
            done(err,null);
        } else {
            if (req.statusCode >= 200 && req.statusCode < 400) {
                try {
                    done(null, JSON.parse(data));
                } catch(e) {
                    console.log(e);
                    done(e,null);
                }
            } else {
                console.log(err);
                done({ message: req.statusCode, data: data },null);
            }
        }
    });
}

function getGeoCode(appEnv,queryString,done){
      var path = "/v3/location/search";
      var url = appEnv['weatherinsights'].credentials.url + path;
      var qs = {
        query : queryString,
        language: "en-US"
      }
      weatherAPI(path,queryString, function(err,data){
        if(data)
          done(data.location);
      });
}
//
// curl -X GET --header 'Accept: application/json' 'https://54276f1d-e0c8-4566-bff4-83d248ba1557:ufnW5g9QqK@twcservice.mybluemix.net/api/weather/v1/geocode/47.283/-120.76/forecast/hourly/48hour.json'
//
function getWeather(appEnv,lat,lon,done){
      var path1 = "v1/geocode/"+lat+"/"+lon+"/forecast/hourly/48hour.json";
      var url = appEnv['weatherinsights'].credentials.url + path;
      var qs = {
        query : queryString,
        language: "en-US"
      }
      weatherAPI(path,queryString, function(err,data){
        if(data)
          done(data.forecasts[0].phrase_32char+"with Temperature "+data.forecasts[0].temp);
      });
}
