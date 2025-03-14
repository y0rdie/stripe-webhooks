import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from '../src/webhook';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

// Mock SST Config
vi.mock('sst/node/config', () => ({
  Config: {
    STRIPE_SECRET_KEY: 'mock_stripe_key',
    STRIPE_WEBHOOK_SECRET: 'mock_webhook_secret'
  }
}));

// Create mock Stripe implementation
const constructEvent = vi.fn();
const mockStripe = {
  webhooks: {
    constructEvent
  }
};

// Mock Stripe module
vi.mock('stripe', () => {
  return {
    default: vi.fn(() => mockStripe)
  };
});

// Mock DynamoDB
const ddbMock = mockClient(DynamoDBDocumentClient);

describe('Webhook Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ddbMock.reset();
    constructEvent.mockReset();
  });

  it('should return 400 if no signature is provided', async () => {
    const event = {
      headers: {},
      body: '{}'
    };

    const response = await handler(event as any);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toBe('No signature provided');
  });

  it('should handle invalid signatures', async () => {
    const event = {
      headers: {
        'stripe-signature': 'invalid_signature'
      },
      body: '{}'
    };

    constructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const response = await handler(event as any);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toBe('Webhook Error: Invalid signature');
  });

  it('should skip duplicate events', async () => {
    const event = {
      headers: {
        'stripe-signature': 'valid_signature'
      },
      body: '{}'
    };

    const stripeEvent = {
      id: 'evt_123',
      type: 'payment_intent.succeeded',
      data: {
        object: {}
      }
    };

    constructEvent.mockReturnValue(stripeEvent);

    ddbMock.on(GetCommand).resolves({
      Item: { id: 'evt_123' }
    });

    const response = await handler(event as any);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      status: 'skipped',
      message: 'Duplicate event'
    });
  });

  it('should process valid payment_intent.succeeded events', async () => {
    const event = {
      headers: {
        'stripe-signature': 'valid_signature'
      },
      body: '{}'
    };

    const stripeEvent = {
      id: 'evt_123',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_123',
          status: 'succeeded'
        }
      }
    };

    constructEvent.mockReturnValue(stripeEvent);

    ddbMock
      .on(GetCommand)
      .resolves({})
      .on(PutCommand)
      .resolves({});

    const response = await handler(event as any);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      status: 'success'
    });

    // Verify event was marked as processed
    expect(ddbMock.calls()).toHaveLength(2);
    const putCommand = ddbMock.commandCalls(PutCommand)[0];
    expect(putCommand.args[0].input).toMatchObject({
      TableName: expect.any(String),
      Item: {
        id: 'evt_123',
        processedAt: expect.any(Number),
        ttl: expect.any(Number)
      }
    });
  });

  it('should handle DynamoDB errors gracefully', async () => {
    const event = {
      headers: {
        'stripe-signature': 'valid_signature'
      },
      body: '{}'
    };

    const stripeEvent = {
      id: 'evt_123',
      type: 'payment_intent.succeeded',
      data: {
        object: {}
      }
    };

    constructEvent.mockReturnValue(stripeEvent);

    ddbMock
      .on(GetCommand)
      .rejects(new Error('DynamoDB error'));

    const response = await handler(event as any);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toContain('Webhook Error');
  });

  it('should ignore unhandled event types', async () => {
    const event = {
      headers: {
        'stripe-signature': 'valid_signature'
      },
      body: '{}'
    };

    const stripeEvent = {
      id: 'evt_123',
      type: 'unhandled.event.type',
      data: {
        object: {}
      }
    };

    constructEvent.mockReturnValue(stripeEvent);

    ddbMock
      .on(GetCommand)
      .resolves({})
      .on(PutCommand)
      .resolves({});

    const response = await handler(event as any);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      status: 'success'
    });
  });
});