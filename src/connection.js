'use strict';

const { Duplex } = require('stream');

const zlib = require('zlib');

const decompressions = {
  gzip: zlib.createGunzip,
  deflate: zlib.createInflate,
  br: zlib.createBrotliDecompress,
};

const applyDecompression = response => {
  if (!response.headers['content-encoding']) {
    return response;
  }
  return response.headers['content-encoding']
    .split(/\s*,\s*/)
    .filter(enc => enc && enc !== 'identity')
    .reduceRight((acc, enc) => acc.pipe(decompressions[enc]()), response);
};

function drain(readable, push) {
  readable.once('readable', () => {
    for (;;) {
      const chunk = readable.read();
      if (chunk === null) {
        break;
      }
      push(chunk);
    }
  });
}

function createConnection(req, options) {
  let source = null;

  const conn = new Duplex({
    read: function() {
      if (!source) {
        return this.once('source', () => drain(source, this.push.bind(this)));
      }
      return drain(source, this.push.bind(this));
    },
    write: req.write.bind(req),
  })
    .on('response', function(resp) {
      source = options.decompress !== false ? applyDecompression(resp) : resp;
      source.on('end', () => this.push(null));
      this.emit('source');
    })
    .on('finish', () => req.end())
    .on('pipe', function() {
      this.isPipedTo = true;
    });

  const pipe = conn.pipe.bind(conn);
  conn.pipe = (...args) => {
    if (!conn.isPipedTo) {
      conn.end();
    }
    return pipe(...args);
  };

  return conn;
}

module.exports = { createConnection };
