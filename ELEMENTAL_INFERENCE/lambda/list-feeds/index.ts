import {
  ElementalInferenceClient,
  ListFeedsCommand,
} from "@aws-sdk/client-elementalinference";

const client = new ElementalInferenceClient({});

export const handler = async (): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}> => {
  try {
    const result = await client.send(new ListFeedsCommand({}));
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feeds: result.feeds ?? [] }),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: message }),
    };
  }
};
