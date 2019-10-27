'use strict';

const http = require('http');
const { format } = require('util');

http
  .createServer((req, res) => {
    res.write(format('%s %s\nHeaders: %j\n\n', req.method, req.url, req.rawHeaders));
    req.on('data', data => res.write(data));

    req.on('end', async () => {
      res.write('\n');
      for (let i = 0; i < 100; i++) {
        await new Promise(resolve => setTimeout(resolve, 20));
        res.write(i.toString());
      }
      res.end('\n');
    });
  })
  .listen(3000, () => console.log('listening on port 3000'));
