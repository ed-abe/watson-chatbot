var express = require("express");
var app = express();
var cfenv = require("cfenv");
var bodyParser = require('body-parser')
var watson = require('watson-developer-cloud');

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

var mydb;

/* Endpoint to greet and add a new visitor to database.
* Send a POST request to localhost:3000/api/visitors with body
* {
* 	"name": "Bob"
* }
*/
app.post("/api/visitors", function (request, response) {
  var userName = request.body.name;
  if(!mydb) {
    console.log("No database.");
    response.send("Hello " + userName + "!");
    return;
  }
  // insert the username as a document
  mydb.insert({ "name" : userName }, function(err, body, header) {
    if (err) {
      return console.log('[mydb.insert] ', err.message);
    }
    response.send("Hello " + userName + "! I added you to the database.");
    const name = userName;
    sendMessageToWatson(name);
  });
});

/**
 * Endpoint to get a JSON array of all the visitors in the database
 * REST API example:
 * <code>
 * GET http://localhost:3000/api/visitors
 * </code>
 *
 * Response:
 * [ "Bob", "Jane" ]
 * @return An array of all the visitor names
 */
app.get("/api/visitors", function (request, response) {
  var names = [];
  if(!mydb) {
    response.json(names);
    return;
  }

  mydb.list({ include_docs: true }, function(err, body) {
    if (!err) {
      body.rows.forEach(function(row) {
        if(row.doc.name)
          names.push(row.doc.name);
      });
      response.json(names);
    }
  });
});


// load local VCAP configuration  and service credentials
var vcapLocal;
try {
  vcapLocal = require('./vcap-local.json');
  console.log("Loaded local VCAP", vcapLocal);
} catch (e) { }

const appEnvOpts = vcapLocal ? { vcap: vcapLocal} : {}

const appEnv = cfenv.getAppEnv(appEnvOpts);

if (appEnv.services['cloudantNoSQLDB']) {
  // Load the Cloudant library.
  var Cloudant = require('cloudant');

  // Initialize database with credentials
  var cloudant = Cloudant(appEnv.services['cloudantNoSQLDB'][0].credentials);

  //database name
  var dbName = 'mydb';

  // Create a new "mydb" database.
  cloudant.db.create(dbName, function(err, data) {
    if(!err){ //err if database doesn't already exists
      console.log("Created database: " + dbName);
    }
  });

  // Specify the database we are going to use (mydb)...
  mydb = cloudant.db.use(dbName);
}

//serve static file (index.html, images, css)
app.use(express.static(__dirname + '/views'));



var port = process.env.PORT || 3000
app.listen(port, function() {
    console.log("To view your app, open this link in your browser: http://localhost:" + port);
});

function sendMessageToWatson(userName){
  // Watson Conversation

  var conversation = watson.conversation(appEnv.services['watsonConversation'].firebot.loginInfo);


  // Replace with the context obtained from the initial request
  var context = {};
  conversation.message({
    workspace_id: '52dfc2e2-65c1-493e-82c6-0437bab278da', //firebot workspace_id
    input: {'text': 'Hello'},
    context: context
  },  function(err, response) {
    if (err)
      console.log('error:', err);
    else{
      console.log(JSON.stringify(response, null, 2));
      if(response.output.text && response.input.text){
        var dbEntry;
        mydb.get(userName, function(err, data) {
            console.log("Error:", err);
            console.log("Data:", data);
            if(data){
              var messageId1 = messageIdGenerator('brisinger6');
              var messageId2 = messageIdGenerator('eonet6');
              data.messages[messageId1] =   {
                                                "name" : "Firebot",
                                                "text" : JSON.stringify(response.output.text),
                                                "photoURL" : "placeholder-bot.png"
                                              };
              data.messages[messageId2] =  {
                                              "name" : userName,
                                              "text" : JSON.stringify(response.input.text),
                                              "photoURL" : "placeholder-user.png"
                                             };
              mydb.insert(data,userName, function(err, body, header) {
                if (err) {
                  return console.log('[mydb.insert] ', err.message);
                }
              });
            }
          });
      }
    }
  });
}
 function messageIdGenerator(meta){
   return meta;
 }
