'use strict';

const { request } = require('../src');
const { createServer } = require('./server');

const p = new Promise(resolve => createServer().listen(3000, resolve))
  .then(() => {
    return request('http://localhost:3000/connection-drop', {
      method: 'post',
      auth: 'superpotatot',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      json: true,
      body: 'hello[name][0][potato]=world',
    }).catch(console.error);
  })
  .then(response => {
    console.log(JSON.stringify(response.body));
  })
  .catch(err => console.error(err.message));
