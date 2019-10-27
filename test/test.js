'use strict';

const { request } = require('./index');
const fs = require('fs');

request({
  method: 'get',
  uri: 'https://google.com',
})
  .then(response => console.log('%s %j\n\n%s', response.statusCode, response.headers, response.body))
  .catch(console.error);
