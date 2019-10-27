'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');
const { Duplex } = require('stream');

const httpLib = protocol => {
  switch (protocol) {
    case 'http:':
      return http;
    case 'https:':
      return https;
    default:
      throw new Error('protocol not supported');
  }
};

const readableToBuffer = readable => {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.from([]);
    readable
      .on('data', data => (buffer = Buffer.concat([buffer, data])))
      .on('end', () => resolve(buffer))
      .on('error', reject);
  });
};

const request = options => {
  const url = new URL(options.uri);
  const req = httpLib(url.protocol).request(url, {
    method: options.method && options.method.toUpperCase(),
    headers: options.headers,
  });

  if (options.method && options.method.toLowerCase() !== 'get') {
    if (typeof options.body === 'object') {
      req.setHeader('Content-Type', 'application/json');
      req.end(JSON.stringify(options.body));
    } else if (options.body) {
      req.end(options.body);
    }
  }

  const responsePromise = new Promise(resolve => req.on('response', resolve));

  const duplex = new Duplex({
    read: function() {
      responsePromise.then(response => {
        response.once('readable', () => {
          for (;;) {
            const chunk = response.read();
            if (chunk === null) {
              break;
            }
            this.push(chunk);
          }
        });
      });
    },
    write: req.write.bind(req),
  });

  let srcPipedToDuplex = false;

  duplex.on('pipe', () => (srcPipedToDuplex = true));
  duplex.on('finish', () => req.end());
  responsePromise.then(resp => resp.on('close', () => duplex.push(null)));

  duplex.then = async fn => {
    if (!srcPipedToDuplex) {
      req.end();
    }
    const buffer = await readableToBuffer(duplex);
    const response = await responsePromise;
    response.body = options.json === true ? JSON.parse(buffer.toString()) : buffer.toString();
    return fn(response);
  };

  return duplex;
};

module.exports = { request };
