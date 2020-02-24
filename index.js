'use strict';

const { request } = require('./src/request');
const { CancelError } = require('./src/connection');

module.exports = {
  beggar: request,
  CancelError,
};
