//@ts-nocheck

'use strict';

const { request } = require('../src');
const { createServer } = require('./server');

async function main() {
  await new Promise(resolve => createServer().listen(3000, resolve));

  return request('http://localhost:3000/home', {
    method: 'post',
    auth: 'superpotatot',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'hello[name][0][potato]=world',
  });
}

main()
  .then(response => {
    console.log(response.body);
  })
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err.message);
    process.exit(1);
  });
