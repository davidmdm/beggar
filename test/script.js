//@ts-nocheck

'use strict';

const { request } = require('../src');
const { createServer } = require('./server');

async function main() {
  await new Promise(resolve => createServer().listen(3000, resolve));

  const err = await new Promise(resolve =>
    request({
      uri: 'http://localhost:3000/redirectToHangUp',
      followRedirects: true,
    })
      .on('error', err => {
        resolve(err);
      })
      .end()
  );

  console.log(err.message);
}

main();
