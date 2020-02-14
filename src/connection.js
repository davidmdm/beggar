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

class Connection extends Duplex {
  constructor(req, resPromise) {
    super();
    this.request = req;
    this.responsePromise = resPromise;
    this.response = null;
    this.push = this.push.bind(this);
  }

  _read() {
    if (this.response) {
      return drain(this.response, this.push);
    }
    return this.responsePromise
      .then(resp => {
        this.response = resp;
        this.responsePromise = null;
        drain(resp, this.push);
      })
      .catch(err => this.emit('error', err));
  }

  _write(chunk, enc, cb) {
    this.request.write(chunk, enc, cb);
  }
}

module.exports = { Connection };
