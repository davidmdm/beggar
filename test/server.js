'use strict';

const http = require('http');
const { Readable } = require('stream');

const getAllDataFromReadable = readable => {
  if (!(readable instanceof Readable)) {
    throw new TypeError('Value must be an instance of stream.Readable');
  }
  return new Promise((resolve, reject) => {
    let buffer = Buffer.from([]);
    readable
      .on('data', data => (buffer = Buffer.concat([buffer, data])))
      .on('end', () => resolve(buffer))
      .on('error', reject);
  });
};

const createServer = () => {
  return http.createServer((req, res) => {
    if (req.url === '/home') {
      return res.writeHead(200, { 'Content-Type': 'text/plain' }).end('Welcome to the homepage');
    }

    if (req.url === '/echo') {
      return req.pipe(res);
    }

    if (req.url === '/redirect') {
      res.setHeader('Location', '/home');
      res.statusCode = 302;
      return res.end();
    }

    if (req.url.startsWith('/details')) {
      return getAllDataFromReadable(req).then(buffer => {
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(
          JSON.stringify({
            request: {
              method: req.method,
              path: req.url,
              headers: req.headers,
              body: buffer && buffer.toString(),
            },
          })
        );
      });
    }

    return res.writeHead(404).end();
  });
};

module.exports = { createServer };
