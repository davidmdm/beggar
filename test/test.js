'use strict';

const { request } = require('../src');
const { createServer } = require('./server');

new Promise(resolve => createServer().listen(3000, resolve))
  .then(() => {
    const req = request('http://localhost:3000/homepage');
    req.on('data', console.log);
  })
  .catch(console.error);
