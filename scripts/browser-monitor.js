(() => {
  const report = { errors: [], warnings: [], rejections: [], loadedAt: performance.now() };
  window.__ARTWORK_QA__ = report;
  const printable = values => values.map(value => {
    if (value instanceof Error) return value.stack || value.message;
    try { return typeof value === 'string' ? value : JSON.stringify(value); }
    catch { return String(value); }
  }).join(' ').slice(0, 1600);
  for (const name of ['error', 'warn']) {
    const original = console[name].bind(console);
    console[name] = (...values) => {
      const target = name === 'error' ? report.errors : report.warnings;
      if (target.length < 40) target.push(printable(values));
      original(...values);
    };
  }
  window.addEventListener('error', event => report.errors.push(event.message));
  window.addEventListener('unhandledrejection', event => report.rejections.push(printable([event.reason])));
})();
