//@ts-nocheck
'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');
const { Duplex } = require('stream');

const qs = require('qs');
const FormData = require('form-data');

const { readableToBuffer } = require('./util');

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

const request = (uri, options = {}) => {
  if (typeof uri === 'object') {
    options = uri;
  } else {
    options.uri = uri;
  }

  const url = new URL(options.uri);
  const req = httpLib(url.protocol).request(url, {
    method: options.method && options.method.toUpperCase(),
    headers: options.headers,
    auth: options.auth && options.auth.user + ':' + options.auth.pass,
  });

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
  req.on('error', err => duplex.emit('error', err));
  responsePromise.then(resp => {
    resp.on('close', () => duplex.push(null));
    resp.on('error', err => duplex.emit('error', err));
  });

  const pipe = duplex.pipe.bind(duplex);
  duplex.pipe = (...args) => {
    if (!srcPipedToDuplex) {
      duplex.end();
    }
    return pipe(...args);
  };

  if (!options.method || options.method.toLowerCase() === 'get') {
    duplex.end();
  } else if (typeof options.body === 'object') {
    req.setHeader('Content-Type', 'application/json');
    duplex.end(JSON.stringify(options.body));
  } else if (options.body) {
    duplex.end(options.body);
  } else if (options.form) {
    req.setHeader('Content-Type', 'application/x-www-form-urlencoded');
    duplex.end(qs.stringify(options.form));
  } else if (options.formData) {
    const form = new FormData();
    for (const [key, value] of Object.entries(options.formData)) {
      form.append(key, value, { filename: key });
    }
    req.setHeader('Content-Type', 'multipart/form-data;boundary=' + form.getBoundary());
    form.pipe(duplex);
  }

  duplex.then = (fn, handle) => {
    const promise = Promise.race([
      new Promise((_, reject) => duplex.on('error', reject)),
      (async () => {
        if (!srcPipedToDuplex) {
          duplex.end();
        }
        const [response, buffer] = await Promise.all([responsePromise, readableToBuffer(duplex)]);
        const responseString = buffer.toString();
        if (responseString) {
          response.body = options.json === true ? JSON.parse(responseString) : responseString;
        }
        return fn(response);
      })(),
    ]);
    if (handle) {
      return promise.catch(handle);
    }
    return promise;
  };

  duplex.catch = handle => {
    return duplex.then(x => x, handle);
  };

  return duplex;
};

module.exports = { request };
