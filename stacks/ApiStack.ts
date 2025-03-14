import { StackContext, Api, Config, Table } from "sst/constructs";

export function API({ stack }: StackContext) {
  const STRIPE_SECRET_KEY = new Config.Secret(stack, "STRIPE_SECRET_KEY");
  const STRIPE_WEBHOOK_SECRET = new Config.Secret(stack, "STRIPE_WEBHOOK_SECRET");

  // Create DynamoDB table for idempotency
  const table = new Table(stack, "ProcessedEvents", {
    fields: {
      id: "string",
      processedAt: "number",
    },
    primaryIndex: { partitionKey: "id" },
    timeToLiveAttribute: "ttl",
  });

  const api = new Api(stack, "api", {
    defaults: {
      function: {
        bind: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, table]
      }
    },
    routes: {
      "POST /webhook": "packages/functions/src/webhook.handler"
    },
  });

  stack.addOutputs({
    ApiEndpoint: api.url
  });

  return api;
}