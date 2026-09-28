const { join } = require('path');

/**
 * Tells Puppeteer to store the browser cache inside the project folder
 * so Render keeps Chrome available at runtime.
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};