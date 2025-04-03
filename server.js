const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
require('dotenv').config();

const app = express();

// Stripe needs raw body for signature verification
app.post('/create-checkout-session', async (req, res) => {
    const { email, playFabId } = req.body;
    console.log("Received checkout creation request:", { email, playFabId }); // <--- ADD THIS

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

const axios = require('axios');

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

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
