'use strict';

const http = require('http');
const { format } = require('util');
const { Duplex } = require('stream');

const zlib = require('zlib');

const decompressions = {
  gzip: zlib.createGunzip,
  deflate: zlib.createInflate,
  br: zlib.createBrotliDecompress,
};

function applyDecompression(response) {
  if (!response.headers['content-encoding']) {
    return response;
  }
  return response.headers['content-encoding']
    .split(/\s*,\s*/)
    .filter(enc => enc && enc !== 'identity')
    .reduceRight((acc, enc) => acc.pipe(decompressions[enc]()), response);
}

function drain(src, dst) {
  src.once('readable', () => {
    for (;;) {
      const chunk = src.read();
      if (chunk === null) {
        break;
      }
      dst.push(chunk);
    }
  });
}

function readableToBuffer(readable) {
  return new Promise((resolve, reject) => {
    const parts = [];
    readable
      .on('data', data => parts.push(data))
      .on('end', () => resolve(Buffer.concat(parts)))
      .on('error', reject);
  });
}

function statusOk(statusCode) {
  return statusCode >= 200 && statusCode < 300;
}

class HttpError extends Error {
  constructor(statusCode, message, headers, body) {
    super(message);
    this.statusCode = statusCode;
    this.headers = headers;
    this.body = body;
  }
}

function parseResponseBuffer(contentType = '', buffer) {
  if (contentType.startsWith('application/json')) {
    return buffer.length > 0 ? JSON.parse(buffer.toString()) : undefined;
  }
  if (contentType.startsWith('text')) {
    return buffer.toString();
  }
  return buffer;
}

function getResponseError(response, buffer) {
  const payload = parseResponseBuffer(response.headers['content-type'], buffer);
  if (typeof payload === 'string' || payload instanceof Buffer) {
    return new HttpError(
      response.statusCode,
      http.STATUS_CODES[response.statusCode],
      response.headers,
      buffer.toString()
    );
  }
  return new HttpError(
    response.statusCode,
    payload.message || http.STATUS_CODES[response.statusCode],
    response.headers,
    payload
  );
}

class Connection extends Duplex {
  constructor(dst, opts) {
    super();
    this.dst = dst;
    this.opts = opts;
    this.source = null;
    this.incomingMessage = null;
    this.outgoingMessage = null;
    this.responsePromise = null;
    this.outgoingHeaders = {};

    const pipe = Duplex.prototype.pipe.bind(this);
    this.isPipedTo = false;
    this.pipe = (...args) => {
      if (!this.isPipedTo) {
        this.end();
      }
      return pipe(...args);
    };

    this.once('response', response => {
      this.incomingMessage = response;
      this.source = opts.decompress ? applyDecompression(response) : response;
      this.source.on('end', () => this.push(null));
      this.emit('_source_');
    })
      .once('request', request => {
        this.outgoingMessage = request;
        for (const [name, value] of Object.entries(this.outgoingHeaders)) {
          this.outgoingMessage.setHeader(name, value);
        }
      })
      .once('finish', () => this.dst.end())
      .once('pipe', () => (this.isPipedTo = true));
  }

  _read() {
    if (!this.source) {
      return this.once('_source_', () => drain(this.source, this));
    }
    drain(this.source, this);
  }

  _write(chunk, enc, cb) {
    this.dst.write(chunk, enc, cb);
  }

  setHeader(name, value) {
    this.outgoingHeaders[name] = value;
    if (this.outgoingMessage) {
      this.outgoingMessage.setHeader(name, value);
    }
  }

  then(fn, handle) {
    if (this.responsePromise) {
      return this.responsePromise.then(fn, handle);
    }
    this.responsePromise = Promise.race([
      (async () => {
        if (!this.isPipedTo) {
          this.end();
        }
        const response = this.incomingMessage || (await new Promise(resolve => this.once('response', resolve)));
        const buffer = await readableToBuffer(this);
        if (this.opts.rejectError && !statusOk(response.statusCode)) {
          this.responseError = getResponseError(response, buffer);
          throw this.responseError;
        }
        response.body = this.opts.raw ? buffer : parseResponseBuffer(response.headers['content-type'], buffer);
        return response;
      })(),
      new Promise((_, reject) => this.once('error', reject)),
    ]);
    return this.responsePromise.then(fn, handle);
  }

  catch(handle) {
    if (this.responsePromise) {
      return this.responsePromise.catch(handle);
    }
    return this.then(x => x, handle);
  }
}

module.exports = { Connection };
