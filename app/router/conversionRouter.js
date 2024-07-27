// conversionRouter.js

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { convertFile } = require('../../app/controller/conversionController');

const router = express.Router();

const isProduction = process.env.NODE_ENV === 'production';
const liveStoragePath = process.env.LIVE_STORAGE_PATH || '/tmp';
const localStoragePath = process.env.LOCAL_STORAGE_PATH || './upload';
const storagePath = isProduction ? liveStoragePath : localStoragePath;
console.log("🚀 ~ storagePath:", storagePath)

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

router.post('/convert', upload, (req, res) => {
  convertFile(req, res, storagePath);
});

module.exports = router;
