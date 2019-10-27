'use strict';

// This file is temporary and just for development purposes. this function monkey patches
// an event emitter and logs the events it emits

const spy = (name, emitter) => {
  const emit = emitter.emit.bind(emitter);
  emitter.emit = function(...args) {
    console.log('%s:%s', name, args[0].toUpperCase());
    return emit(...args);
  };
  return emitter;
};

module.exports = { spy };
