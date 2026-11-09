require('dotenv').config();
const dns = require('dns');

// High-performance IPv4 DNS Cache to eliminate repeated DNS resolution roundtrips
const dnsCache = new Map();
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

  const cacheKey = `${hostname}_4`;
  const cached = dnsCache.get(cacheKey);
  if (cached && (Date.now() - cached.time < 300000)) {
    return process.nextTick(() => callback(null, cached.address, 4));
  }

  return originalLookup(hostname, { ...options, family: 4 }, (err, address, family) => {
    if (!err && address) {
      dnsCache.set(cacheKey, { address, time: Date.now() });
    }
    callback(err, address, family);
  });
};

const app = require('./app'); 

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
