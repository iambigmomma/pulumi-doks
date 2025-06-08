const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Load environmental variables
const customValue = process.env.CUSTOM_VALUE || 'default-value';

app.get('/', (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Pulumi DOKS Web App</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                max-width: 800px;
                margin: 50px auto;
                padding: 20px;
                background-color: #f5f5f5;
            }
            .container {
                background-color: white;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                text-align: center;
            }
            .value {
                font-size: 2em;
                color: #007acc;
                font-weight: bold;
                margin: 20px 0;
                padding: 20px;
                background-color: #e8f4fd;
                border-radius: 5px;
            }
            .info {
                color: #666;
                margin-top: 20px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🚀 Pulumi DigitalOcean Kubernetes Web App</h1>
            <p>Successfully deployed with Pulumi!</p>
            <div class="value">${customValue}</div>
            <div class="info">
                <p>This value is configurable via Pulumi config</p>
                <p>Hostname: ${require('os').hostname()}</p>
                <p>Timestamp: ${new Date().toISOString()}</p>
            </div>
        </div>
    </body>
    </html>
  `;
  res.send(html);
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', customValue: customValue });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Custom value: ${customValue}`);
}); 