import {
  ElementalInferenceClient,
  GetFeedCommand,
} from "@aws-sdk/client-elementalinference";
import { APIGatewayProxyEvent } from "aws-lambda";

const client = new ElementalInferenceClient({});

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}> => {
  const feedId = event.pathParameters?.feedId;
  if (!feedId) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing feedId path parameter" }),
    };
  }

  try {
    const result = await client.send(new GetFeedCommand({ id: feedId }));
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const statusCode = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode ?? 500;
    return {
      statusCode,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: message }),
    };
  }
};
