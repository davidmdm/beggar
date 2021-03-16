'use strict';

const { request } = require('./src/request');
const { CancelError, HttpError } = require('./src/connection');

module.exports = {
  beggar: request,
  CancelError,
  HttpError,
};
