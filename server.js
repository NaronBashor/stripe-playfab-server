const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const axios = require('axios');
require('dotenv').config();

const app = express();

// Webhook MUST come BEFORE bodyParser.json()
app.post('/api/stripe-webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'invoice.payment_succeeded') {
        const invoice = event.data.object;

        try {
            const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
            const playFabId = subscription.metadata?.playFabId;
            const customerEmail = invoice.customer_email;

            console.log(`Payment succeeded for: ${customerEmail}`);
            console.log(`PlayFab ID: ${playFabId}`);

            await updatePlayFabSubscription(playFabId, invoice.customer);
        } catch (err) {
            console.error(`Failed to process subscription: ${err.message}`);
        }
    }

    res.json({ received: true });
});

// Apply these AFTER the webhook route
app.use(cors());
app.use(bodyParser.json());

// All other routes come here
app.post('/create-checkout-session', async (req, res) => {
    const { email, playFabId } = req.body;
    console.log("➡️ Received checkout creation request:", { email, playFabId });

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'subscription',
            line_items: [{
                price: 'price_1R3hWM00hpkvgPMJXA6lYCqJ',
                quantity: 1,
            }],
            customer_email: email,
            success_url: 'https://splitrockgames.com/StripeSuccessPage',
            cancel_url: 'https://splitrockgames.com/tarkovto-do',
            subscription_data: {
                metadata: { playFabId }
            }
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error("Error creating checkout session:", error.message);
        res.status(500).json({ error: error.message });
    }
});

async function updatePlayFabSubscription(playFabId, stripeCustomerId) {
    if (!playFabId || !stripeCustomerId) {
        console.warn("⚠ Missing playFabId or stripeCustomerId.");
        return;
    }

    try {
        const response = await axios.post(
            'https://16B37C.playfabapi.com/Admin/UpdateUserInternalData',
            {
                PlayFabId: playFabId,
                Data: {
                    StripeCustomerId: stripeCustomerId,
                    SubscriptionStatus: "active",
                    Expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                }
            },
            {
                headers: {
                    'X-SecretKey': process.env.PLAYFAB_SECRET_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log("✅ PlayFab updated:", response.data);
    } catch (err) {
        console.error("❌ Failed to update PlayFab:", err.response?.data || err.message);
    }
}

app.post('/create-customer-portal-session', async (req, res) => {
    const { customerId } = req.body;

    try {
        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: 'https://splitrockgames.com/tarkovto-do'
        });

        res.json({ url: session.url });
    } catch (err) {
        console.error("Failed to create portal session:", err.message);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
