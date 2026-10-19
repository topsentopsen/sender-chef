// Lädt data.js und sim.js in Node (ohne Browser)
'use strict';
const path = require('path');
global.window = global.window || {};
const mem = {};
global.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
require(path.join(__dirname, '..', 'js', 'data.js'));
require(path.join(__dirname, '..', 'js', 'sim.js'));
module.exports = window.SC;
