"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleWebhook = void 0;
const stripe_1 = __importDefault(require("stripe"));
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
});
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
];
// In-memory idempotency store (replace with Redis/DB in production)
const processedEvents = new Set();
const handleWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    if (!sig) {
        return res.status(400).send('No signature provided');
    }
    try {
        // Verify webhook signature
        const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
        // Check if we've already processed this event
        if (processedEvents.has(event.id)) {
            return res.json({ status: 'skipped', message: 'Duplicate event' });
        }
        // Add event to processed set
        processedEvents.add(event.id);
        // Type guard for handled events
        if (HANDLED_EVENTS.includes(event.type)) {
            await handleEvent(event);
        }
        res.json({ status: 'success' });
    }
    catch (err) {
        console.error('Webhook error:', err);
        res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
};
exports.handleWebhook = handleWebhook;
async function handleEvent(event) {
    const { type, data } = event;
    switch (type) {
        case 'charge.dispute.closed':
        case 'charge.dispute.created':
            await handleDisputeEvent(data.object);
            break;
        case 'customer.source.expiring':
            await handleSourceExpiringEvent(data.object);
            break;
        case 'invoice.created':
        case 'invoice.payment_failed':
        case 'invoice.payment_succeeded':
            await handleInvoiceEvent(data.object, type);
            break;
        case 'mandate.updated':
            await handleMandateEvent(data.object);
            break;
        case 'payment_intent.payment_failed':
        case 'payment_intent.processing':
        case 'payment_intent.succeeded':
            await handlePaymentIntentEvent(data.object, type);
            break;
    }
}
async function handleDisputeEvent(dispute) {
    // Implement dispute handling logic
    console.log('Handling dispute event:', dispute.id);
}
async function handleSourceExpiringEvent(card) {
    // Implement source expiring logic
    console.log('Handling source expiring event:', card.id);
}
async function handleInvoiceEvent(invoice, type) {
    // Implement invoice handling logic
    console.log('Handling invoice event:', invoice.id, type);
}
async function handleMandateEvent(mandate) {
    // Implement mandate handling logic
    console.log('Handling mandate event:', mandate.id);
}
async function handlePaymentIntentEvent(paymentIntent, type) {
    // Implement payment intent handling logic
    console.log('Handling payment intent event:', paymentIntent.id, type);
}
