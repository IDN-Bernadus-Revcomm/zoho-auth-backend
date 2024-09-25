import cors from 'cors'; // Import the CORS middleware
import express from 'express';
import fetch from 'node-fetch';

const app = express();

// Enable CORS for your frontend (Vercel URL)
app.use(cors({
    origin: 'https://miitel-mg-group.vercel.app', // Allow only this origin
}));

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

// Route to create a ticket in Zoho Desk
app.post('/create-ticket', async (req, res) => {
    const accessToken = req.body.accessToken;
    const phoneNumber = req.body.phoneNumber;

    // Check if required data is provided
    if (!accessToken || !phoneNumber) {
        return res.status(400).json({ error: 'Access token and phone number are required.' });
    }

    // Prepare the ticket payload
    const ticketPayload = {
        subject: `Ticket from Phone Number: ${phoneNumber}`,
        contactId: "1040287000000287180",  // Replace with your actual contact ID
        departmentId: "1040287000000006907",  // Replace with your actual department ID
        description: `Ticket created for phone number: ${phoneNumber}`,
        priority: "High",
        status: "Open",
        channel: "Phone",
        phone: phoneNumber,
        dueDate: new Date().toISOString()  // Set the due date dynamically
    };

    try {
        const response = await fetch('https://desk.zoho.com/api/v1/tickets', {
            method: 'POST',
            headers: {
                'Authorization': 'Zoho-oauthtoken ' + accessToken,
                'orgId': '865953007',  // Your Zoho organization ID
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(ticketPayload)
        });

        const data = await response.json();
        if (response.ok) {
            res.json(data);
        } else {
            res.status(response.status).json({ error: 'Failed to create ticket', details: data });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to create ticket', details: error });
    }
});

// Start the server
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});