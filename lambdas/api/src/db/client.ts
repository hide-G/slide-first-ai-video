/**
 * DynamoDB document client singleton.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const rawClient = new DynamoDBClient({});

export const docClient = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

/** Table name from environment variable */
export const TABLE_NAME = process.env.TABLE_NAME ?? "slide-first-table";
