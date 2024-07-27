require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const cors = require('cors');
const conversionRouter = require('./app/router/conversionRouter'); // Import the router

const app = express();
const port = 5000;

app.use(cors());

const storagePath = path.join(__dirname, 'storage'); // Update this path to your storage directory
app.use('/download', express.static(storagePath));


// app.use('/download', express.static(process.env.STORAGE_PATH || './upload'));
app.use('/api', conversionRouter); // Use the router with a base path

app.listen(port, () => {
  console.log('Server listening successfully on port', port);
});
