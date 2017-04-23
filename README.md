# Implementation on Bluemix
![alt text](./resources/watson_conversations_icon.png)
Implementation of a chatbot with responses for Weather, Small Talk, etc as a SlackBot

# Setup
1. Setup new bot user in user slack team [here](https://my.slack.com/services/new/bot)
2. Create IBM Watson Conversation workspace [here](https://www.ibm.com/watson/developercloud/conversation.html)
3. Edit vcap-local-sample.json with above credentials from above steps and rename [vcap-local-sample.json](./vcap-local-sample.json) to vcap-local.json
4. Import workspace.json to Watson Conversation workspace

5. `$node server.js` to start the service
