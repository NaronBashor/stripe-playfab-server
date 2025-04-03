const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
require('dotenv').config();

const app = express();

// Stripe needs raw body for signature verification
app.post('/api/stripe-webhook', bodyParser.raw({ type: 'application/json' }), (req, res) => {
    const sig = req.headers['stripe-signature'];

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'invoice.payment_succeeded') {
        const subscription = event.data.object;
        const customerEmail = subscription.customer_email;
        const playFabId = subscription.metadata?.playFabId;

        console.log(`Payment succeeded for: ${customerEmail}`);
        console.log(`PlayFab ID (from metadata): ${playFabId}`);
        // Optionally call your updatePlayFabSubscription here
    }

    res.json({ received: true });
});

// Everything else (body parser comes AFTER)
app.use(cors());
app.use(bodyParser.json());

// Other routes
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

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
