import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import "./deploy";

import * as dynamoClient from "@aws-sdk/client-dynamodb";
import * as dynamoLib from "@aws-sdk/lib-dynamodb";
import * as apigateway from "@pulumi/aws-apigateway";

const config = new pulumi.Config();
const name = config.get("name");
const runtime = "nodejs18.x";
const baseTags = {
	owner: "laci",
	PulumiStack: pulumi.getStack(),
};

// Stack Reference
const networking = new pulumi.StackReference(config.require("networking"));
const security = new pulumi.StackReference(config.require("security"));

// Create a mapping from 'route' to a count
const counterTable = new aws.dynamodb.Table(`${name}-counter-table`, {
  attributes: [{
    name: "id",
    type: "S",
  }],
  hashKey: "id",
  readCapacity: 5,
  writeCapacity: 5,
  pointInTimeRecovery: {
    enabled: true,
  },
  tags: {
		...baseTags,
	},
});

const getHandler = new aws.lambda.CallbackFunction(`${name}-get-handler`, {
  policies: ['arn:aws:iam::aws:policy/AdministratorAccess'],
  runtime: runtime,
  callback: async (ev, ctx) => {
    const event = <any>ev;
    const route = event.pathParameters?.["route"] || "root";
    console.log(`Getting count for '${route}'`);

    const dynoClient = new dynamoClient.DynamoDBClient({});
    const doc = dynamoLib.DynamoDBDocument.from(dynoClient);

    // get previous value and increment
    // reference outer `counterTable` object
    const tableData = await doc.get({
      TableName: counterTable.name.get(),
      Key: { id: route },
      ConsistentRead: true,
    });

    const value = tableData.Item;
    let count = (value && value.count) || 0;

    await doc.put({
      TableName: counterTable.name.get(),
      Item: { id: route, count: ++count },
    });

    console.log(`Got count ${count} for '${route}'`);
    return {
      statusCode: 200,
      body: JSON.stringify({ route, count, runtime }),
    };
  },
  tags: {
		...baseTags,
	},
  vpcConfig: {
    // vpcId: networking.getOutput("vpcId"),
    subnetIds: networking.getOutput("vpcPublicSubnetIds"),
    securityGroupIds: [security.getOutput("sgId")],
  },
});

// Create an API endpoint
const apiEndpoint = new apigateway.RestAPI(`${name}-endpoint`, {
  routes: [
    {
      path: "/",
      method: "GET", 
      eventHandler: getHandler,
    },
    {
      path: "/{route+}",
      method: "GET",
      eventHandler: getHandler,
    }
  ],
  tags: {
		...baseTags,
	},
});

export const endpoint = apiEndpoint.url;