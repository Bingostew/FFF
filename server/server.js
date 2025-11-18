const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Server is running inside Docker!');
});

app.listen(port, () => {
  console.log(`Game server listening on port ${port}`);
});