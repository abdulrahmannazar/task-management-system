const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib');
const generateLoeTemplate = require('../templates/loeTemplate');
const generateInvoiceTemplate = require('../templates/invoiceTemplate');

// Load mosaic emblem as base64 for header on pages 2+
function getMosaicIconDataUri() {
  const candidatePaths = [
    path.join(__dirname, '..', 'templates', 'frontier_mosaic_icon.png'),
    path.join(__dirname, '..', '..', 'frontend', 'public', 'frontier_mosaic_icon.png'),
    'C:/Users/User/.gemini/antigravity/brain/f79569a1-caf8-44b3-9bc0-bfb06754954c/.user_uploaded/media_1794400944749_2427fd10.png'
  ];

  for (const filePath of candidatePaths) {
    try {
      if (filePath && fs.existsSync(filePath)) {
        const base64 = fs.readFileSync(filePath).toString('base64');
        return `data:image/png;base64,${base64}`;
      }
    } catch (e) {}
  }
  return null;
}

const MOSAIC_DATA_URI = getMosaicIconDataUri();

const HEADER_TEMPLATE = `
  <div style="width: 100%; text-align: center; margin: 0 auto; padding-top: 3mm; -webkit-print-color-adjust: exact;">
    ${
      MOSAIC_DATA_URI
        ? `<img src="${MOSAIC_DATA_URI}" style="height: 34px; width: auto; display: inline-block;" alt="Frontier Logo" />`
        : ''
    }
  </div>
`;

const FOOTER_TEMPLATE = `
  <div style="font-family: Arial, Helvetica, sans-serif; font-size: 8pt; color: #475569; width: 100%; margin: 0 18mm; padding-top: 4px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center; -webkit-print-color-adjust: exact;">
    <div>15/1D, Joseph's Lane, Colombo 04</div>
    <div>+94 115 925 233 / +94 112 500 117</div>
    <div>www.frontierlk.com | info@frontierlk.com</div>
  </div>
`;

function getLaunchOptions() {
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run'
  ];

  try {
    const bundledPath = puppeteer.executablePath();
    if (bundledPath && typeof bundledPath === 'string' && fs.existsSync(bundledPath)) {
      return { headless: 'new', executablePath: bundledPath, args };
    }
  } catch (err) {}

  const localAppData = process.env.LOCALAPPDATA || '';
  const candidateList = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    localAppData ? path.join(localAppData, 'Google\\Chrome\\Application\\chrome.exe') : null,
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium'
  ];

  for (const browserPath of candidateList) {
    if (browserPath && typeof browserPath === 'string') {
      try {
        if (fs.existsSync(browserPath)) {
          return { headless: 'new', executablePath: browserPath, args };
        }
      } catch (e) {}
    }
  }

  return { headless: 'new', args };
}

/**
 * Renders a PDF with Puppeteer, omitting the top-center logo header on page 1,
 * and displaying the top-center logo header on pages 2+.
 */
async function printPdfWithHeaderOnPages2Plus(page) {
  const marginOptions = {
    top: '22mm',
    bottom: '20mm',
    left: '18mm',
    right: '18mm'
  };

  // 1. Initial pass without header to find total page count
  const fullBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: FOOTER_TEMPLATE,
    margin: marginOptions
  });

  const fullPdfDoc = await PDFDocument.load(fullBuffer);
  const totalPages = fullPdfDoc.getPageCount();

  if (totalPages <= 1) {
    return fullBuffer;
  }

  // 2. Render Page 1 with NO top-center logo header
  const page1Buffer = await page.pdf({
    format: 'A4',
    pageRanges: '1',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: FOOTER_TEMPLATE,
    margin: marginOptions
  });

  // 3. Render Pages 2+ with the top-center logo header (increased size)
  const restBuffer = await page.pdf({
    format: 'A4',
    pageRanges: `2-${totalPages}`,
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: HEADER_TEMPLATE,
    footerTemplate: FOOTER_TEMPLATE,
    margin: marginOptions
  });

  // 4. Merge Page 1 and Pages 2+ seamlessly
  const mergedDoc = await PDFDocument.create();
  const doc1 = await PDFDocument.load(page1Buffer);
  const doc2 = await PDFDocument.load(restBuffer);

  const copied1 = await mergedDoc.copyPages(doc1, doc1.getPageIndices());
  copied1.forEach((p) => mergedDoc.addPage(p));

  const copied2 = await mergedDoc.copyPages(doc2, doc2.getPageIndices());
  copied2.forEach((p) => mergedDoc.addPage(p));

  const finalPdfBytes = await mergedDoc.save();
  return Buffer.from(finalPdfBytes);
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

    return await printPdfWithHeaderOnPages2Plus(page);
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

    return await printPdfWithHeaderOnPages2Plus(page);
  } finally {
    await browser.close();
  }
};
