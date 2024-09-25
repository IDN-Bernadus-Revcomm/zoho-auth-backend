import cors from 'cors'; // Import the CORS middleware
import express from 'express';
import fetch from 'node-fetch';

const app = express();

let accessToken = null;
let tokenExpirationTime = null;

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

        accessToken = data.access_token;
        tokenExpirationTime = Date.now() + (data.expires_in * 1000);

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
    if (!isAccessTokenValid()) {
        return res.status(401).json({ error: 'Access token is expired or missing. Please reauthorize.' });
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

app.post('/miitel-webhook', async (req, res) => {
    const challenge = req.body.challenge; // Extract the challenge token
    const { call } = req.body;
  
    // Check if challenge exists
    if (challenge) {
      // Return the challenge as plain text with correct headers
      return res.status(200).header('Content-Type', 'text/plain').send(challenge);
    }

    if (!call || !call.details || !call.details[0] || !call.details[0].speech_recognition) {
        return res.status(400).json({ error: 'Missing speech recognition data.' });
    }

    // Extract transcription and phone number
    const speechRecognition = call.details[0].speech_recognition.raw;
    const phoneNumber = call.details[0].from_number;

    try {
        const ticketId = await findTicketIdByPhoneNumber(phoneNumber);

        if (!ticketId) {
            return res.status(404).json({ error: 'Ticket not found for the given phone number.' });
        }

        const updateResult = await updateZohoTicket(ticketId, speechRecognition);

        if (updateResult.success) {
            res.status(200).json({ message: 'Ticket updated successfully with speech recognition data' });
        } else {
            res.status(500).json({ error: 'Failed to update ticket', details: updateResult.details });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error handling webhook', details: error });
    }
  });


  async function findTicketIdByPhoneNumber(phoneNumber) {
       try {
        const response = await fetch(`https://desk.zoho.com/api/v1/tickets/search?phone=${phoneNumber}`, {
            method: 'GET',
            headers: {
                'Authorization': 'Zoho-oauthtoken ' + accessToken,
                'orgId': '865953007',  
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.data && data.data.length > 0) {
            return data.data[0].id;  // Return the first ticket found
        } else {
            return null;  // No ticket found for this phone number
        }
    } catch (error) {
        console.error("Error searching ticket by phone number:", error);
        return null;
    }
}

async function updateZohoTicket(ticketId, transcription) {
    const updatePayload = {
        "status": "Open",  // Keep the ticket open or change status as needed
        "description": `Transcription:\n${transcription}`  // Append the transcription data
    };

    try {
        const response = await fetch(`https://desk.zoho.com/api/v1/tickets/${ticketId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': 'Zoho-oauthtoken ' + accessToken,
                'orgId': '865953007',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatePayload)
        });

        const data = await response.json();

        if (response.ok) {
            return { success: true, details: data };
        } else {
            return { success: false, details: data };
        }
    } catch (error) {
        console.error("Error updating Zoho Desk ticket:", error);
        return { success: false, details: error };
    }
}

function isAccessTokenValid() {
    if (!accessToken || Date.now() >= tokenExpirationTime) {
        console.error("Access token is missing or expired");
        return false;
    }
    return true;
}

// Start the server
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});