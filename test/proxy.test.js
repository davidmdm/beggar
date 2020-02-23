'use strict';

const fs = require('fs');
const net = require('net');
const path = require('path');
const http = require('http');
const https = require('https');
const assert = require('assert');

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

// Example of proxy server Connect handler taken from NodeJS http DOCS
// https://nodejs.org/api/http.html#http_event_connect
const onConnect = (req, clientSocket, head) => {
  const { port, hostname } = new URL(`http://${req.url}`);
  const serverSocket = net.connect(Number(port) || 80, hostname, () => {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n' + 'Proxy-agent: Node.js-Proxy\r\n' + '\r\n');
    serverSocket.write(head);
    serverSocket.pipe(clientSocket);
    clientSocket.pipe(serverSocket);
  });
};

describe('Proxy tests', () => {
  const httpProxyUri = 'http://localhost:3000';
  const httpServerUri = 'http://localhost:4000';
  const httpsServerUri = 'https://localhost:8000';
  const httpsProxyUri = 'https://localhost:5000';

  before(async () => {
    const httpProxy = http.createServer(serve('http proxy'));
    const httpServer = http.createServer(serve('http server'));
    const httpsProxy = https.createServer({ key: proxyKey, cert: proxyCert }, serve('https proxy'));
    const httpsServer = https.createServer({ key: serverKey, cert: serverCert }, serve('https server'));

    httpProxy.on('connect', onConnect);
    httpsProxy.on('connect', onConnect);

    await Promise.all([
      listen(httpProxy, 3000),
      listen(httpServer, 4000),
      listen(httpsProxy, 5000),
      listen(httpsServer, 8000),
    ]);
  });

  it('should proxy http over http', async () => {
    const response = await beggar.get({
      uri: httpServerUri,
      proxy: httpProxyUri,
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body, 'http server');
  });

  it('should proxy https over http', async () => {
    const response = await beggar.get({
      uri: httpsServerUri,
      tls: { ca: [serverCert] },
      proxy: httpProxyUri,
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body, 'https server');
  });

  it('should proxy http over https', async () => {
    const response = await beggar.get({
      uri: httpServerUri,
      proxy: { uri: httpsProxyUri, tls: { ca: [proxyCert] } },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body, 'http server');
  });

  it('should proxy https over https', async () => {
    const response = await beggar.get({
      uri: httpsServerUri,
      tls: { ca: [serverCert] },
      proxy: { uri: httpsProxyUri, tls: { ca: [proxyCert] } },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body, 'https server');
  });
});
