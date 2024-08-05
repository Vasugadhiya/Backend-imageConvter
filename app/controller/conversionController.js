const path = require("path");
const fs = require("fs-extra");
const { PDFDocument } = require("pdf-lib");
const sharp = require("sharp");
const mammoth = require("mammoth");
const puppeteer = require("puppeteer");
const htmlPdf = require("html-pdf-node");
const Jimp = require("jimp");
const heicConvert = require("heic-convert");
const { Document, Packer, Paragraph, ImageRun } = require("docx");
const PptxGenJS = require("pptxgenjs");
const imageJs = require("image-js");
const { exec } = require("child_process");
const convertModel = require("../model/conversionFile");
const HTTP = require("../../constants/responseCode.constant");

const convertHtmlToPdf = async (html) => {
  let file = { content: html };
  let options = { format: "A4" };
  let pdfBuffer = await htmlPdf.generatePdf(file, options);
  return pdfBuffer;
};

const convertHtmlToImage = async (html, format) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(html);
  const imageBuffer = await page.screenshot({ fullPage: true, type: format });
  await browser.close();
  return imageBuffer;
};

// File Conveter API
const convertFile = async (req, res, storagePath) => {
  try {
    let toFormat = req.body.to;

    if (!req.file) {
      return res.status(400).send({ error: "No file uploaded" });
    }

    const inputPath = path.join(storagePath, req.file.filename);
    const outputFilename = `${
      req.file.originalname.split(".")[0]
    }-${Date.now()}.${toFormat}`;
    const outputPath = path.join(storagePath, outputFilename);
    const downloadLink = `${req.protocol}://${req.get(
      "host"
    )}/download/${outputFilename}`;

    console.log("🚀 ~ convertFile ~ downloadLink:", downloadLink);

    if (
      req.file.mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      if (toFormat === "html") {
        const result = await mammoth.convertToHtml({ path: inputPath });
        fs.writeFileSync(outputPath, result.value);
      } else if (toFormat === "pdf") {
        const result = await mammoth.convertToHtml({ path: inputPath });
        const pdfBuffer = await convertHtmlToPdf(result.value);
        fs.writeFileSync(outputPath, pdfBuffer);
      } else if (
        ["jpeg", "jpg", "png", "gif", "tiff", "webp", "hdr", "avif"].includes(
          toFormat
        )
      ) {
        const result = await mammoth.convertToHtml({ path: inputPath });
        const imageBuffer = await convertHtmlToImage(result.value, toFormat);
        fs.writeFileSync(outputPath, imageBuffer);
      } else {
        throw new Error(`Unsupported conversion format: ${toFormat}`);
      }
    } else {
      if (toFormat === "pdf") {
        const pdfDoc = await PDFDocument.create();
        const image = sharp(inputPath);
        const metadata = await image.metadata();
        const imageBuffer = await image.toBuffer();
        let embeddedImage;

        switch (metadata.format) {
          case "jpeg":
          case "jpg":
            embeddedImage = await pdfDoc.embedJpg(imageBuffer);
            break;
          case "png":
          case "gif":
          case "tiff":
          case "webp":
          case "avif":
            embeddedImage = await pdfDoc.embedPng(imageBuffer);
            break;
          case "hdr":
            const hdrImage = await Jimp.read(inputPath);
            const hdrBuffer = await hdrImage.getBufferAsync(Jimp.MIME_PNG);
            embeddedImage = await pdfDoc.embedPng(hdrBuffer);
            break;
          case "dds":
            const ddsImage = await Jimp.read(inputPath);
            const ddsBuffer = await ddsImage.getBufferAsync(Jimp.MIME_PNG); // Convert to PNG buffer
            const { data, width, height } = await imageJs.Image.load(ddsBuffer); // Load image with image-js
            const encodedDdsBuffer = imageJs.encode(imageJs.getFormat("DDS"), {
              width,
              height,
              data,
            }); // Encode to DDS format
            fs.writeFileSync(outputPath, Buffer.from(encodedDdsBuffer));
            break;
          case "HEIC":
          case "HEIF":
            const heicImageBuffer = await fs.readFile(inputPath);
            const heicImage = await heicConvert({
              buffer: heicImageBuffer,
              format: "HEIF", // Convert HEIC/HEIF to JPEG for embedding in PDF
            });
            embeddedImage = await pdfDoc.embedJpg(heicImage);
            break;
          default:
            throw new Error(`Unsupported image format: ${metadata.format}`);
        }
        const page = pdfDoc.addPage([
          embeddedImage.width,
          embeddedImage.height,
        ]);
        page.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: embeddedImage.width,
          height: embeddedImage.height,
        });
        const pdfBytes = await pdfDoc.save();
        fs.writeFileSync(outputPath, pdfBytes);
      } else if (toFormat === "docx") {
        const imageBuffer = await fs.readFile(inputPath);
        const doc = new Document({
          sections: [
            {
              properties: {},
              children: [
                new Paragraph({
                  children: [
                    new ImageRun({
                      data: imageBuffer,
                      transformation: {
                        width: 600,
                        height: 400,
                      },
                    }),
                  ],
                }),
              ],
            },
          ],
        });
        const buffer = await Packer.toBuffer(doc);
        fs.writeFileSync(outputPath, buffer);
      } else if (toFormat === "pptx") {
        const imageBuffer = await fs.readFile(inputPath);
        const pptx = new PptxGenJS();
        const slide = pptx.addSlide();
        slide.addImage({
          data: `data:image/${
            req.file.mimetype.split("/")[1]
          };base64,${imageBuffer.toString("base64")}`,
          x: 0.5,
          y: 0.5,
          w: 8.5,
          h: 6,
        });
        await pptx.writeFile({ fileName: outputPath });
      } else if (toFormat === "odp") {
        const command = `libreoffice --headless --convert-to odp "${inputPath}" --outdir "${path.dirname(
          outputPath
        )}"`;
        exec(command, (err, stdout, stderr) => {
          if (err) {
            throw new Error(`Error converting to ODP: ${err.message}`);
          }
          console.log(stdout);
        });
      } else if (["HEIC", "HEIF"].includes(toFormat)) {
        const image = await Jimp.read(inputPath);
        const buffer = await image.getBufferAsync(Jimp.MIME_PNG);
        const heicImage = await heicConvert({
          buffer,
          format: "HEIC",
        });
        fs.writeFileSync(outputPath, heicImage);
      } else if (toFormat === "rgb") {
        const image = await Jimp.read(inputPath);
        await image.writeAsync(outputPath); // Writes the image as RGB format
      } else if (toFormat === "jp2") {
        await sharp(inputPath).toFormat("jp2").toFile(outputPath);
      } else if (toFormat === "jfif") {
        await sharp(inputPath).toFormat("jpeg").toFile(outputPath);
      } else {
        await Jimp.read(inputPath)
          .then((image) => {
            return image.writeAsync(outputPath); // Writes the image in the requested format
          })
          .catch((err) => {
            throw new Error(`Error processing image: ${err.message}`);
          });
      }
    }

    setTimeout(() => {
      fs.remove(inputPath, (err) => {
        if (err) {
          console.error("Error deleting original file:", err);
        } else {
          console.log("Original file deleted successfully");
        }
      });
    }, 1000);

    // Save conversion details to the database
    const conversion = new convertModel({
      originalFilename: req.file.originalname,
      outputFilename: outputFilename,
      toFormat: toFormat,
    });

    await conversion.save();

    return res
      .status(200)
      .send({ message: "Conversion successful", downloadLink: downloadLink });
  } catch (err) {
    console.error("Error during conversion:", err);
    res.status(500).send({ error: "Conversion failed" });
  }
};

// View File
async function viewConversionFile(req, res) {
  try {
    const finddata = await convertModel.find({});
    return res
      .status(HTTP.SUCCESS)
      .send({
        status: true,
        CODE: HTTP.SUCCESS,
        message: "File data show successfully .",
        finddata,
      });
  } catch (error) {
    console.log(error.message);
    return res
      .status(HTTP.SUCCESS)
      .send({
        success: false,
        code: HTTP.INTERNAL_SERVER_ERROR,
        message: "Something went wrong!",
        data: {},
      });
  }
}

// Add To Start File
const addToStarFile = async (req, res) => {
  try {
    const findFile = await convertModel.findOne({ _id: req.body.id });
    console.log("🚀 ~ addToStarFile ~ req.body.id:", req.body.id);

    if (!findFile) {
      return res
        .status(400)
        .json({ status: false, code: 400, msg: "Folder Not Found" });
    }

    if (findFile.favourites == false) {
      findFile.favourites = true;
      await findFile.save();
      return res
        .status(200)
        .json({
          status: true,
          code: 200,
          msg: "File Add To Favourite List",
          data: findFile,
        });
    }

    if (findFile.favourites == true) {
      findFile.favourites = false;
      await findFile.save();
      return res
        .status(200)
        .json({
          status: true,
          code: 200,
          msg: "File Remove To Favourite List",
          data: findFile,
        });
    }
  } catch (error) {
    console.log(
      "🚀 ~ file: userController.js:235 ~ blockAccount ~ error:",
      error
    );
    return res
      .status(500)
      .json({
        status: false,
        code: 500,
        msg: "Something Went Wrong",
        error: error.message,
      });
  }
};

const convertDocToImg = async (req, res, storagePath) => {
  console.log(
    "-------------------- convertDocToImg ---------------------------"
  );
  try {
    let toFormat = req.body.to;
    console.log("🚀 ~ convertDocToImg ~ toFormat:", toFormat);

    if (!req.file) {
      return res.status(400).send({ error: "No file uploaded" });
    }

    const inputPath = path.join(storagePath, req.file.filename);
    const outputFilename = `${
      req.file.originalname.split(".")[0]
    }-${Date.now()}.${toFormat}`;
    const outputPath = path.join(storagePath, outputFilename);
    const downloadLink = `${req.protocol}://${req.get(
      "host"
    )}/download/${outputFilename}`;

    console.log("🚀 ~ convertDocToImage ~ downloadLink:", downloadLink);

    if (
      req.file.mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result = await mammoth.convertToHtml({ path: inputPath });
      const htmlContent = result.value;

      // Convert HTML to Image using sharp
      const imageBuffer = await sharp(Buffer.from(htmlContent))
        .toFormat(toFormat)
        .toBuffer();

      fs.writeFileSync(outputPath, imageBuffer);
    } else {
      return res.status(400).send({ error: "Unsupported file type" });
    }

    // Cleanup original file
    setTimeout(() => {
      fs.remove(inputPath, (err) => {
        if (err) {
          console.error("Error deleting original file:", err);
        } else {
          console.log("Original file deleted successfully");
        }
      });
    }, 1000);

    // Return the download link for the converted file
    return res
      .status(200)
      .send({ message: "Conversion successful", downloadLink: downloadLink });
  } catch (err) {
    console.error("Error during conversion:", err);
    res.status(500).send({ error: "Conversion failed" });
  }
};

module.exports = {
  convertFile,
  viewConversionFile,
  addToStarFile,
  convertDocToImg,
};
