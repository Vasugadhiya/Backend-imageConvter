
require('dotenv').config(); 
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const convert = require('../controller/conversionController')
const router = express.Router();

const isProduction = process.env.NODE_ENV === 'production';
const liveStoragePath = process.env.LIVE_STORAGE_PATH || '/tmp';
const localStoragePath = process.env.LOCAL_STORAGE_PATH || './upload';
const storagePath = isProduction ? liveStoragePath : localStoragePath;

// Ensure storage path exists
fs.ensureDirSync(storagePath);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, storagePath);
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  },
});


const upload = multer({ storage: storage }).single('image');

router.post('/convert', upload, (req, res) => {convert.convertFile(req, res, storagePath);});

router.get('/viewFile', convert.viewConversionFile)

router.post('/addToStarFile', convert.addToStarFile)




module.exports = router;
