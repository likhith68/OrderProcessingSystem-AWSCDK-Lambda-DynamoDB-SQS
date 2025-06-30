const AWS = require('aws-sdk');

// Initialize AWS clients
const sqs = new AWS.SQS();
const ddb = new AWS.DynamoDB.DocumentClient();

// Read environment variables
const QUEUE_URL = process.env.QUEUE_URL;
const TABLE_NAME = process.env.TABLE_NAME;

// Basic UUID generator
const uuidv4 = () => 'order-' + Math.random().toString(36).substring(2, 15);

exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event));

  // Check if required env vars are present
  if (!QUEUE_URL || !TABLE_NAME) {
    console.error('Missing environment variables QUEUE_URL or TABLE_NAME');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Configuration error: Environment variables missing.' }),
    };
  }

  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    
    // Validate input
    const item = body.item?.trim();
    const quantity = parseInt(body.quantity, 10);

    if (!item || isNaN(quantity) || quantity <= 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid input. Provide valid item and quantity.' }),
      };
    }

    const orderId = uuidv4();
    const timestamp = new Date().toISOString();

    const order = {
      orderId,
      item,
      quantity,
      status: 'placed',
      placedAt: timestamp,
    };

    console.log('Generated order:', order);

    // 1. Send message to SQS
    await sqs.sendMessage({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify(order),
    }).promise();
    console.log('Message sent to SQS');

    // 2. Insert into DynamoDB
    await ddb.put({
      TableName: TABLE_NAME,
      Item: order,
    }).promise();
    console.log('Order saved to DynamoDB');

    // Success response
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Order placed!',
        orderId,
      }),
    };
  } catch (error) {
    console.error('Error placing order:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Order placement failed.' }),
    };
  }
};