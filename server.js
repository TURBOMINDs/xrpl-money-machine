const express = require("express");

const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (_req, res) => {
  res.send("XRPL Money Machine is LIVE 🚀");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
