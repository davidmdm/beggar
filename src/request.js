//@ts-nocheck
'use strict';

const http = require('http');
const https = require('https');
const tls = require('tls');

const util = require('util');
const { URL } = require('url');
const { Readable, PassThrough } = require('stream');

const qs = require('qs');
const querystring = require('querystring');
const FormData = require('form-data');

const { Connection } = require('./connection');

const version = require('../package.json').version;

const defaultUserAgent = util.format(
  'Beggar/%s (Node.js %s; %s %s)',
  version,
  process.version,
  process.platform,
  process.arch
);

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

const createProxiedConnection = (uri, options) => {
  const passthrough = new PassThrough();
  const conn = new Connection(passthrough, options);

  const targetProtocol = uri.protocol;
  const targetHost = util.format(
    '%s:%s',
    options.uri.hostname,
    options.uri.port || (targetProtocol === 'https:' ? 443 : 80)
  );
  const { hostname, port, protocol, username, password } = new URL(options.proxy);
  const proxyAuth = username && password && 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

  httpLib(protocol)
    .request({
      host: hostname,
      port: port && Number(port),
      headers: {
        host: targetHost,
        'User-Agent': (options.headers && options.headers['user-agent']) || defaultUserAgent,
        'Proxy-Authorization': proxyAuth || undefined,
      },
      method: 'CONNECT',
      path: targetHost,
      agent: false,
    })
    .on('connect', function(_, socket) {
      const req = httpLib(targetProtocol)
        .request(uri, {
          method: options.method && options.method.toUpperCase(),
          headers: { 'User-Agent': defaultUserAgent, ...options.headers },
          auth: options.auth && options.auth.user + ':' + options.auth.pass,
          agent: null,
          createConnection: () => {
            if (targetProtocol !== 'https:') {
              return socket;
            }
            return tls.connect(0, { servername: uri.host, socket }, () => {});
          },
        })
        .on('error', err => conn.emit('error', err))
        .on('response', response => {
          response.on('error', err => conn.emit('error', err));
          response.on('close', () => conn.emit('close'));
          conn.emit('response', response);
        });
      conn.emit('request', req);
      passthrough.pipe(req);
    })
    .end();

  return conn;
};

const createConnection = (uri, options) => {
  const req = httpLib(uri.protocol).request(uri, {
    method: options.method && options.method.toUpperCase(),
    headers: { 'User-Agent': defaultUserAgent, ...options.headers },
    auth: options.auth && options.auth.user + ':' + options.auth.pass,
    agent: options.agent,
  });

  const responsePromise = new Promise((resolve, reject) =>
    req.on('response', resp => {
      if (options.followRedirects && resp.statusCode >= 301 && resp.statusCode <= 303) {
        const location = resp.headers.location;
        const qualifiedRedirection = location.startsWith('/') ? uri.origin + location : location;
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

  options.uri = new URL(options.uri);
  const url = options.uri;

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
