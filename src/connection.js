'use strict';

const { Duplex } = require('stream');

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

function createConnection(req, responsePromise) {
  let response = null;
  return new Duplex({
    read: function() {
      if (response) {
        return drain(response, this.push.bind(this));
      }
      responsePromise
        .then(resp => {
          response = resp;
          drain(response, this.push.bind(this));
        })
        .catch(() => {});
    },
    write: req.write.bind(req),
  });
}

module.exports = { createConnection };
