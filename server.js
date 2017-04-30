var express = require("express");
var app = express();
var cfenv = require("cfenv");
var watson = require('watson-developer-cloud');
var SlackBot = require('slackbots');
var https = require('https')
var WebClient = require('@slack/client').WebClient;
var request = require('request');

// load local VCAP configuration  and service credentials
var vcapLocal;
try {
  vcapLocal = require('./vcap-local.json');
  // console.log("Loaded local VCAP", vcapLocal);
} catch (e) {}

// FIXME: IBM Watson Deployment
const appEnvOpts = vcapLocal ? { vcap: vcapLocal } : {};
var appEnv; // = cfenv.getAppEnv(appEnvOpts);
// var weather = require('./weather');

// console.log("appEnv.services: ", appEnv);
var appServices = vcapLocal ? vcapLocal : appEnv.services;

var conv_config = {
  "username": (process.env.cusername || appServices.cusername),
  "password": (process.env.cpassword || appServices.cpassword),
  "version": "v1",
  "version_date": "2017-02-03"
};
var conversation = watson.conversation(conv_config);

// Replace with the context obtained from the initial request
var bot = new SlackBot({
  "token": (process.env.slackbot_token || appServices.slackbot_token),
  "name": (process.env.slackbot_name || appServices.slackbot_name)
});
var contexts = {};

var slackWebClient = new WebClient(process.env.slackbot_token || appServices.slackbot_token);
// Slackbot Socket.io callbacks
// 'start' : Slackbot has started up
bot.on('start', function() {
  // more information about additional params https://api.slack.com/methods/chat.postMessage
  console.log("Slackbot up and running");
});

// 'message' : Slackbot has recieved a message regarding an activity
bot.on('message', function(data) {
  // all ingoing events https://api.slack.com/rtm
  switch (data.type) {
    // 'message' : Slackbot has recieved a message from user
    case 'message':
      {
        console.log("SlackBot.on('message') : message Recieved Response: " + JSON.stringify(data, null, 4));
        if (data.channel && data.text && (!data.bot_id)) {
          if (data.text == ":clear") {
            contexts = {};
            data.text = "";
            console.log(":clear Context cleared");
          }
          sendMessageToWatson(data.channel, data.text);
        }
        break;
      }
    default:
      console.log("SlackBot.on('message') of type "+data.type);
      break;
  }
});

/**
 * Sends Message to Slack
 * @param  {string} target  [channel ID/Name of Target]
 * @param  {string} message [message string]
 * @param  {json} options [default]
 */
function sendMessageToSlack(target, message, options) {
  if(!options){
    options={ "as_user" : "true" };
  }
  slackWebClient.chat.postMessage(target, message, options, function(err, res) {
    if (err) {
      console.log("web.chat.postMessage Error: " + JSON.stringify(err, null, 4));
    } else {
      console.log("web.chat.postMessage Response: " + JSON.stringify(res, null, 4));
    }
  });
}

/**
 * sendMessageToWatson : handles sending message to Watson Conversation and it also handles its response to user
 * @param  {string}   userName [slack channel ID/Name]
 * @param  {string}   msg      [message text]
 * @param  {Function} callback [completion callback]
 * @return {[type]}            [description]
 */
function sendMessageToWatson(channelID, msg, callback) {
  // Watson Conversation
  console.log("About to sendMessageToWatson name: " + channelID + " msg: " + msg);
  conversation.message({
    workspace_id: (process.env.conversation_workspace_id || appServices.conversation_workspace_id),
    input: {
      'text': msg
    },
    //TODO: context retrieval for user
    context: contexts[channelID]
  }, function(err, response) {
    if (err)
      console.log('error:', err);
    else {
      console.log('sendMessageToWatson : Successful' + '\nResponse : ' + JSON.stringify(response, null, 4));
      if (response.output.text) {
        msgData = {
          "source": "Firebot",
          "message": response.output.text,
          "target": channelID
        };
        updateContext(response.context, channelID);
        if (callback) {
          console.log('sendMessageToWatson : msgData' + JSON.stringify(msgData, null, 4));
          callback(msgData);
        } else {
          console.log("sendMessageToWatson : reporting to messageSentToWatson");
          messageSentToWatson(msgData);
        }
      }
    }
  });
}
function updateContext(c, channelID){
  if(c.weather)
    delete c.weather;
    contexts[channelID] = c;
}
// messageSentToWatson : Callback of sending message to Watson Conversation
function messageSentToWatson(msgData) {
  if (contexts[msgData.target].location && contexts[msgData.target].location.length > 0) {
    handleWeather(contexts[msgData.target].location, msgData);
  } else {
    console.log("sendMessageToWatson userName: " + msgData.target + "text: " + msgData.message);
    for (var i = 0; i < msgData.message.length; i++) {
      if (msgData.message[i].length > 0) {
        setTimeout(sendMessageToSlack,i*1000,msgData.target, msgData.message[i]);
      }
    }
  }
}

function handleWeather(location, msgData) {
  //TODO: Handle weather as an object
  console.log("About to get location");
  getGeoCode((process.env || appServices), contexts[msgData.target].location, function(data) {
    if (data.latitude[0] && data.longitude[0]) {
      //TODO: Handle Multiple Locations
      console.log("Location identified Lat:" + data.latitude[0] + " Lon" + data.longitude[0]);
      console.log("About to get weather");
      getWeather((process.env || appServices), data.latitude[0], data.longitude[0], function(weatherData) {
        var text = "";
        if (!weatherData) {
          text = ("Couldn't get weather at" + weatherData.address[0]);
          console.log("Couldn't get weather");
          sendMessageToSlack(msgData.target, text);
        } else {
          delete contexts[msgData.target].location;
          contexts[msgData.target].weather = weatherData;
        }
        sendMessageToWatson(msgData.target, text);
      });
    } else {
      console.log("Couldn't find location");
      sendMessageToSlack(msgData.target, "Couldn't find location");
    }
  });
}

function weatherAPI(res, done) {
  console.log(res);
  request(res, function(err, req, data) {
    console.log('req:' + JSON.stringify(req, null, 4));
    if (err) {
      done(err, null);
    } else {
      if (req.statusCode >= 200 && req.statusCode < 400) {
        try {
          done(null, JSON.parse(data));
        } catch (e) {
          console.log(e);
          done(e, null);
        }
      } else {
        console.log(err);
        done({
          message: req.statusCode,
          data: data
        }, null);
      }
    }
  });
}

function getGeoCode(appEnv, queryString, done) {
  var path = "v3/location/search"; //?query="+queryString+"&language=en-US"
  var url = appServices.weatherinsightsURL + path;
  console.log('url:' + url);
  var qs = {
    query: queryString,
    language: "en-US"
  }
  var res = {
    url: url,
    method: "GET",
    headers: {
      "Accept": "application/json"
    },
    qs: qs
  }
  weatherAPI(res, function(err, data) {
    console.log('url:' + url + ' response:' + JSON.stringify(data, null, 4));
    if (data)
      done(data.location);
  });
}

//
// curl -X GET --header 'Accept: application/json' 'https://54276f1d-e0c8-4566-bff4-83d248ba1557:ufnW5g9QqK@twcservice.mybluemix.net/api/weather/v1/geocode/47.283/-120.76/forecast/hourly/48hour.json'
//
function getWeather(appEnv, lat, lon, done) {
  var path = "v1/geocode/" + lat + "/" + lon + "/forecast/hourly/48hour.json";
  var url = appServices.weatherinsightsURL + path;
  console.log('url:' + url);
  var res = {
    url: url,
    method: "GET",
    headers: {
      "Accept": "application/json"
    }
  }
  weatherAPI(res, function(err, data) {
    console.log('url:' + url + ' response:' + JSON.stringify(data, null, 4));
    if (data)
      done(data.forecasts[0].phrase_32char + " with Temperature " + data.forecasts[0].temp);
  });
}

function messageIdGenerator(meta) {
  return meta;
}
