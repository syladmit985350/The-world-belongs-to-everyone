(async () => {
  const film = window.__TIANXIA__;
  if (!film) throw new Error('The film engine is not exposed for inspection');
  const canvas = document.querySelector('.art-canvas');
  if (!canvas) throw new Error('WebGL canvas is missing');
  const gl = canvas.getContext('webgl2');
  if (!gl) throw new Error('WebGL2 is unavailable');
  const report = window.__ARTWORK_QA__ || { errors: [], warnings: [], rejections: [] };
  report.nonFiniteMatrices = 0;
  const matrixCall = gl.uniformMatrix4fv.bind(gl);
  gl.uniformMatrix4fv = (...args) => {
    if (args[2] && Array.from(args[2]).some(value => !Number.isFinite(value))) report.nonFiniteMatrices++;
    return matrixCall(...args);
  };
  // seek() renders synchronously. Give async image uploads a brief settling window
  // without requiring a long chain of RAF callbacks in a background test browser.
  const frames = count => new Promise(resolve => setTimeout(resolve, Math.min(count * 10, 80)));
  film.pause();
  const scenes = [];
  const inspect = async record => {
    for (const chapter of film.chapters) {
      // Warm early, late and transition-only objects before checking allocation reuse.
      // Three.js uploads geometry only when it becomes visible to a rendered frame.
      for (const fraction of [0.04, 0.58, 0.98]) {
        film.seek(chapter.start + chapter.duration * fraction);
        await frames(5);
      }
      if (record) {
        const state = film.state();
        scenes.push({ id: chapter.id, expectedIndex: chapter.index, actualIndex: state.chapterIndex,
          glError: gl.getError(), heading: document.querySelector('#chapter-heading h2').textContent,
          failures: [...film.stats().failures] });
      }
    }
    await frames(12);
  };
  await inspect(true);
  await inspect(false);
  const memoryBefore = film.stats();
  await inspect(false);
  const memoryAfter = film.stats();
  film.seek(130);
  await frames(8);
  const finite = report.nonFiniteMatrices === 0;
  const stable = memoryAfter.textures === memoryBefore.textures && memoryAfter.geometries === memoryBefore.geometries;
  const result = { passed: finite && stable && scenes.every(scene => scene.actualIndex === scene.expectedIndex && scene.glError === 0 && scene.failures.length === 0) && report.errors.length === 0 && report.rejections.length === 0,
    viewport: [innerWidth, innerHeight], visibility: document.visibilityState, pixelRatio: devicePixelRatio, finiteMatrices: finite,
    stableGeometryAndTextureCounts: stable, memoryBefore, memoryAfter, scenes, report };
  window.__ARTWORK_RUNTIME_RESULT__ = result;
  return result;
})();
