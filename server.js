const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const axios = require('axios');
require('dotenv').config();

const app = express();

// Setup middleware
app.use(cors());
app.use(bodyParser.json()); // 👈 this must be before routes that use req.body

// Create Checkout Session
app.post('/create-checkout-session', async (req, res) => {
    const { email, playFabId } = req.body;
    console.log("Received checkout creation request:", { email, playFabId });

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'subscription',
            line_items: [{
                price: 'price_1R3hWM00hpkvgPMJXA6lYCqJ',
                quantity: 1,
            }],
            customer_email: email,
            success_url: `https://splitrockgames.com/StripeSuccessPage`,
            cancel_url: 'https://splitrockgames.com/tarkovto-do',
            subscription_data: {
                metadata: {
                    playFabId: playFabId
                }
            }
        });

        res.json({ url: session.url });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Stripe Webhook (raw body must be used here)
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

            const customerEmail = invoice.customer_email;
            const playFabId = subscription.metadata?.playFabId;

            console.log(`Payment succeeded for: ${customerEmail}`);
            console.log(`PlayFab ID (from metadata): ${playFabId}`);

            await updatePlayFabSubscription(playFabId);

        } catch (subError) {
            console.error(`❌ Failed to fetch subscription metadata: ${subError.message}`);
        }
    }

    res.json({ received: true });
});

// Function to update PlayFab
async function updatePlayFabSubscription(playFabId) {
    if (!playFabId) {
        console.warn("No PlayFab ID found, skipping update.");
        return;
    }

    try {
        const result = await axios.post(
            `https://YOUR_TITLE_ID.playfabapi.com/Admin/UpdateUserInternalData`,
            {
                PlayFabId: playFabId,
                Data: {
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
        console.log("PlayFab updated:", result.data);
    } catch (err) {
        console.error("Failed to update PlayFab:", err.response?.data || err.message);
    }
}

// Start server
const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
