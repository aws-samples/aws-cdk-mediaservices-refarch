import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";

const client = new SQSClient({});
const QUEUE_URL = process.env.SQS_QUEUE_URL!;

export const handler = async (): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}> => {
  try {
    const result = await client.send(
      new ReceiveMessageCommand({
        QueueUrl: QUEUE_URL,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 1,
      }),
    );

    const events = (result.Messages ?? []).map((msg) => {
      const body = msg.Body ? JSON.parse(msg.Body) : {};
      return {
        messageId: msg.MessageId,
        detail: body.detail ?? body,
        receiptHandle: msg.ReceiptHandle,
      };
    });

    // Delete received messages so they aren't re-polled
    for (const msg of result.Messages ?? []) {
      if (msg.ReceiptHandle) {
        await client.send(
          new DeleteMessageCommand({
            QueueUrl: QUEUE_URL,
            ReceiptHandle: msg.ReceiptHandle,
          }),
        );
      }
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events }),
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
