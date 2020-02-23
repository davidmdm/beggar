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
const { sanitizeOpts } = require('./options');

const version = require('../package.json').version;
const methods = http.METHODS.map(method => method.toLowerCase());

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

const createProxiedConnection = options => {
  const passthrough = new PassThrough();
  const conn = new Connection(passthrough, options);

  const proxyAuth =
    options.proxy.username &&
    options.proxy.password &&
    'Basic ' + Buffer.from(`${options.proxy.username}:${options.proxy.password}`).toString('base64');

  const proxyHttpLib = httpLib(options.proxy.protocol);
  const targetHttpLib = httpLib(options.uri.protocol);

  const proxyPath = util.format(
    '%s:%s',
    options.uri.hostname,
    options.uri.port || targetHttpLib.globalAgent.defaultPort
  );

  proxyHttpLib
    .request({
      host: options.proxy.hostname,
      port: options.proxy.port,
      headers: {
        host: options.uri.host,
        'User-Agent': (options.headers && options.headers['user-agent']) || defaultUserAgent,
        ...(proxyAuth ? { 'Proxy-Authorization': proxyAuth } : undefined),
      },
      method: 'CONNECT',
      path: proxyPath,
      agent: false,
      ...options.proxyTls,
    })
    .on('connect', function(_, socket) {
      const req = targetHttpLib
        .request(options.uri, {
          method: options.method && options.method.toUpperCase(),
          headers: { 'User-Agent': defaultUserAgent, ...options.headers },
          auth: options.auth && options.auth.user + ':' + options.auth.pass,
          createConnection: () => {
            if (options.uri.protocol === 'http:') {
              return socket;
            }
            return tls.connect(0, { ...options.tls, servername: options.uri.host, socket });
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
    .on('error', err => conn.emit('error', err))
    .end();

  return conn;
};

const createConnection = options => {
  const req = httpLib(options.uri.protocol).request(options.uri, {
    method: options.method && options.method.toUpperCase(),
    headers: { 'User-Agent': defaultUserAgent, ...options.headers },
    auth: options.auth && options.auth.user + ':' + options.auth.pass,
    agent: options.agent,
    ...options.tls,
  });

  const responsePromise = new Promise((resolve, reject) =>
    req.on('response', resp => {
      if (options.maxRedirects > 0 && resp.statusCode >= 301 && resp.statusCode <= 303) {
        const location = resp.headers.location;
        const qualifiedRedirection = location.startsWith('/') ? options.uri.origin + location : location;

        // we do no want to leak memory so we must consume response stream,
        // but we do not want to destroy the response as that would destroy the underlying
        // socket and our agent could possible reuse it.
        resp.on('data', () => {});

        return request
          .get(qualifiedRedirection, { maxRedirects: options.maxRedirects - 1 })
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

function isUri(value) {
  return typeof value === 'string' || value instanceof URL;
}

function request(uri, opts = {}) {
  const options = sanitizeOpts(isUri(uri) ? { ...opts, uri } : uri);

  if (options.qs) {
    options.uri.search = qs.stringify({ ...Object.fromEntries(options.uri.searchParams), ...options.qs });
  } else if (options.query) {
    options.uri.search = querystring.stringify({ ...Object.fromEntries(options.uri.searchParams), ...options.query });
  }

  const conn = options.proxy ? createProxiedConnection(options) : createConnection(options);

  if (!options.method || options.method.toLowerCase() === 'get') {
    conn.end();
  } else if (typeof options.body === 'string' || options.body instanceof Buffer) {
    conn.setHeader('Content-Length', options.body.length);
    conn.end(options.body);
  } else if (options.body instanceof Readable && options.body._readableState.objectMode === false) {
    options.body.pipe(conn);
  } else if (options.body !== undefined) {
    const payload = JSON.stringify(options.body);
    conn.setHeader('Content-Type', 'application/json; charset=utf-8');
    conn.setHeader('Content-Length', payload.length);
    conn.end(payload);
  } else if (options.form) {
    const payload = qs.stringify(options.form);
    conn.setHeader('Content-Type', 'application/x-www-form-urlencoded');
    conn.setHeader('Content-Length', payload.length);
    conn.end(payload);
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

for (const method of methods) {
  request[method] = (uri, options = {}) => {
    if (isUri(uri)) {
      return request(uri, { ...options, method });
    }
    return request({ ...uri, method });
  };
}

const wrapWithDefaults = (fn, defaults) => {
  return (uri, opts = {}) => {
    if (isUri(uri)) {
      return fn(uri, { ...defaults, ...opts });
    }
    return fn({ ...defaults, ...uri });
  };
};

request.defaults = defaults => {
  const wrapper = wrapWithDefaults(request, defaults);
  for (const method of methods) {
    wrapper[method] = wrapWithDefaults(request[method], defaults);
  }
  return wrapper;
};

module.exports = { request };
