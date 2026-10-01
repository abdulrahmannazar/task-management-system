const puppeteer = require('puppeteer');
const generateLoeTemplate = require('../templates/loeTemplate');
const generateInvoiceTemplate = require('../templates/invoiceTemplate');

/**
 * Compiles the LOE HTML template and generates a PDF buffer using Puppeteer
 */
exports.generateLoePdf = async ({ loe, company }) => {
  const htmlContent = generateLoeTemplate({ loe, company });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run'
    ]
  });

  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000);

    // Using 'domcontentloaded' generates the PDF immediately without waiting for network idle
    await page.setContent(htmlContent, {
      waitUntil: 'domcontentloaded'
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '15mm',
        bottom: '15mm',
        left: '15mm',
        right: '15mm'
      }
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
};

/**
 * Compiles the Invoice HTML template and generates a PDF buffer using Puppeteer
 */
exports.generateInvoicePdf = async ({ invoice, loe, company }) => {
  const htmlContent = generateInvoiceTemplate({ invoice, loe, company });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run'
    ]
  });

  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000);

    await page.setContent(htmlContent, {
      waitUntil: 'domcontentloaded'
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '15mm',
        bottom: '15mm',
        left: '15mm',
        right: '15mm'
      }
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
};