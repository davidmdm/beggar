'use strict';

const { request } = require('../src/index');
const fs = require('fs');

// fs.createReadStream('./test/test.js')
//   .pipe(
request({
  method: 'post',
  uri: 'http://localhost:3000/details',
  // body: 'potato',
})
  // )
  .then(response => console.log('%s %j\n\n%s', response.statusCode, response.headers, response.body))
  .catch(console.error);
