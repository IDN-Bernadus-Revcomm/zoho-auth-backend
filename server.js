const express = require('express');
const fetch = require('node-fetch');
const app = express();

// To handle JSON request bodies
app.use(express.json());

// Route to exchange authorization code for access token
app.post('/get-access-token', async (req, res) => {
    const authCode = req.body.code;

    if (!authCode) {
        return res.status(400).json({ error: 'Authorization code is missing' });
    }

    // Exchange the authorization code for an access token
    const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: '1000.ZF5QQB9I65ZZEA7J9URGH7S5X4ZF1I', // Replace with your client ID from Zoho Developer Console
            client_secret: 'e6d43231dba33a2614f48502cd544e425323962281', // Replace with your client secret from Zoho Developer Console
            redirect_uri: 'https://miitel-mg-group.vercel.app/redirect.html', // Must match the redirect URI you set in Zoho
            code: authCode // The authorization code received from Zoho
        })
    });

    const data = await response.json();

    if (data.access_token) {
        // Send the access token to the frontend
        res.json({ accessToken: data.access_token });
    } else {
        // Handle error
        res.status(400).json({ error: 'Failed to retrieve access token', details: data });
    }
});

// Start the server
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});