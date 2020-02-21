'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const { request: beggar } = require('..');

const serverKey = fs.readFileSync(path.resolve('test', 'assets', 'server.key'));
const serverCert = fs.readFileSync(path.resolve('test', 'assets', 'server.cert'));
const proxyKey = fs.readFileSync(path.resolve('test', 'assets', 'proxy.key'));
const proxyCert = fs.readFileSync(path.resolve('test', 'assets', 'proxy.cert'));

const serve = str => (_, res) => res.writeHead(200, { 'Content-Type': 'text/plan' }).end(str);

const listen = (server, port) => {
  return new Promise((resolve, reject) => {
    server
      .on('listening', resolve)
      .on('error', reject)
      .listen(port);
  });
};

describe('Proxy tests', () => {
  const httpProxyUri = 'http://localhost:3000';
  const httpServer = 'http://localhost:4000';
  const httpsServer = 'https://localhost:8000';
  const httpsProxy = 'https://localhost:5000';

  before(async () => {
    const httpProxy = http.createServer(serve('http proxy'));
    const httpServer = http.createServer(serve('http server'));
    const httpsProxy = https.createServer({ key: proxyKey, cert: proxyCert }, serve('https proxy'));
    const httpsServer = https.createServer({ key: serverKey, cert: serverCert }, serve('https server'));

    await Promise.all([
      listen(httpProxy, 3000),
      listen(httpServer, 4000),
      listen(httpsProxy, 5000),
      listen(httpsServer, 8000),
    ]);
  });

  it('should proxy https over http', async () => {});
});
