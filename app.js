require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const cors = require('cors');
const conversionRouter = require('./app/router/conversionRouter'); // Import the router

const app = express();
const port = 5000;

app.use(cors());

require('./config/Connect')
app.use(express.json());


app.use('/download', express.static(process.env.STORAGE_PATH || '/tmp'));
app.use('/api', conversionRouter); // Use the router with a base path

app.all("*", (req, res) => {
  res.send("BackEnd Sever")
})

app.listen(port, () => {
  console.log('Server listening successfully on port', port);
});
