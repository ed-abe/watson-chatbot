var express = require("express");
var app = express();
var cfenv = require("cfenv");
var watson = require('watson-developer-cloud');
var SlackBot = require('slackbots');
var https = require('https')
var WebClient = require('@slack/client').WebClient;

// load local VCAP configuration  and service credentials
var vcapLocal;
try {
  vcapLocal = require('./vcap-local.json');
  console.log("Loaded local VCAP", vcapLocal);
} catch (e) { }


const appEnvOpts = vcapLocal ? { vcap: vcapLocal} : {};
var appEnv;// = cfenv.getAppEnv(appEnvOpts);
var weather = require('./weather');

console.log("appEnv.services: ", appEnv);
var appServices = vcapLocal?vcapLocal:appEnv.services;

var web = new WebClient(process.env.slackbot_token||appServices.slackbot_token);
var conv_config = {
                      "username": (process.env.cusername||appServices.cusername),
                      "password": (process.env.cpassword||appServices.cpassword),
                      "version": "v1",
                      "version_date": "2017-02-03"
                    };

console.log("conv_config: ", conv_config);
var conversation = watson.conversation(conv_config);

// Replace with the context obtained from the initial request
var context = {};
console.log("Slack Token: "+(process.env.slackbot_token||appServices.slackbot_token)+ " Slack Bot Name"+ (process.env.slackbot_name||appServices.slackbot_name));
var bot = new SlackBot({
  "token": (process.env.slackbot_token||appServices.slackbot_token),
  "name": (process.env.slackbot_name||appServices.slackbot_name)
});
bot.on('start', function() {
    // more information about additional params https://api.slack.com/methods/chat.postMessage
    console.log("Slackbot up and running");
});

bot.on('message', function(data) {
    // all ingoing events https://api.slack.com/rtm
    switch (data.type) {
      case 'message':{
          console.log("Message Recieved Response: "+JSON.stringify(data,null, 4));
          if(data.channel && data.text && (!data.bot_id)){
            sendMessageToWatson(data.channel, data.text, function(msgData){
              if(context.location.length>0){

              }
              console.log("sendMessageToWatson userName: "+msgData.target+"text: "+msgData.message);
              for (var i = 0; i < msgData.message.length; i++) {
                  if (msgData.message[i].length>0) {
                    web.chat.postMessage(msgData.target, msgData.message[i],{"as_user":"true"} ,function(err, res) {
                        if (err) {
                          console.log("web.chat.postMessage Error: "+JSON.stringify(err,null, 4));
                        } else {
                          console.log("web.chat.postMessage Response: "+JSON.stringify(res,null, 4));
                        }
                    });
                  }
              }
              for (var text in msgData.message) {
              }
                // bot.postMessageToChannel(msgData.target, msgData.message,{"as_user":"true"}, function(data){
                //   console.log("bot.postMessageToUser Response: "+JSON.stringify(data,null, 4));
                // });
          });
        }
        break;
      }
      default:
        break;
    }
});

function sendMessageToWatson(userName, msg, callback){
  // Watson Conversation
  conversation.message({
    workspace_id: (process.env.conversation_workspace_id||appServices.conversation_workspace_id),
    input: {'text': msg},
    context: context
  },  function(err, response) {
    if (err)
    console.log('error:', err);
    else{
      console.log('sendMessageToWatson : Successful'+'\nResponse : '+JSON.stringify(response, null, 4));
      if(response.output.text && response.input.text){
        msgData = {
          "source": "Firebot",
          "message": response.output.text,
          "target": userName
        };
        context=response.context;
        if(callback){
          console.log('sendMessageToWatson : msgData'+JSON.stringify(msgData,null, 4));
          callback(msgData);
        } else {
          console.log("sendMessageToWatson : callback not available");
        }
      }
    }
  });
}
function getGeoCode(queryString){

}
 function messageIdGenerator(meta){
   return meta;
 }
