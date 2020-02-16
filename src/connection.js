'use strict';

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

class Connection extends Duplex {
  constructor(dst, opts) {
    super();
    this.dst = dst;
    this.opts = opts;
    this.source = null;
    this.incomingMessage = null;
    this.outgoingMessage = null;
    this.outgoingHeaders = {};

    const pipe = this.pipe.bind(this);
    this.isPipedTo = false;

    this.pipe = (...args) => {
      if (!this.isPipedTo) {
        this.end();
      }
      return pipe(...args);
    };

    this.once('response', response => {
      this.incomingMessage = response;
      this.source = opts.decompress !== false ? applyDecompression(response) : response;
      this.source.on('end', () => this.push(null));
      this.emit('_source_');
    })
      .once('request', request => {
        this.outgoingMessage = request;
        for (const [name, value] of Object.entries(this.outgoingHeaders)) {
          this.outgoingMessage.setHeader(name, value);
        }
      })
      .once('finish', () => {
        this.dst.end();
      })
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
    const promise = Promise.race([
      (async () => {
        if (!this.isPipedTo) {
          this.end();
        }
        const response = this.incomingMessage || (await new Promise(resolve => this.once('response', resolve)));
        if (this.opts.json === true && !(response.headers['content-type'] || '').includes('application/json')) {
          throw new Error(format('Content-Type is %s, expected application/json', response.headers['content-type']));
        }
        const buffer = await readableToBuffer(this);
        response.body = this.opts.json === true ? JSON.parse(buffer.toString()) : buffer;
        return fn(response);
      })(),
      new Promise((_, reject) => this.on('error', reject)),
    ]);
    if (handle) {
      return promise.catch(handle);
    }
    return promise;
  }

  catch(handle) {
    return this.then(x => x, handle);
  }
}

module.exports = { Connection };
