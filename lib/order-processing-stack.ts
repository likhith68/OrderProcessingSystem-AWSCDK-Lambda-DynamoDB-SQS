import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';

export class OrderProcessingStack extends cdk.Stack {
  public readonly orderQueue: sqs.Queue;
  public readonly orderTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 🔸 SQS queue
    this.orderQueue = new sqs.Queue(this, 'OrderQueue', {
      queueName: 'order-queue',
      visibilityTimeout: cdk.Duration.minutes(3),
      receiveMessageWaitTime: cdk.Duration.seconds(20),
    });

    // 🔸 DynamoDB table
    this.orderTable = new dynamodb.Table(this, 'OrderTable', {
      tableName: 'order-table',
      partitionKey: { name: 'orderId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 🔸 Lambda: Place Order
    const placeOrderLambda = new NodejsFunction(this, 'PlaceOrderLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../lambda/placeOrder.js'),
      handler: 'handler',
      environment: {
        QUEUE_URL: this.orderQueue.queueUrl,
        TABLE_NAME: this.orderTable.tableName,
      },
      bundling: {
        nodeModules: ['aws-sdk'],
      },
    });

    this.orderQueue.grantSendMessages(placeOrderLambda);
    this.orderTable.grantWriteData(placeOrderLambda);

    // 🔸 API Gateway: POST /order
    const api = new apigateway.RestApi(this, 'OrderApi', {
      restApiName: 'Order Service',
      description: 'Accepts and tracks orders',
      deployOptions: {
        stageName: 'dev',
      },
    });

    const orderResource = api.root.addResource('order');
    orderResource.addMethod('POST', new apigateway.LambdaIntegration(placeOrderLambda));

    // 🔸 Lambda: Process Order from SQS
    const processOrderLambda = new NodejsFunction(this, 'ProcessOrderLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../lambda/processOrder.js'),
      handler: 'handler',
      timeout: cdk.Duration.minutes(3), // match processing delay
      environment: {
        TABLE_NAME: this.orderTable.tableName,
      },
      bundling: {
        nodeModules: ['aws-sdk'],
      },
    });

    // 🔸 SQS trigger for ProcessOrder
    processOrderLambda.addEventSource(new SqsEventSource(this.orderQueue, {
      batchSize: 1,
      enabled: true,
    }));

    this.orderQueue.grantConsumeMessages(processOrderLambda);
    this.orderTable.grantWriteData(processOrderLambda);

    // 🔸 Lambda: Get Order Status
    const orderStatusLambda = new NodejsFunction(this, 'GetOrderStatusLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../lambda/getOrderStatus.js'),
      handler: 'handler',
      environment: {
        TABLE_NAME: this.orderTable.tableName,
      },
      bundling: {
        nodeModules: ['aws-sdk'],
      },
    });

    this.orderTable.grantReadData(orderStatusLambda);
    const orderIdResource = orderResource.addResource('{orderId}');
    orderIdResource.addMethod('GET', new apigateway.LambdaIntegration(orderStatusLambda));
  }
}