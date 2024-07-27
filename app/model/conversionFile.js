const mongoose = require('mongoose');

const conversionSchema = new mongoose.Schema({
    originalFilename: String,
    outputFilename: String,
    toFormat: String,
    timestamp: { type: Date, default: Date.now }
})

const convertModel = mongoose.model('Conversion', conversionSchema);

module.exports = convertModel