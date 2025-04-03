require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Endpoint to create a Stripe Checkout session
app.post('/create-checkout-session', async (req, res) => {
    const { email, playFabId } = req.body;

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
        });

        res.json({ url: session.url });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Webhook endpoint to handle Stripe events
app.post('/webhook', bodyParser.raw({ type: 'application/json' }), (req, res) => {
    const sig = req.headers['stripe-signature'];

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    if (event.type === 'invoice.payment_succeeded') {
  const subscription = event.data.object;
  const customerEmail = subscription.customer_email;
  const playFabId = subscription.metadata?.playFabId;

  console.log(`✅ Payment succeeded for: ${customerEmail}`);
  console.log(`🧾 PlayFab ID (from metadata): ${playFabId}`);
}

    res.json({ received: true });
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
