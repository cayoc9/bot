const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');


// Create a new client instance
const client = new Client();


// When the client is ready, run this code (only once)
client.once('ready', () => {
   console.log('Client is ready!');
});


client.on('qr', qr => {
   qrcode.generate(qr, {small: true});
});


// When the client received QR-Code
client.on('qr', (qr) => {
   console.log('QR RECEIVED', qr);
});


client.on('message_create', async message => {
   if (!message.fromMe) {
       try {
           // Send the user's message as a prompt to the API
           const response = await axios.post('http://192.168.1.9:11434/api/generate', {
               model: 'llama3.1',
               prompt: message.body,
               stream: false,
               context: [1, 2, 3, 4, 5]
           });


           // Extract the response from the API
           const aiResponse = response.data.response;
           console.log(typeof aiResponse);
           // Reply back to the user with the AI's response
           message.reply(aiResponse);
       } catch (error) {
           console.error('Error calling the API:', error);
           message.reply('Sorry, there was an error processing your request.');
       }
   }
});




// Start your client
client.initialize();

