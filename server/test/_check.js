const p = require('pdf-parse');
console.log('pdf-parse type:', typeof p);
console.log('pdf-parse.default type:', typeof p.default);
console.log('keys:', Object.keys(p).slice(0, 5));
