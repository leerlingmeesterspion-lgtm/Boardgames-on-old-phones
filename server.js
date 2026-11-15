const express = require("express");

const app = express();
const port = 3000;

app.get("/", (request, response) => {
  response.send("Modular Chess Server is running!");
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
