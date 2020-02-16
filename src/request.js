//@ts-nocheck
'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');
const { format } = require('util');
const { Readable, PassThrough } = require('stream');

const qs = require('qs');
const querystring = require('querystring');
const FormData = require('form-data');

const { Connection } = require('./connection');

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

const createProxiedConnection = (url, options) => {
  const passthrough = new PassThrough();
  const conn = new Connection(passthrough, options);

  const { hostname, port, protocol, username, password } = new URL(options.proxy);
  const proxyHost = format('%s:%s', hostname, port || (protocol === 'https:' ? 443 : 80));
  const proxyAuth = username && password && 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

  console.log('STARTING PROXY REQ');

  console.log({
    hostname,
    protocol,
    port,
    pathname: '/' + url.hostname + ':' + (url.port || (url.protocol === 'https:' ? 443 : 80)),
  });

  httpLib(protocol)
    .request(
      new URL({
        hostname,
        protocol,
        port,
        pathname: '/' + url.hostname + ':' + (url.port || (url.protocol === 'https:' ? 443 : 80)),
      }),
      {
        method: 'CONNECT',
        headers: {
          ...options.headers,
          Host: proxyHost,
          'Proxy-Authorization': proxyAuth || undefined,
        },
      }
    )
    .on('connect', (_, socket) => {
      console.log('I CONNECTED');
      const req = httpLib(url.protocol)
        .request({
          method: options.method && options.method.toUpperCase(),
          headers: options.headers,
          auth: options.auth && options.auth.user + ':' + options.auth.pass,
          agent: null,
          createConnection: () => socket,
        })
        .on('error', err => conn.emit('error', err))
        .on('response', response => {
          response.on('error', err => conn.emit('error', err));
          response.on('close', () => conn.emit('close'));
          conn.emit('response', response);
        });
      conn.emit('request', req);
      passthrough.pipe(req);
    });

  return conn;
};

const createConnection = (url, options) => {
  const req = httpLib(url.protocol).request(url, {
    method: options.method && options.method.toUpperCase(),
    headers: options.headers,
    auth: options.auth && options.auth.user + ':' + options.auth.pass,
    agent: options.agent,
  });

  const responsePromise = new Promise((resolve, reject) =>
    req.on('response', resp => {
      if (options.followRedirects && resp.statusCode >= 301 && resp.statusCode <= 303) {
        const location = resp.headers.location;
        const qualifiedRedirection = location.startsWith('/') ? url.origin + location : location;
        return request
          .get(qualifiedRedirection, { followRedirects: true, json: options.json })
          .on('response', nextResp => {
            nextResp.redirects = [qualifiedRedirection, ...(nextResp.redirects || [])];
            resolve(nextResp);
          })
          .on('error', reject);
      }
      return resolve(resp);
    })
  );

  const conn = new Connection(req, options);
  conn.emit('request', req);
  req.on('error', err => conn.emit('error', err));

  responsePromise
    .then(resp => {
      conn.emit('response', resp);
      resp.on('close', () => conn.emit('close'));
      resp.on('error', err => conn.emit('error', err));
    })
    .catch(err => conn.emit('error', err));

  return conn;
};

function request(uri, options = {}) {
  if (typeof uri === 'string' || uri instanceof URL) {
    options.uri = uri;
  } else {
    options = uri;
  }

  const url = new URL(options.uri);

  if (options.qs) {
    url.search = qs.stringify({ ...Object.fromEntries(url.searchParams), ...options.qs });
  } else if (options.query) {
    url.search = querystring.stringify({ ...Object.fromEntries(url.searchParams), ...options.query });
  }

  const conn = options.proxy ? createProxiedConnection(url, options) : createConnection(url, options);

  if (!options.method || options.method.toLowerCase() === 'get') {
    conn.end();
  } else if (typeof options.body === 'string' || options.body instanceof Buffer) {
    conn.end(options.body);
  } else if (options.body instanceof Readable && options.body._readableState.objectMode === false) {
    options.body.pipe(conn);
  } else if (options.body !== undefined) {
    conn.setHeader('Content-Type', 'application/json');
    conn.end(JSON.stringify(options.body));
  } else if (options.form) {
    conn.setHeader('Content-Type', 'application/x-www-form-urlencoded');
    conn.end(qs.stringify(options.form));
  } else if (options.formData) {
    const form = new FormData();
    for (const [key, value] of Object.entries(options.formData)) {
      form.append(key, value, { filename: key });
    }
    conn.setHeader('Content-Type', 'multipart/form-data;boundary=' + form.getBoundary());
    form.pipe(conn);
  }

  return conn;
}

for (const method of http.METHODS) {
  request[method.toLowerCase()] = (uri, options = {}) => {
    if (typeof uri === 'string' || uri instanceof URL) {
      options.method = method;
    } else {
      uri.method = method;
    }
    return request(uri, options);
  };
}

module.exports = { request };
