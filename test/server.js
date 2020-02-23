//@ts-nocheck
'use strict';

const http = require('http');
const bodyParser = require('body-parser');
const multer = require('multer');
const querystring = require('querystring');
const zlib = require('zlib');

const { Readable } = require('stream');

const compressions = {
  gzip: zlib.createGzip,
  br: zlib.createBrotliCompress,
  deflate: zlib.createDeflate,
};

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
    if (req.url === '/echo-json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return req.pipe(res);
    }
    if (req.url === '/echo-text') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
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

    if (req.url === '/multipart') {
      return multer().any()(req, res, err => {
        if (err) {
          return res.writeHead(400).end();
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify(
            req.files.map(x => ({
              fieldname: x.fieldname,
              data: x.buffer.toString(),
            }))
          )
        );
      });
    }

    if (/^\/redirect\/[1-9]$/.test(req.url)) {
      const number = parseInt(req.url.slice(-1));
      return res.writeHead(302, { Location: number === 1 ? '/home' : '/redirect/' + (number - 1) }).end();
    }

    if (req.url === '/redirectToHangUp') {
      return res.writeHead(302, { Location: '/connection-drop' }).end();
    }

    if (req.url.startsWith('/query?')) {
      const q = querystring.parse(req.url.slice(7));
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(q));
    }

    if (req.url.startsWith('/compression?')) {
      const { encodings } = querystring.parse(req.url.slice(13));
      res.setHeader('Content-Encoding', encodings.split());
      return encodings
        .split(/\s*,\s*/)
        .reduce((acc, enc) => acc.pipe(compressions[enc]()), req)
        .pipe(res);
    }

    if (req.url === '/400-json') {
      return res.writeHead(400, { 'Content-Type': 'application/json; charset=utf8' }).end(
        JSON.stringify({
          message: 'custom error message',
          description: 'other field',
        })
      );
    }

    if (req.url === '/403-text') {
      return res
        .writeHead(403, { 'Content-Type': 'text/html; charset=utf8' })
        .end('<html><body>Error Occured!!!</body></html>');
    }

    if (req.url === '/slow') {
      return new SlowSource(5000).pipe(res.writeHead(200, { 'Content-Type': 'text/plain' }));
    }

    return res.writeHead(404).end();
  });
};

class SlowSource extends Readable {
  constructor(duration) {
    super();
    this.duration = duration;
    this.chunks = 'hello from slow source'.split('');
    this.length = this.chunks.length;
  }
  _read() {
    setTimeout(() => {
      this.push(this.chunks.shift() || null);
    }, Math.ceil(this.duration / this.length));
  }
}

module.exports = { createServer };
