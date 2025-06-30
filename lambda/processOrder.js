const AWS = require("aws-sdk");
const ddb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

exports.handler = async (event) => {
  console.log("🚀 Received SQS Event:", JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    try {
      const order = JSON.parse(record.body);
      const { orderId } = order;

      console.log(`🔄 Processing order ${orderId}...`);
      await sleep(120000); // wait 2 minutes

      await ddb.update({
        TableName: TABLE_NAME,
        Key: { orderId },
        UpdateExpression: "set #st = :s",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: { ":s": "processed" }
      }).promise();

      console.log(`✅ Order ${orderId} status updated to 'processed'`);
    } catch (error) {
      console.error("❌ Error processing order:", error);
    }
  }
};