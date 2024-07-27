const mongoose = require("mongoose");

mongoose.connect(
  "mongodb+srv://vasugadhiyait:nf3lyrHiCfqYnkJz@image.xdfdytd.mongodb.net/?retryWrites=true&w=majority&appName=image",
  { useNewUrlParser: true, useUnifiedTopology: true }
)
.then(() => {
  console.log("DB Connected Successfully");
})
.catch((err) => {
  console.error("DB Connection Error:", err);
});

module.exports = mongoose;
