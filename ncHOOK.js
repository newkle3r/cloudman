// index.js
const express = require('express');
const axios = require('axios');
const authHeader = 'Basic bmV3a2xlZXI6UHJvMGRpZ3kuMQ==';
const mockCSV = '/mnt/c/Users/newkleer/Documents/Code/DATA.csv'
const app = express();
const PORTS = [3000, 3001, 3002];

// Middleware to handle JSON
app.use(express.json());

app.get('/convert-csv', (req, res) => {
    const results = [];
    fs.createReadStream(mockCSV) // Path to data in csv-format
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
            res.json(results);
        });
});





// Mock GET route that fetches data from Hansson IT API
app.get('/nextcloud/webhooks', async (req, res) => {
    try {
        // Make request to Hansson IT API
        const response = await axios.get('https://cloud.sisec.se/ocs/v2.php/apps/webhook_listeners/api/v1/webhooks', {
            headers: {
                'Accept': 'application/json',
                'Authorization': authHeader,
                'OCS-APIRequest': 'true'
            }
        });

        // Send the response from Hansson IT back to the client
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching data from Hansson IT:', error.message);
        res.status(500).json({ message: 'Error fetching data from Hansson IT', error: error.message });
    }
});

// Start server on multiple ports, defaults to 3000,3001,3002
PORTS.forEach(port => {
    app.listen(port, () => {
        console.log(`API server listening on port ${port}`);
    });
});