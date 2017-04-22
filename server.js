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

const appEnvOpts = vcapLocal ? { vcap: vcapLocal} : {}
const appEnv = cfenv.getAppEnv(appEnvOpts);

var token = process.env.SLACK_API_TOKEN || appEnv.services['slackbot'].token; //see section above on sensitive data

var web = new WebClient(token);

var conversation = watson.conversation(appEnv.services['watsonConversation'].firebot.loginInfo);

// Replace with the context obtained from the initial request
var context = {};

var bot = new SlackBot(appEnv.services['slackbot']);
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
    workspace_id: appEnv.services['watsonConversation'].firebot.workspace_id, //firebot workspace_id
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

 function messageIdGenerator(meta){
   return meta;
 }
