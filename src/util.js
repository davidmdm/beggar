'use strict';

const readableToBuffer = async readable => {
  return new Promise((resolve, reject) => {
    const parts = [];
    readable
      .on('data', data => parts.push(data))
      .on('end', () => resolve(Buffer.concat(parts)))
      .on('error', reject);
  });
};

module.exports = { readableToBuffer };
