var cfenv = require("cfenv");
var watson = require('watson-developer-cloud');
var mydb;

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
