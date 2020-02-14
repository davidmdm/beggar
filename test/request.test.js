//@ts-nocheck
'use strict';

const assert = require('assert');

const { URL } = require('url');
const { format } = require('util');
const { Readable, Writable } = require('stream');

const { request } = require('..');
const { createServer } = require('./server');

const testingServer = createServer();

describe('Tests', () => {
  let baseUri;

  before(async () => {
    await new Promise(resolve => testingServer.listen(0, resolve));
    baseUri = 'http://localhost:' + testingServer.address().port;
  });

  after(() => new Promise(resolve => testingServer.close(resolve)));

  it('should not drop beginning of payload when response is read to later', async () => {
    const echoRequest = request({
      method: 'post',
      uri: baseUri + '/echo',
      body: 'the string I want it to echo back to me',
    });

    await new Promise(resolve => setTimeout(resolve, 200));

    const response = await echoRequest;
    assert.equal(response.body, 'the string I want it to echo back to me');
  });

  it('should send a get request to homepage', async () => {
    const homepageResponse = await request(baseUri + '/home');
    assert.equal(homepageResponse.statusCode, 200);
    assert.equal(homepageResponse.body, 'Welcome to the homepage');
  });

  it('should support a URL as argument for a request', async () => {
    const homepageResponse = await request(new URL(baseUri + '/home'));
    assert.equal(homepageResponse.statusCode, 200);
    assert.equal(homepageResponse.body, 'Welcome to the homepage');
  });

  it('should send data via options.body (string)', async () => {
    const echoResponse = await request({
      method: 'post',
      uri: baseUri + '/echo',
      body: 'my test payload',
    });

    assert.deepEqual(echoResponse.statusCode, 200);
    assert.deepEqual(echoResponse.body, 'my test payload');
  });

  it('should send data via options.body (readable)', async () => {
    let readableDone = false;
    const readable = new Readable({
      read() {
        setTimeout(() => {
          if (readableDone) {
            this.push(null);
          } else {
            this.push('my test payload');
            readableDone = true;
          }
        }, 25);
      },
    });

    const echoResponse = await request({
      method: 'post',
      uri: baseUri + '/echo',
      body: readable,
    });

    assert.deepEqual(echoResponse.statusCode, 200);
    assert.deepEqual(echoResponse.body, 'my test payload');
  });

  it('should send data via options.body (buffer)', async () => {
    const echoResponse = await request({
      method: 'post',
      uri: baseUri + '/echo',
      body: Buffer.from('my test payload'),
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

  it('should not redirect if option is not set', async () => {
    const response = await request.get(baseUri + '/redirect/3');
    assert.equal(response.statusCode, 302);
    assert.equal(response.headers.location, '/redirect/2');
  });

  it('should redirect if followRedirects is true (promises)', async () => {
    const response = await request.get({ uri: baseUri + '/redirect/3', followRedirects: true });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body, 'Welcome to the homepage');
    assert.deepEqual(response.redirects, [baseUri + '/redirect/2', baseUri + '/redirect/1', baseUri + '/home']);
  });

  it('should redirect if followRedirects is true (streams)', async () => {
    let buffer = Buffer.from([]);
    await new Promise(resolve =>
      request
        .get({ uri: baseUri + '/redirect/3', followRedirects: true })
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

  it('should throw appropriate error if redirect end in some response error (promises)', async () => {
    await assert.rejects(
      request({
        uri: baseUri + '/redirectToHangUp',
        followRedirects: true,
      }),
      {
        message: 'socket hang up',
      }
    );
  });

  it('should throw appropriate error if redirect end in some response error (stream)', async () => {
    const err = await new Promise(resolve =>
      request({
        uri: baseUri + '/redirectToHangUp',
        followRedirects: true,
      }).on('error', resolve)
    );

    assert.equal(err.message, 'socket hang up');
  });

  it('should send a properly parsable x-www-form-urlencoded when options.form is supplied', async () => {
    const options = {
      method: 'post',
      uri: baseUri + '/url-encoded',
      form: { hello: 'world', arr: [1, 2, 3] },
      json: true,
    };
    const formResponse = await request(options);
    assert.equal(formResponse.statusCode, 200);
    assert.deepEqual(formResponse.body, options.form);
  });

  it('should send a multipart form', async () => {
    const jsonReadable = new Readable();
    jsonReadable.push(JSON.stringify({ hello: 'world' }));
    jsonReadable.push(null);

    const options = {
      method: 'post',
      uri: baseUri + '/multipart',
      formData: {
        jsonReadable,
        key: 'value',
      },
      json: true,
    };
    const formResponse = await request(options);
    assert.equal(formResponse.statusCode, 200);
    assert.deepEqual(formResponse.body, [
      {
        fieldname: 'jsonReadable',
        data: '{"hello":"world"}',
      },
      {
        fieldname: 'key',
        data: 'value',
      },
    ]);
  });

  it('should send and return query', async () => {
    const resp = await request.get({
      uri: baseUri + '/query',
      query: { answer: 42 },
      json: true,
    });
    assert.deepEqual(resp.body, { answer: 42 });
  });

  it('should override defined values in hardcoded query string', async () => {
    const resp = await request.get({
      uri: baseUri + '/query?hello=world&patate=aubergine',
      query: { patate: 'patate' },
      json: true,
    });
    assert.deepEqual(resp.body, { hello: 'world', patate: 'patate' });
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

  it('should catch a response error ie socket hang up', async () => {
    await assert.rejects(request(baseUri + '/connection-drop'), { message: 'socket hang up' });
  });

  it('should catch a request error ie ECONNREFUSED', async () => {
    await assert.rejects(request('http://localhost:1234'), { message: 'connect ECONNREFUSED 127.0.0.1:1234' });
  });

  it('should emit an error not using promises (response error)', async () => {
    const error = await new Promise(resolve =>
      request(baseUri + '/connection-drop')
        .on('error', resolve)
        .end()
    );
    assert.ok(error);
    assert.equal(error.message, 'socket hang up');
  });

  it('should emit an error not using promises (request error)', async () => {
    const error = await new Promise(resolve =>
      request('http://localhost:1234')
        .on('error', resolve)
        .end()
    );
    assert.ok(error);
    assert.equal(error.message, 'connect ECONNREFUSED 127.0.0.1:1234');
  });

  for (const method of ['get', 'post', 'put', 'patch']) {
    it(format('should have utility method for making (%s) request', method.toUpperCase()), async () => {
      const response = await request[method](baseUri + '/details', { json: true });
      assert.equal(response.statusCode, 200);
      assert.equal(response.body.request.method, method.toUpperCase());
    });
  }

  it('should support headers as array of strings', async () => {
    const response = await request({
      uri: baseUri + '/details',
      headers: { 'Accept-Encoding': ['application/octet-stream', 'application/zip'] },
      json: true,
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.request.headers['accept-encoding'], 'application/octet-stream, application/zip');
  });
});
