
/**
* Module dependencies.
*/

var express = require('express')
, routes = require('./routes')
, user = require('./routes/user')
, chat = require('./routes/chat')
, socketio = require('socket.io')
, http = require('http')
, path = require('path');

var app = express();

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

app.get('/', routes.index);
app.get('/chat', chat.main);
app.get('/users', user.list);

var server = app.listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});

var io = socketio.listen(server);

var clients = {};
var socketsOfClients = {};

var cfenv = require("cfenv");
var watson = require('watson-developer-cloud');

// load local VCAP configuration  and service credentials
var vcapLocal;
try {
  vcapLocal = require('./vcap-local.json');
  console.log("Loaded local VCAP", vcapLocal);
} catch (e)
{

}

const appEnvOpts = vcapLocal ? { vcap: vcapLocal} : {}

const appEnv = cfenv.getAppEnv(appEnvOpts);



io.sockets.on('connection', function(socket) {
  socket.on('set username', function(userName) {
    // Is this an existing user name?
    if (clients[userName] === undefined) {
      // Does not exist ... so, proceed
      clients[userName] = socket.id;
      socketsOfClients[socket.id] = userName;
      userNameAvailable(socket.id, userName);
      userJoined(userName);
    } else
    if (clients[userName] === socket.id) {
      // Ignore for now
    } else {
      userNameAlreadyInUse(socket.id, userName);
    }
  });

  socket.on('message', function(msg) {

    console.log("app.js : socket.on('message')");
    var srcUser;
    if (msg.inferSrcUser) {
      // Infer user name based on the socket id
      srcUser = socketsOfClients[socket.id];
    } else {
      srcUser = msg.source;
    }
    if (msg.target == "firebot") {
      io.sockets.sockets[clients[srcUser]].emit('message',
          {"source": srcUser,
           "message": msg.message,
           "target": msg.target});
        console.log("app.js : watsonServer.sendMessageToWatson to be called ");
        sendMessageToWatson(srcUser, msg.message, io);
    }
  })

  socket.on('disconnect', function() {
    var uName = socketsOfClients[socket.id];
    delete socketsOfClients[socket.id];
    delete clients[uName];
    // relay this message to all the clients
    userLeft(uName);
  })
})

function userJoined(uName) {
  Object.keys(socketsOfClients).forEach(function(sId) {
    io.sockets.sockets[sId].emit('userJoined', {
      "userName": uName
    });
    sendWelcomeMessage(sId,uName);
  })
}

function userLeft(uName) {
  io.sockets.emit('userLeft', {
    "userName": uName
  });
}

function userNameAvailable(sId, uName) {
  setTimeout(function() {
    console.log('Sending welcome msg to ' + uName + ' at ' + sId);

    io.sockets.sockets[sId].emit('welcome', {
      "userName" : uName, "currentUsers": JSON.stringify(Object.keys(clients))
    });
  }, 500);
}

function userNameAlreadyInUse(sId, uName) {
  setTimeout(function() {
    io.sockets.sockets[sId].emit('error', {
      "userNameInUse" : true
    });
  }, 500);
}
function sendWelcomeMessage(sId,uName){

    console.log('Sending Firebot welcome msg to ' + uName + ' at ' + sId);
    io.sockets.sockets[clients[uName]].emit('message',  {
                                                          "source": "Firebot",
                                                          "message": "Hi I am Firebot, A Watson Conversation enabled chat bot",
                                                          "target": uName
                                                        });
}
function sendMessageToWatson(userName, msg, io){
  // Watson Conversation

  var conversation = watson.conversation(appEnv.services['watsonConversation'].firebot.loginInfo);

  // Replace with the context obtained from the initial request
  var context = {};
  conversation.message({
    workspace_id: '52dfc2e2-65c1-493e-82c6-0437bab278da', //firebot workspace_id
    input: {'text': msg},
    context: context
  },  function(err, response) {
    if (err)
    console.log('error:', err);
    else{
      console.log('sendMessageToWatson : Successful');//+'\nResponse : '+JSON.stringify(response, null, 2));
      if(response.output.text && response.input.text){
        msgData = {
          "source": "Firebot",
          "message": response.output.text,
          "target": userName
        };
        if(io){
          io.sockets.sockets[clients[userName]].emit('message',msgData);
        }
        else {
          console.log("sendMessageToWatson : socket not accesible"+"\nio :"+io);
        }
      }
    }
  });
}
