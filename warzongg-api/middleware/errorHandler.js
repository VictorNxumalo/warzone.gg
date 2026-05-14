// Global error handler — catches any error passed via next(err)
// Must be registered LAST in server.js (after all routes)
function isTlsCertificateError(err) {
  const code = err?.cause?.code || err?.code;
  return [
    'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
    'SELF_SIGNED_CERT_IN_CHAIN',
    'DEPTH_ZERO_SELF_SIGNED_CERT',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
  ].includes(code);
}

function errorHandler(err, req, res, next) {
  if (isTlsCertificateError(err)) {
    console.error(`[TLS] ${req.method} ${req.path}:`, err?.cause?.message || err.message);
    return res.status(503).json({
      error: 'Secure connection to Supabase failed on this machine. In development, enable the OS CA store with NODE_OPTIONS=--use-system-ca, or provide your corporate root cert via NODE_EXTRA_CA_CERTS.'
    });
  }

  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  const status = err.status || 500;
  const message = err.message || 'Something went wrong on the server.';

  res.status(status).json({ error: message });
}

module.exports = errorHandler;
