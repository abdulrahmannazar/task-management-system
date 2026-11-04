const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const generateLoeTemplate = require('../templates/loeTemplate');
const generateInvoiceTemplate = require('../templates/invoiceTemplate');

/**
 * Resolves the Chrome/Edge executable path.
 * Uses Puppeteer's cached binary on Render/Linux, and falls back to
 * locally installed Chrome or Edge on Windows if the cache folder is empty.
 */
function getLaunchOptions() {
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run'
  ];

  // 1. Check if Puppeteer's bundled browser exists in .cache/puppeteer
  try {
    const bundledPath = puppeteer.executablePath();
    if (bundledPath && fs.existsSync(bundledPath)) {
      return { headless: 'new', executablePath: bundledPath, args };
    }
  } catch (err) {
    // Fallback to system browser detection below
  }

  // 2. Fallback: Check standard Windows / Linux paths for Chrome or Edge
  const localAppData = process.env.LOCALAPPDATA || '';
  const systemPaths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(localAppData, 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium'
  ].filter(Boolean);

  for (const browserPath of systemPaths) {
    if (fs.existsSync(browserPath)) {
      return { headless: 'new', executablePath: browserPath, args };
    }
  }

  return { headless: 'new', args };
}

/**
 * Compiles the LOE HTML template and generates a PDF buffer using Puppeteer
 */
exports.generateLoePdf = async ({ loe, company }) => {
  const htmlContent = generateLoeTemplate({ loe, company });
  const browser = await puppeteer.launch(getLaunchOptions());

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

/**
 * Compiles the Invoice HTML template and generates a PDF buffer using Puppeteer
 */
exports.generateInvoicePdf = async ({ invoice, loe, company }) => {
  const htmlContent = generateInvoiceTemplate({ invoice, loe, company });
  const browser = await puppeteer.launch(getLaunchOptions());

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