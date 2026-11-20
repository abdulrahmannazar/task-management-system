const prisma = require('../config/db');

// In-memory cache: loeId -> { signature_image, signature_name } | null
const signatureCache = new Map();
let tableReadyPromise = null;

/**
 * Ensures the additive `loe_signatures` table exists in PostgreSQL
 * without modifying any existing Prisma schema models.
 */
function ensureSignatureTable() {
  if (!tableReadyPromise) {
    tableReadyPromise = (async () => {
      try {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS loe_signatures (
            loe_id INT PRIMARY KEY,
            signature_image TEXT,
            signature_name VARCHAR(255),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
      } catch (err) {
        console.error('[LoeSignatureService] Failed to initialize loe_signatures table:', err.message);
        tableReadyPromise = null;
      }
    })();
  }
  return tableReadyPromise;
}

/**
 * Saves or removes an LOE's attached signature image.
 */
async function saveLoeSignature(loeId, signatureImage, signatureName = null) {
  const id = Number(loeId);
  if (isNaN(id)) return;

  await ensureSignatureTable();

  const cleanImage = typeof signatureImage === 'string' && signatureImage.trim() ? signatureImage.trim() : null;
  const cleanName = typeof signatureName === 'string' && signatureName.trim() ? signatureName.trim().slice(0, 255) : null;

  if (!cleanImage) {
    signatureCache.set(id, null);
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM loe_signatures WHERE loe_id = $1`, id);
    } catch (err) {
      console.error('[LoeSignatureService] Failed to remove signature:', err.message);
    }
    return;
  }

  const record = { signature_image: cleanImage, signature_name: cleanName };
  signatureCache.set(id, record);

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO loe_signatures (loe_id, signature_image, signature_name, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (loe_id) DO UPDATE
       SET signature_image = $2, signature_name = $3, updated_at = NOW()`,
      id,
      cleanImage,
      cleanName
    );
  } catch (err) {
    console.error('[LoeSignatureService] Failed to save signature:', err.message);
  }
}

/**
 * Fetches a single LOE's attached signature image.
 */
async function getLoeSignature(loeId) {
  const id = Number(loeId);
  if (isNaN(id)) return null;

  if (signatureCache.has(id)) {
    return signatureCache.get(id);
  }

  await ensureSignatureTable();
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT loe_id, signature_image, signature_name FROM loe_signatures WHERE loe_id = $1 LIMIT 1`,
      id
    );
    if (Array.isArray(rows) && rows.length > 0 && rows[0].signature_image) {
      const record = {
        signature_image: rows[0].signature_image,
        signature_name: rows[0].signature_name || null
      };
      signatureCache.set(id, record);
      return record;
    }
    signatureCache.set(id, null);
  } catch (err) {
    console.error('[LoeSignatureService] Failed to load signature:', err.message);
  }
  return null;
}

/**
 * Attaches signature_image and signature_name to a single LOE object.
 */
async function attachSignatureToLoe(loe) {
  if (!loe || !loe.loe_id) return loe;
  const sig = await getLoeSignature(loe.loe_id);
  return {
    ...loe,
    signature_image: sig?.signature_image || null,
    signature_name: sig?.signature_name || null
  };
}

/**
 * Batch-attaches signature_image and signature_name to an array of LOE objects in a single DB query.
 */
async function attachSignaturesToLoes(loes) {
  if (!Array.isArray(loes) || loes.length === 0) return loes;

  const missingIds = [];
  for (const loe of loes) {
    const id = Number(loe?.loe_id);
    if (!isNaN(id) && !signatureCache.has(id)) {
      missingIds.push(id);
    }
  }

  if (missingIds.length > 0) {
    await ensureSignatureTable();
    try {
      const placeholders = missingIds.map((_, idx) => `$${idx + 1}`).join(', ');
      const rows = await prisma.$queryRawUnsafe(
        `SELECT loe_id, signature_image, signature_name FROM loe_signatures WHERE loe_id IN (${placeholders})`,
        ...missingIds
      );
      const foundMap = new Map();
      if (Array.isArray(rows)) {
        rows.forEach((r) => {
          if (r.signature_image) {
            foundMap.set(Number(r.loe_id), {
              signature_image: r.signature_image,
              signature_name: r.signature_name || null
            });
          }
        });
      }
      missingIds.forEach((id) => {
        signatureCache.set(id, foundMap.get(id) || null);
      });
    } catch (err) {
      console.error('[LoeSignatureService] Failed to batch load signatures:', err.message);
    }
  }

  return loes.map((loe) => {
    const sig = signatureCache.get(Number(loe?.loe_id));
    return {
      ...loe,
      signature_image: sig?.signature_image || null,
      signature_name: sig?.signature_name || null
    };
  });
}

async function deleteLoeSignature(loeId) {
  const id = Number(loeId);
  if (isNaN(id)) return;
  signatureCache.delete(id);
  await ensureSignatureTable();
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM loe_signatures WHERE loe_id = $1`, id);
  } catch (_) {}
}

ensureSignatureTable();

module.exports = {
  saveLoeSignature,
  getLoeSignature,
  attachSignatureToLoe,
  attachSignaturesToLoes,
  deleteLoeSignature
};
