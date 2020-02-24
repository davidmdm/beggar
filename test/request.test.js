'use strict';

const assert = require('assert');

const { URL } = require('url');
const { format } = require('util');
const { Readable, Writable } = require('stream');

const { beggar, CancelError } = require('..');
const { createServer } = require('./server');

const testingServer = createServer();

const readableToBuffer = readable => {
  return new Promise((resolve, reject) => {
    const parts = [];
    readable
      .on('data', data => parts.push(data))
      .on('end', () => resolve(Buffer.concat(parts)))
      .on('error', reject);
  });
};

describe('Tests', () => {
  let baseUri;

  before(async () => {
    await new Promise(resolve => testingServer.listen(0, resolve));
    //@ts-ignore
    baseUri = 'http://localhost:' + testingServer.address().port;
  });

  after(() => new Promise(resolve => testingServer.close(resolve)));

  it('should not drop beginning of payload when response is read to later', async () => {
    const echoRequest = beggar({
      method: 'post',
      uri: baseUri + '/echo',
      body: 'the string I want it to echo back to me',
    });

    await new Promise(resolve => setTimeout(resolve, 200));

    const response = await echoRequest;
    assert.equal(response.body, 'the string I want it to echo back to me');
  });

  it('should send a get request to homepage', async () => {
    const homepageResponse = await beggar(baseUri + '/home');
    assert.equal(homepageResponse.statusCode, 200);
    assert.equal(homepageResponse.body, 'Welcome to the homepage');
  });

  it('should support a URL as argument for a request', async () => {
    const homepageResponse = await beggar(new URL(baseUri + '/home'));
    assert.equal(homepageResponse.statusCode, 200);
    assert.equal(homepageResponse.body, 'Welcome to the homepage');
  });

  it('should send data via options.body (string)', async () => {
    const echoResponse = await beggar({
      method: 'post',
      uri: baseUri + '/echo',
      body: 'my test payload',
    });

    assert.deepEqual(echoResponse.statusCode, 200);
    assert.deepEqual(echoResponse.body.toString(), 'my test payload');
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

    const echoResponse = await beggar({
      method: 'post',
      uri: baseUri + '/echo',
      body: readable,
    });

    assert.deepEqual(echoResponse.statusCode, 200);
    assert.deepEqual(echoResponse.body.toString(), 'my test payload');
  });

  it('should send data via options.body (buffer)', async () => {
    const echoResponse = await beggar({
      method: 'post',
      uri: baseUri + '/echo',
      body: Buffer.from('my test payload'),
    });

    assert.deepEqual(echoResponse.statusCode, 200);
    assert.deepEqual(echoResponse.body.toString(), 'my test payload');
  });

  it('should send data via stream write and end methods', async () => {
    const req = beggar({ method: 'post', uri: baseUri + '/echo' });
    req.write('my test stream.write payload');
    req.end();

    const echoResponse = await req;
    assert.deepEqual(echoResponse.statusCode, 200);
    assert.deepEqual(echoResponse.body.toString(), 'my test stream.write payload');
  });

  it('should pipe data to request', async () => {
    const readable = new Readable();
    readable.push('readable data');
    readable.push(null);

    const echoResponse = await readable.pipe(beggar({ method: 'post', uri: baseUri + '/echo' }));
    assert.deepEqual(echoResponse.statusCode, 200);
    assert.deepEqual(echoResponse.body.toString(), 'readable data');
  });

  it('should pipe data to request and pipe data from response', async () => {
    const readable = new Readable();
    readable.push('pipe in pipe out');
    readable.push(null);

    let buffer = Buffer.from([]);

    await new Promise(resolve =>
      readable
        .pipe(beggar({ method: 'post', uri: baseUri + '/echo' }))
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
    const req = beggar(baseUri + '/home');
    req.end();
    req.on('data', data => (body += data));
    await new Promise(resolve => req.on('end', resolve));
    assert.equal(body, 'Welcome to the homepage');
  });

  it('should pipe the data response body to a given writable source', async () => {
    let buffer = Buffer.from([]);

    await new Promise(resolve =>
      beggar(baseUri + '/home')
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
    const response = await beggar.get(baseUri + '/redirect/3');
    assert.equal(response.statusCode, 302);
    assert.equal(response.headers.location, '/redirect/2');
  });

  it('should redirect if followAllRedirects is true (promises)', async () => {
    const response = await beggar.get({ uri: baseUri + '/redirect/3', followAllRedirects: true });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body, 'Welcome to the homepage');
    assert.deepEqual(response.redirects, [baseUri + '/redirect/2', baseUri + '/redirect/1', baseUri + '/home']);
  });

  it('should redirect a maximum number of times', async () => {
    const response = await beggar.get({ uri: baseUri + '/redirect/9', maxRedirects: 5 });
    assert.equal(response.statusCode, 302);
    assert.deepEqual(response.redirects, [
      baseUri + '/redirect/8',
      baseUri + '/redirect/7',
      baseUri + '/redirect/6',
      baseUri + '/redirect/5',
      baseUri + '/redirect/4',
    ]);
  });

  it('should redirect if followAllRedirects is true (streams)', async () => {
    let buffer = Buffer.from([]);
    await new Promise(resolve =>
      beggar
        .get({ uri: baseUri + '/redirect/3', followAllRedirects: true })
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
      beggar({
        uri: baseUri + '/redirectToHangUp',
        followAllRedirects: true,
      }),
      {
        message: 'socket hang up',
      }
    );
  });

  it('should throw appropriate error if redirect end in some response error (stream)', async () => {
    const err = await new Promise(resolve =>
      beggar({
        uri: baseUri + '/redirectToHangUp',
        followAllRedirects: true,
      }).on('error', resolve)
    );

    assert.equal(err.message, 'socket hang up');
  });

  it('should send a properly parsable x-www-form-urlencoded when options.form is supplied', async () => {
    const options = {
      method: 'post',
      uri: baseUri + '/url-encoded',
      form: { hello: 'world', arr: [1, 2, 3] },
    };
    const formResponse = await beggar(options);
    assert.equal(formResponse.statusCode, 200);
    assert.deepEqual(formResponse.body, options.form);
  });

  it('should send a multipart form', async () => {
    const jsonReadable = new Readable();
    jsonReadable.push(JSON.stringify({ hello: 'world' }));
    jsonReadable.push(null);

    const formResponse = await beggar({
      method: 'post',
      uri: baseUri + '/multipart',
      formData: {
        jsonReadable,
        key: 'value',
      },
    });

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
    const resp = await beggar.get({
      uri: baseUri + '/query',
      query: { answer: 42 },
    });
    assert.deepEqual(resp.body, { answer: 42 });
  });

  it('should override defined values in hardcoded query string', async () => {
    const resp = await beggar.get({
      uri: baseUri + '/query?hello=world&patate=aubergine',
      query: { patate: 'patate' },
    });
    assert.deepEqual(resp.body, { hello: 'world', patate: 'patate' });
  });

  it('should fail return 401 if no basic auth is provided', async () => {
    const response = await beggar(baseUri + '/basicAuth');
    assert.equal(response.statusCode, 401);
  });

  it('should give proper basic authentication credentials', async () => {
    const response = await beggar({
      uri: baseUri + '/basicAuth',
      auth: { user: 'admin', pass: '1234' },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body, 'Authenticated material');
  });

  it('should catch a response error ie socket hang up', async () => {
    await assert.rejects(beggar(baseUri + '/connection-drop'), { message: 'socket hang up' });
  });

  it('should catch a request error ie ECONNREFUSED', async () => {
    await assert.rejects(beggar('http://localhost:1234'), { message: 'connect ECONNREFUSED 127.0.0.1:1234' });
  });

  it('should emit an error not using promises (response error)', async () => {
    const error = await new Promise(resolve =>
      beggar(baseUri + '/connection-drop')
        .on('error', resolve)
        .end()
    );
    assert.ok(error);
    assert.equal(error.message, 'socket hang up');
  });

  it('should emit an error not using promises (request error)', async () => {
    const error = await new Promise(resolve =>
      beggar('http://localhost:1234')
        .on('error', resolve)
        .end()
    );
    assert.ok(error);
    assert.equal(error.message, 'connect ECONNREFUSED 127.0.0.1:1234');
  });

  for (const method of ['get', 'post', 'put', 'patch']) {
    it(format('should have utility method for making (%s) request', method.toUpperCase()), async () => {
      const response = await beggar[method](baseUri + '/details');
      assert.equal(response.statusCode, 200);
      assert.equal(response.body.request.method, method.toUpperCase());
    });
  }

  it('should support headers as array of strings', async () => {
    const response = await beggar({
      uri: baseUri + '/details',
      headers: { 'Accept-Encoding': ['application/octet-stream', 'application/zip'] },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.request.headers['accept-encoding'], 'application/octet-stream, application/zip');
  });

  it('should send request with options.body with a content-type of application/json', async () => {
    const response = await beggar.put({
      uri: baseUri + '/details',
      body: { hello: 'world' },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.request.headers['content-type'], 'application/json; charset=utf-8');
    assert.equal(response.body.request.body, '{"hello":"world"}');
  });

  it('should implicitly parse response.body as json if content-type of response is application/json', async () => {
    const response = await beggar.post(baseUri + '/echo-json', { body: { parse: 'json' } });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, { parse: 'json' });
  });

  it('should bypass implicit parsing and return body as buffer if options.raw is true (json)', async () => {
    const response = await beggar.post(baseUri + '/echo-json', { body: { parse: 'json' }, raw: true });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, Buffer.from(JSON.stringify({ parse: 'json' })));
  });

  it('should bypass implicit parsing and return body as empty buffer if options.raw is true and no content is sent (json)', async () => {
    const response = await beggar.get(baseUri + '/echo-json', { raw: true });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, Buffer.from([]));
  });

  it('should implicitly parse response.body as string if content-type of response is text', async () => {
    const response = await beggar.post(baseUri + '/echo-text', { body: { parse: 'text' } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body, '{"parse":"text"}');
  });

  it('should bypass implicit parsing and return body as buffer if options.raw is true (text)', async () => {
    const response = await beggar.post(baseUri + '/echo-text', { body: { parse: 'text' }, raw: true });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, Buffer.from('{"parse":"text"}'));
  });

  it('should bypass implicit parsing and return body as empty buffer if options.raw is true and no content (text)', async () => {
    const response = await beggar.get(baseUri + '/echo-text', { raw: true });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, Buffer.from([]));
  });

  it('should have an undefined response.body if content-type is json and no body was sent back', async () => {
    const response = await beggar.get(baseUri + '/echo-json');
    assert.equal(response.statusCode, 200);
    assert.equal(response.body, undefined);
  });

  it('should have an empty string on response.body if content-type is text and no body was sent back', async () => {
    const response = await beggar.get(baseUri + '/echo-text');
    assert.equal(response.statusCode, 200);
    assert.equal(response.body, '');
  });

  it('should have an empty buffer on response.body if content-type is not json or text and no body was sent back', async () => {
    const response = await beggar.get(baseUri + '/echo');
    assert.equal(response.statusCode, 200);
    assert.equal(response.body, '');
  });

  it('should decompress when Content-Encoding is set on response (promises)', async () => {
    const [decompressed, compressed] = await Promise.all([
      beggar.post({ uri: baseUri + '/compression?encodings=br,gzip', body: 'hello world', decompress: true }),
      beggar.post({ uri: baseUri + '/compression?encodings=br,gzip', body: 'hello world', decompress: false }),
    ]);

    assert.equal(decompressed.statusCode, 200);
    assert.equal(compressed.statusCode, 200);

    assert.equal(decompressed.headers['content-encoding'], 'br,gzip');
    assert.equal(compressed.headers['content-encoding'], 'br,gzip');

    assert.notEqual(decompressed.body.toString(), compressed.body.toString());
    assert.equal(decompressed.body.toString(), 'hello world');
  });

  it('should decompress when Content-Encoding is set on response (streams)', async () => {
    const [decompressedBuffer, compressedBuffer] = await Promise.all(
      [
        beggar.post({ uri: baseUri + '/compression?encodings=br,gzip', body: 'hello world', decompress: true }),
        beggar.post({ uri: baseUri + '/compression?encodings=br,gzip', body: 'hello world', decompress: false }),
      ].map(readableToBuffer)
    );

    assert.notEqual(decompressedBuffer.toString(), compressedBuffer.toString());
    assert.equal(decompressedBuffer.toString(), 'hello world');
  });

  it('should send request with correct method when using request[method](string|URL) syntax', async () => {
    const put = await beggar.put(baseUri + '/details');
    const post = await beggar.post(new URL(baseUri + '/details'));
    assert.equal(put.body.request.method, 'PUT');
    assert.equal(post.body.request.method, 'POST');
  });

  it('should user method helper function and ignore options.method', async () => {
    const put = await beggar.put(baseUri + '/details', { method: 'get' });
    assert.equal(put.body.request.method, 'PUT');
  });

  it('should reject an error if response has a bad statuscode if option.rejectError is true', async () => {
    const promise = beggar.get(baseUri + '/400-json', { rejectError: true });
    await assert.rejects(promise, {
      message: 'custom error message',
      statusCode: 400,
      body: {
        description: 'other field',
        message: 'custom error message',
      },
    });
    // There is a date field in the headers that i can't do deep comparison on.
    // Here I just want to assert that the response headers are part of the error.
    const error = await promise.catch(err => err);
    assert.equal(error.headers['content-type'], 'application/json; charset=utf8');
    assert.equal(error.headers['transfer-encoding'], 'chunked');
    assert.equal(error.headers.connection, 'close');
  });

  it('should reject a text error if response has a bad statuscode if option.rejectError is true', async () => {
    const promise = beggar.get(baseUri + '/403-text', { rejectError: true });
    await assert.rejects(promise, {
      message: 'Forbidden',
      statusCode: 403,
      body: '<html><body>Error Occured!!!</body></html>',
    });
    // There is a date field in the headers that i can't do deep comparison on.
    // Here I just want to assert that the response headers are part of the error.
    const error = await promise.catch(err => err);
    assert.equal(error.headers['content-type'], 'text/html; charset=utf8');
    assert.equal(error.headers['transfer-encoding'], 'chunked');
    assert.equal(error.headers.connection, 'close');
  });

  it('calling then multiple times should return the same response', async () => {
    const req = beggar(baseUri + '/details');
    const [p1, p2] = await Promise.all([req.then(resp => resp), req.then(resp => resp)]);
    assert.deepEqual(p1, p2);
  });

  it('should return the same response when calling then again after an initial promise has resolved', async () => {
    const req = beggar(baseUri + '/details');
    const p1 = await req.then(resp => resp);
    const p2 = await req.then(resp => resp);
    assert.deepEqual(p1, p2);
  });
  it('should make request with defaults', async () => {
    const r = beggar.defaults({ auth: { user: 'test', pass: 'test' } });
    const resp = await r({ uri: baseUri + '/details' });
    const expectedAuth = 'Basic ' + Buffer.from('test:test').toString('base64');
    assert.equal(resp.body.request.headers.authorization, expectedAuth);
  });

  it('should make request with defaults (utility method)', async () => {
    const r = beggar.defaults({ auth: { user: 'test', pass: 'test' } });
    const resp = await r.get(baseUri + '/details');
    const expectedAuth = 'Basic ' + Buffer.from('test:test').toString('base64');
    assert.equal(resp.body.request.headers.authorization, expectedAuth);
  });

  it('should override defaults', async () => {
    const r = beggar.defaults({ auth: { user: 'test', pass: 'test' } });
    const resp = await r.get(baseUri + '/details', { auth: { user: 'patate', pass: 'aubergine' } });
    const expectedAuth = 'Basic ' + Buffer.from('patate:aubergine').toString('base64');
    assert.equal(resp.body.request.headers.authorization, expectedAuth);
  });

  it('should cancel a request preemptively', async function() {
    this.timeout(10000);
    const conn = beggar.get(baseUri + '/slow');
    conn.cancel();
    await assert.rejects(conn, { message: 'Request Cancelled' });
    //@ts-ignore
    assert.equal(conn.outgoingMessage.aborted, true);
    assert.equal(conn.isCancelled, true);
  });

  it('should cancel a request midflight', async function() {
    this.timeout(10000);
    const conn = beggar.get(baseUri + '/slow');
    setTimeout(() => conn.cancel(), 2000);
    await assert.rejects(conn, { message: 'Request Cancelled' });
    //@ts-ignore
    assert.equal(conn.outgoingMessage.aborted, true);
    assert.equal(conn.isCancelled, true);
  });

  it('beggar connection should emit abort and emit error with cancel error', async function() {
    this.timeout(10000);
    const conn = beggar.get(baseUri + '/slow');
    setTimeout(() => conn.cancel(), 1000);
    const abortPromise = new Promise(resolve => conn.once('abort', resolve));
    const errPromise = new Promise(resolve => conn.once('error', resolve));

    await abortPromise;
    const err = await errPromise;

    assert.equal(err instanceof CancelError, true);
    //@ts-ignore
    assert.equal(conn.outgoingMessage.aborted, true);
    assert.equal(conn.isCancelled, true);

    const err2 = await conn.catch(err => err);
    assert.equal(err, err2);
  });

  it('cancelled requests should reject the same error every time catch is invoked', async function() {
    this.timeout(10000);
    const conn = beggar.get(baseUri + '/slow');
    conn.cancel();

    const p1 = conn.catch(err => err);
    const p2 = conn.catch(err => err);
    assert.notEqual(p1, p2);

    const [err1, err2] = await Promise.all([p1, p2]);
    assert.equal(err1 instanceof CancelError, true);
    assert.equal(err1.message, 'Request Cancelled');
    assert.equal(err1, err2);
  });
});
