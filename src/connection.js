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

function createConnection(req, responsePromise, options) {
  let source = null;
  return new Duplex({
    read: function() {
      if (source) {
        return drain(source, this.push.bind(this));
      }
      responsePromise
        .then(resp => {
          source = options.decompress !== false ? applyDecompression(resp) : resp;
          source.on('end', () => this.push(null));
          drain(source, this.push.bind(this));
        })
        .catch(() => {});
    },
    write: req.write.bind(req),
  });
}

module.exports = { createConnection };
