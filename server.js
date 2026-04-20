const express = require("express");

const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (_req, res) => {
  res.send(`
  <html>
    <head>
      <title>XRPL Money Machine</title>
    </head>
    <body style="background:black; color:white; text-align:center; font-family:sans-serif;">
      <h1>🚀 XRPL Money Machine</h1>
      <p>System is LIVE</p>
      <p>Powered by XEMA</p>
    </body>
  </html>
`);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
