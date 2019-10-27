'use strict';

const readableToBuffer = readable => {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.from([]);
    readable
      .on('data', data => (buffer = Buffer.concat([buffer, data])))
      .on('end', () => resolve(buffer))
      .on('error', reject);
  });
};

module.exports = { readableToBuffer };
