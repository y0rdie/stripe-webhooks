import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import Stripe from "stripe";
import { Config } from "sst/node/config";
import { Table } from "sst/node/table";

const stripe = new Stripe(Config.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const HANDLED_EVENTS = [
  'charge.dispute.closed',
  'charge.dispute.created',
  'customer.source.expiring',
  'invoice.created',
  'invoice.payment_failed',
  'invoice.payment_succeeded',
  'mandate.updated',
  'payment_intent.payment_failed',
  'payment_intent.processing',
  'payment_intent.succeeded',
] as const;

type HandledEventType = typeof HANDLED_EVENTS[number];

// 24 hours in seconds
const TTL_DURATION = 24 * 60 * 60;

async function isEventProcessed(eventId: string): Promise<boolean> {
  try {
    const result = await ddb.send(new GetCommand({
      TableName: Table.ProcessedEvents.tableName,
      Key: { id: eventId }
    }));
    
    return !!result.Item;
  } catch (error) {
    console.error('Error checking processed event:', error);
    return false;
  }
}

async function markEventProcessed(eventId: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await ddb.send(new PutCommand({
    TableName: Table.ProcessedEvents.tableName,
    Item: {
      id: eventId,
      processedAt: now,
      ttl: now + TTL_DURATION
    }
  }));
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const sig = event.headers["stripe-signature"];

  if (!sig) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "No signature provided" })
    };
  }

  try {
    const stripeEvent = stripe.webhooks.constructEvent(
      event.body!,
      sig,
      Config.STRIPE_WEBHOOK_SECRET
    );

    // Check if we've already processed this event
    if (await isEventProcessed(stripeEvent.id)) {
      return {
        statusCode: 200,
        body: JSON.stringify({ status: "skipped", message: "Duplicate event" })
      };
    }

    // Type guard for handled events
    if (HANDLED_EVENTS.includes(stripeEvent.type as HandledEventType)) {
      await handleEvent(stripeEvent);
    }

    // Mark event as processed
    await markEventProcessed(stripeEvent.id);

    return {
      statusCode: 200,
      body: JSON.stringify({ status: "success" })
    };
  } catch (err) {
    console.error("Webhook error:", err);
    return {
      statusCode: 400,
      body: JSON.stringify({ 
        error: `Webhook Error: ${err instanceof Error ? err.message : "Unknown error"}` 
      })
    };
  }
};

async function handleEvent(event: Stripe.Event) {
  const { type, data } = event;

  switch (type) {
    case 'charge.dispute.closed':
    case 'charge.dispute.created':
      await handleDisputeEvent(data.object as Stripe.Dispute);
      break;

    case 'customer.source.expiring':
      await handleSourceExpiringEvent(data.object as Stripe.Card);
      break;

    case 'invoice.created':
    case 'invoice.payment_failed':
    case 'invoice.payment_succeeded':
      await handleInvoiceEvent(data.object as Stripe.Invoice, type);
      break;

    case 'mandate.updated':
      await handleMandateEvent(data.object as Stripe.Mandate);
      break;

    case 'payment_intent.payment_failed':
    case 'payment_intent.processing':
    case 'payment_intent.succeeded':
      await handlePaymentIntentEvent(data.object as Stripe.PaymentIntent, type);
      break;
  }
}

async function handleDisputeEvent(dispute: Stripe.Dispute) {
  // Implement dispute handling logic
  console.log('Handling dispute event:', dispute.id);
}

async function handleSourceExpiringEvent(card: Stripe.Card) {
  // Implement source expiring logic
  console.log('Handling source expiring event:', card.id);
}

async function handleInvoiceEvent(invoice: Stripe.Invoice, type: string) {
  // Implement invoice handling logic
  console.log('Handling invoice event:', invoice.id, type);
}

async function handleMandateEvent(mandate: Stripe.Mandate) {
  // Implement mandate handling logic
  console.log('Handling mandate event:', mandate.id);
}

async function handlePaymentIntentEvent(paymentIntent: Stripe.PaymentIntent, type: string) {
  // Implement payment intent handling logic
  console.log('Handling payment intent event:', paymentIntent.id, type);
}