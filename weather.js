
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
            done(err);
        } else {
            if (req.statusCode >= 200 && req.statusCode < 400) {
                try {
                    done(null, JSON.parse(data));
                } catch(e) {
                    console.log(e);
                    done(e);
                }
            } else {
                console.log(err);
                done({ message: req.statusCode, data: data });
            }
        }
    });
}

function getGeoCode(appEnv,queryString,done){
      var path = "/v3/location/search";
      var url = appEnv['weatherCompanyData'].url + path;
      var qs = {
        query : queryString,
        language: "en-US"
      }
      weatherAPI(path,queryString, function(data){

      });
}
