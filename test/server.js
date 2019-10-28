'use strict';

const http = require('http');
const { Readable } = require('stream');
const bodyParser = require('body-parser');

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

    if (req.url === '/basicAuth') {
      if (typeof req.headers.authorization !== 'string') {
        return res.writeHead(401).end();
      }
      if (!req.headers.authorization.startsWith('Basic ')) {
        return res.writeHead(401).end();
      }
      const [user, pass] = Buffer.from(req.headers.authorization.slice(6), 'base64')
        .toString()
        .split(':');
      if (user !== 'admin' || pass !== '1234') {
        return res.writeHead(401).end();
      }
      return res.end('Authenticated material');
    }

    if (req.url === '/url-encoded') {
      return bodyParser.urlencoded({ extended: true })(req, res, err => {
        if (err) {
          return res.writeHead(400).end(err.message);
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(req.body));
      });
    }

    if (req.url === '/connection-drop') {
      return res.destroy();
    }

    return res.writeHead(404).end();
  });
};

module.exports = { createServer };
