// backend/src/services/twilioService.js
const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function makePhoneCall(from, to) {
  return await client.calls.create({
    twiml: '<Response><Say>Hello from DeepSeek Messenger!</Say></Response>',
    to: to,
    from: from
  });
}