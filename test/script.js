'use strict';

const { request } = require('../src');
const { createServer } = require('./server');

new Promise(resolve => createServer().listen(3000, resolve))
  .then(() => {
    return request('http://localhost:3000/details', {
      auth: 'superpotatot',
      json: true,
    });
  })
  .then(response => {
    console.log(response.body);
    console.log(Buffer.from(response.body.request.headers.authorization.slice(6), 'base64').toString());
  })
  .then(() => process.exit(0))
  .catch(console.error);
