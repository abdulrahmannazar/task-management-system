require('dotenv').config();
const dns = require('dns');


const originalLookup = dns.lookup;
dns.lookup = function (hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  } else if (typeof options === 'number') {
    options = { family: options };
  } else if (!options) {
    options = {};
  }
  // Enforce IPv4 lookups only
  return originalLookup(hostname, { ...options, family: 4 }, callback);
};

const app = require('./app'); 

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});