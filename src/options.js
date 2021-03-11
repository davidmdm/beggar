const getProxyUri = proxy => {
  if (!proxy) {
    return undefined;
  }
  const uri = proxy.uri || proxy;
  return uri instanceof URL ? uri : new URL(uri);
};

const sanitizeTlsOptions = tls => {
  if (!tls) {
    return undefined;
  }
  return {
    cert: tls.cert,
    key: tls.key,
    ca: tls.ca,
    ciphers: tls.ciphers,
    clientCertEngine: tls.clientCertEngine,
    privateKeyEngine: tls.privateKeyEngine,
    privateKeyIdentifier: tls.privateKeyIdentifier,
    maxVersion: tls.maxVersion,
    minVersion: tls.minVersion,
    passphrase: tls.passphrase,
    secureOptions: tls.secureOptions,
    secureProtocol: tls.secureProtocol,
    sessionIdContext: tls.sessionIdContext,
    pfx: tls.pfx,
    crl: tls.crl,
    dhparam: tls.dhparam,
    ecdhCurve: tls.ecdhCurve,
    honorCipherOrder: tls.honorCipherOrder,
    rejectUnauthorized: tls.rejectUnauthorized,
    servername: tls.servername,
  };
};

const getMaxRedirects = options => {
  if (typeof options.maxRedirects === 'number') {
    return options.maxRedirects;
  }
  if (options.followAllRedirects === true) {
    return Infinity;
  }
  return 0;
};

const sanitizeOpts = options => {
  return {
    method: options.method,
    headers: options.headers,
    uri: new URL(options.uri),
    proxy: getProxyUri(options.proxy),
    proxyTls: options.proxy && sanitizeTlsOptions(options.proxy.tls),
    maxRedirects: getMaxRedirects(options),
    auth: options.auth,
    body: options.body,
    form: options.form,
    formData: options.formData,
    qs: options.qs,
    query: options.query,
    decompress: options.decompress !== false,
    rejectError: options.rejectError === true,
    raw: options.raw === true,
    tls: sanitizeTlsOptions(options.tls),
    simple: options.simple === true,
    path: options.path,
  };
};

module.exports = { sanitizeOpts };
