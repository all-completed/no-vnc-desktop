import fs from 'node:fs';
import path from 'node:path';

const target = path.resolve('node_modules/@novnc/novnc/lib/util/browser.js');

if (!fs.existsSync(target)) {
  process.exit(0);
}

const source = fs.readFileSync(target, 'utf8');
const needle =
  'exports.supportsWebCodecsH264Decode = supportsWebCodecsH264Decode = await _checkWebCodecsH264DecodeSupport();';

if (!source.includes(needle)) {
  process.exit(0);
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

fs.writeFileSync(target, source.replace(needle, replacement));
