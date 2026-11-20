const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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

let cachedLaunchOptions = null;

function getLaunchOptions() {
  if (cachedLaunchOptions) return cachedLaunchOptions;

  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-zygote',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-sync',
    '--disable-translate',
    '--hide-scrollbars',
    '--metrics-recording-only',
    '--mute-audio',
    '--safebrowsing-disable-auto-update',
    '--disable-component-update',
    '--disable-domain-reliability',
    '--disable-client-side-phishing-detection'
  ];

  try {
    const bundledPath = puppeteer.executablePath();
    if (bundledPath && typeof bundledPath === 'string' && fs.existsSync(bundledPath)) {
      cachedLaunchOptions = { headless: 'new', executablePath: bundledPath, args };
      return cachedLaunchOptions;
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
          cachedLaunchOptions = { headless: 'new', executablePath: browserPath, args };
          return cachedLaunchOptions;
        }
      } catch (e) {}
    }
  }

  cachedLaunchOptions = { headless: 'new', args };
  return cachedLaunchOptions;
}

// =========================================================================
// Persistent Singleton Browser & Pre-Warmed Page Pool (0ms launch delay)
// =========================================================================
let browserInstance = null;
let browserLaunchPromise = null;
const warmPages = [];
const MAX_WARM_PAGES = 2;
let isReplenishing = false;

async function getBrowser() {
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }
  if (browserLaunchPromise) {
    return browserLaunchPromise;
  }

  browserLaunchPromise = puppeteer
    .launch(getLaunchOptions())
    .then((browser) => {
      browserInstance = browser;
      browserLaunchPromise = null;
      browser.on('disconnected', () => {
        browserInstance = null;
        warmPages.length = 0;
      });
      return browser;
    })
    .catch((err) => {
      browserLaunchPromise = null;
      throw err;
    });

  return browserLaunchPromise;
}

async function createConfiguredPage(browser) {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000);
  return page;
}

function replenishWarmPages() {
  if (isReplenishing) return;
  isReplenishing = true;
  setImmediate(async () => {
    try {
      const browser = await getBrowser();
      while (warmPages.length < MAX_WARM_PAGES && browser.connected) {
        const page = await createConfiguredPage(browser);
        warmPages.push(page);
      }
    } catch (_) {
    } finally {
      isReplenishing = false;
    }
  });
}

async function acquirePage() {
  const browser = await getBrowser();
  while (warmPages.length > 0) {
    const page = warmPages.pop();
    if (page && !page.isClosed()) {
      replenishWarmPages();
      return page;
    }
  }
  replenishWarmPages();
  return createConfiguredPage(browser);
}

function releasePage(page) {
  if (!page) return;
  setImmediate(async () => {
    try {
      if (!page.isClosed()) {
        await page.close();
      }
    } catch (_) {}
    replenishWarmPages();
  });
}

// =========================================================================
// Content-Addressed In-Memory PDF Buffer Cache & In-Flight Deduplication
// =========================================================================
const pdfRenderCache = new Map();
const inFlightRenders = new Map();
const MAX_PDF_CACHE_ENTRIES = 60;

function getCachedPdf(hash) {
  const buf = pdfRenderCache.get(hash);
  if (!buf) return null;
  pdfRenderCache.delete(hash);
  pdfRenderCache.set(hash, buf);
  return buf;
}

function setCachedPdf(hash, buf) {
  if (pdfRenderCache.has(hash)) {
    pdfRenderCache.delete(hash);
  } else if (pdfRenderCache.size >= MAX_PDF_CACHE_ENTRIES) {
    const oldestKey = pdfRenderCache.keys().next().value;
    if (oldestKey) pdfRenderCache.delete(oldestKey);
  }
  pdfRenderCache.set(hash, buf);
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

  // 1. First pass without header (renders Page 1 without header AND gives exact page count)
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
    return Buffer.from(fullBuffer);
  }

  // 2. Render Pages 2+ with the top-center logo header (reusing Page 1 directly from fullPdfDoc)
  const restBuffer = await page.pdf({
    format: 'A4',
    pageRanges: `2-${totalPages}`,
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: HEADER_TEMPLATE,
    footerTemplate: FOOTER_TEMPLATE,
    margin: marginOptions
  });

  // 3. Merge Page 1 (from fullPdfDoc) and Pages 2+ (from restBuffer) seamlessly
  const [mergedDoc, doc2] = await Promise.all([
    PDFDocument.create(),
    PDFDocument.load(restBuffer)
  ]);

  const [[page1], copied2] = await Promise.all([
    mergedDoc.copyPages(fullPdfDoc, [0]),
    mergedDoc.copyPages(doc2, doc2.getPageIndices())
  ]);

  mergedDoc.addPage(page1);
  copied2.forEach((p) => mergedDoc.addPage(p));

  const finalPdfBytes = await mergedDoc.save();
  return Buffer.from(finalPdfBytes);
}

async function renderHtmlToPdfBuffer(htmlContent) {
  const contentHash = crypto
    .createHash('sha256')
    .update(htmlContent)
    .digest('hex');

  const cached = getCachedPdf(contentHash);
  if (cached) {
    return cached;
  }

  if (inFlightRenders.has(contentHash)) {
    return inFlightRenders.get(contentHash);
  }

  const renderPromise = (async () => {
    const page = await acquirePage();
    try {
      await page.setContent(htmlContent, {
        waitUntil: 'domcontentloaded'
      });
      const pdfBuffer = await printPdfWithHeaderOnPages2Plus(page);
      setCachedPdf(contentHash, pdfBuffer);
      return pdfBuffer;
    } finally {
      releasePage(page);
    }
  })();

  inFlightRenders.set(contentHash, renderPromise);
  try {
    return await renderPromise;
  } finally {
    inFlightRenders.delete(contentHash);
  }
}

/**
 * Compiles the LOE HTML template and generates a PDF buffer using Puppeteer
 */
exports.generateLoePdf = async ({ loe, company }) => {
  const htmlContent = generateLoeTemplate({ loe, company });
  return renderHtmlToPdfBuffer(htmlContent);
};

/**
 * Compiles the Invoice HTML template and generates a PDF buffer using Puppeteer
 */
exports.generateInvoicePdf = async ({ invoice, loe, company, customLogo, logoAlignment }) => {
  const htmlContent = generateInvoiceTemplate({ invoice, loe, company, customLogo, logoAlignment });
  return renderHtmlToPdfBuffer(htmlContent);
};

/**
 * Non-blocking background prewarm helpers
 */
exports.prewarmLoePdf = ({ loe, company }) => {
  setImmediate(() => {
    exports.generateLoePdf({ loe, company }).catch(() => {});
  });
};

exports.prewarmInvoicePdf = ({ invoice, loe, company, customLogo, logoAlignment }) => {
  setImmediate(() => {
    exports.generateInvoicePdf({ invoice, loe, company, customLogo, logoAlignment }).catch(() => {});
  });
};

// Pre-warm the Chromium instance and page pool on startup
replenishWarmPages();
