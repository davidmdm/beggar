//@ts-nocheck
'use strict';

const assert = require('assert');
const { Readable, Writable } = require('stream');

const { request } = require('../src');
const { createServer } = require('./server');
const { spy } = require('../src/spy');

describe('Tests', () => {
  let baseUri;
  let testingServer;

  before(async () => {
    testingServer = createServer();
    await new Promise(resolve => testingServer.listen(resolve));
    baseUri = 'http://localhost:' + testingServer.address().port;
  });

  after(() => new Promise(resolve => testingServer.close(resolve)));

  it('should send a get request to homepage', async () => {
    const homepageResponse = await request(baseUri + '/home');
    assert.equal(homepageResponse.statusCode, 200);
    assert.equal(homepageResponse.body, 'Welcome to the homepage');
  });

  it('should send data via options.body', async () => {
    const echoResponse = await request({
      method: 'post',
      uri: baseUri + '/echo',
      body: 'my test payload',
    });

    assert.deepEqual(echoResponse.statusCode, 200);
    assert.deepEqual(echoResponse.body, 'my test payload');
  });

  it('should send data via stream write and end methods', async () => {
    const req = request({ method: 'post', uri: baseUri + '/echo' });
    req.write('my test stream.write payload');
    req.end();

    const echoResponse = await req;
    assert.deepEqual(echoResponse.statusCode, 200);
    assert.deepEqual(echoResponse.body, 'my test stream.write payload');
  });

  it('should pipe data to request', async () => {
    const readable = new Readable();
    readable.push('readable data');
    readable.push(null);

    const echoResponse = await readable.pipe(request({ method: 'post', uri: baseUri + '/echo' }));
    assert.deepEqual(echoResponse.statusCode, 200);
    assert.deepEqual(echoResponse.body, 'readable data');
  });

  it('should pipe data to request and pipe data from response', async () => {
    const readable = new Readable();
    readable.push('pipe in pipe out');
    readable.push(null);

    let buffer = Buffer.from([]);

    await new Promise(resolve =>
      readable
        .pipe(request({ method: 'post', uri: baseUri + '/echo' }))
        .pipe(
          new Writable({
            write(chunk, _, cb) {
              buffer = Buffer.concat([buffer, chunk]);
              cb();
            },
          })
        )
        .on('finish', resolve)
    );

    assert.equal(buffer.toString(), 'pipe in pipe out');
  });

  it('should read the body via data events', async () => {
    let body = '';
    const req = request(baseUri + '/home');
    req.end();
    req.on('data', data => (body += data));
    await new Promise(resolve => req.on('end', resolve));
    assert.equal(body, 'Welcome to the homepage');
  });

  it('should pipe the data response body to a given writable source', async () => {
    let buffer = Buffer.from([]);

    await new Promise(resolve =>
      request(baseUri + '/home')
        .pipe(
          new Writable({
            write(chunk, _, cb) {
              buffer = Buffer.concat([buffer, chunk]);
              cb();
            },
          })
        )
        .on('finish', resolve)
    );

    assert.equal(buffer.toString(), 'Welcome to the homepage');
  });

  it('should fail return 401 if no basic auth is provided', async () => {
    const response = await request(baseUri + '/basicAuth');
    assert.equal(response.statusCode, 401);
  });

  it('should give proper basic authentication credentials', async () => {
    const response = await request({
      uri: baseUri + '/basicAuth',
      auth: { user: 'admin', pass: '1234' },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body, 'Authenticated material');
  });
});
