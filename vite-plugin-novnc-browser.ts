import type { Plugin } from 'vite';

/**
 * noVNC's browser.js uses top-level await, which breaks Vite's esbuild
 * dependency pre-bundling (CJS require into async module). Replace with
 * a deferred assignment so dev and optimizeDeps work.
 */
export function novncBrowserNoTopLevelAwait(): Plugin {
  return {
    name: 'novnc-browser-no-tla',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('novnc/lib/util/browser.js')) {
        return null;
      }
      const needle =
        'exports.supportsWebCodecsH264Decode = supportsWebCodecsH264Decode = await _checkWebCodecsH264DecodeSupport();';
      if (!code.includes(needle)) {
        return null;
      }
      const replacement = `exports.supportsWebCodecsH264Decode = supportsWebCodecsH264Decode = false;
(function () {
  var p = _checkWebCodecsH264DecodeSupport();
  if (p && typeof p.then === 'function') {
    p.then(function (v) {
      exports.supportsWebCodecsH264Decode = supportsWebCodecsH264Decode = v;
    });
  }
})();`;
      return { code: code.replace(needle, replacement), map: null };
    },
  };
}
