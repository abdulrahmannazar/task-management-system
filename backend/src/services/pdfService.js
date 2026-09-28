const puppeteer = require('puppeteer');
const { renderLoeHtml } = require('../templates/loeTemplate');

/**
 * Compiles LOE data into HTML and converts it into a PDF buffer via Puppeteer
 * @param {Object} payload - { loe, company }
 * @returns {Promise<Buffer>}
 */
async function generateLoePdf({ loe, company }) {
  const htmlContent = renderLoeHtml({ loe, company });

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process', // Critical: keeps memory footprint low on Render free tier
      '--disable-gpu'
    ]
  });

  try {
    const page = await browser.newPage();

    // Disable unnecessary timeouts and render purely from DOM readiness
    page.setDefaultNavigationTimeout(60000);

    await page.setContent(htmlContent, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '12mm',
        right: '12mm',
        bottom: '12mm',
        left: '12mm'
      }
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

module.exports = { generateLoePdf };