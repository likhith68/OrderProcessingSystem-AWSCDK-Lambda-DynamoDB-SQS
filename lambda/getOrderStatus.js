const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.TABLE_NAME;

exports.handler = async (event) => {
  console.log("Incoming event:", JSON.stringify(event));

  const orderId = event.pathParameters?.orderId;

  if (!orderId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing orderId in path' }),
    };
  }

  try {
    const response = await ddb.get({
      TableName: TABLE_NAME,
      Key: { orderId },
    }).promise();

    if (!response.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Order not found for ID: ' + orderId }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        orderId: response.Item.orderId,
        status: response.Item.status,
        placedAt: response.Item.placedAt,
        item: response.Item.item,
        quantity: response.Item.quantity
      }),
    };
  } catch (err) {
    console.error('DynamoDB error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error', error: err.message }),
    };
  }
};