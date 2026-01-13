const express = require('express');
const app = express();
const path = require('path');
const port = 3000;

// automatic way for server to retrieve and send files based on url
// if filename exists in public directory, it will send it
app.use(express.json());
app.use(express.static('public'));

app.post('/api/names', (req, res) => {
  const received = req.body.name;
  console.log('Server Received:', received);

  res.json({message: "msg was recieved!"});
});

app.listen(port, () => {
  console.log(`Game server listening on port ${port}`);
});