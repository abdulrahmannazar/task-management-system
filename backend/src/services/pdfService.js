const puppeteer = require('puppeteer');
const generateLoeTemplate = require('../templates/loeTemplate');

/**
 * Compiles the LOE HTML template and generates a PDF buffer using Puppeteer
 */
exports.generateLoePdf = async ({ loe, company }) => {
  const htmlContent = generateLoeTemplate({ loe, company });

  // Launch headless browser with production container arguments
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  try {
    const page = await browser.newPage();
    
    // Set HTML content and wait until DOM and network requests settle
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0'
    });

    // Render high-resolution print PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
};