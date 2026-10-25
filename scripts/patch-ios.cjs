/**
 * Zenith iOS Native Project Patcher & Asset Generator
 * Runs in CI after `npx cap add ios` + `npx cap sync ios`
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.join(__dirname, '..');

/**
 * Pure Node.js 24-bit RGB (no alpha channel — required by Apple App Store for AppIcon) PNG generator
 */
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function generateZenithPng(width, height) {
  // 24-bit RGB (colorType = 2), 3 bytes per pixel + 1 filter byte per row
  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.min(width, height) * 0.42;

  for (let y = 0; y < height; y++) {
    const rowOff = y * stride;
    raw[rowOff] = 0; // Filter 0
    const dy = y - cy;
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);

      // Base deep space slate (#0B0E14)
      let r = 11;
      let g = 14;
      let b = 20;

      // Subtle radial glow
      if (dist < maxR * 1.15) {
        const glow = Math.max(0, 1 - dist / (maxR * 1.15));
        r += Math.round(glow * 18);
        g += Math.round(glow * 26);
        b += Math.round(glow * 46);
      }

      // Outer Gold Zodiac Ring (#F59E0B)
      if (Math.abs(dist - maxR * 0.88) < maxR * 0.032) {
        r = 245;
        g = 158;
        b = 11;
      } else if (Math.abs(dist - maxR * 0.68) < maxR * 0.018) {
        // Inner Cyan Meridian Ring (#06B6D4)
        r = 6;
        g = 182;
        b = 212;
      } else if (dist < maxR * 0.88 && dist > maxR * 0.14) {
        // ASC-DSC & MC-IC Crosshair Axes
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        if (absDy < maxR * 0.018) {
          // Horizontal ASC-DSC Gold Axis
          r = 245;
          g = 158;
          b = 11;
        } else if (absDx < maxR * 0.018) {
          // Vertical MC-IC Cyan Axis
          r = 6;
          g = 182;
          b = 212;
        } else if (Math.abs(absDx - absDy) < maxR * 0.012 && dist < maxR * 0.68) {
          // Diagonal aspect rays
          r = 56;
          g = 189;
          b = 248;
        }
      }

      // 8-point Star / Sun core at Zenith center
      const starRadius = maxR * (0.14 + 0.06 * Math.cos(angle * 4));
      if (dist < starRadius) {
        r = 253;
        g = 230;
        b = 138;
      }

      const px = rowOff + 1 + x * 3;
      raw[px] = Math.min(255, r);
      raw[px + 1] = Math.min(255, g);
      raw[px + 2] = Math.min(255, b);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth 8
  ihdr[9] = 2; // color type 2 (RGB, no alpha!)
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(raw, { level: 6 });
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

// 1. Ensure 1024x1024 AppIcon PNG exists in assets/ and ios AppIcon.appiconset
const assetsDir = path.join(root, 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}
const icon1024 = generateZenithPng(1024, 1024);
fs.writeFileSync(path.join(assetsDir, 'icon-only.png'), icon1024);
fs.writeFileSync(path.join(assetsDir, 'icon-foreground.png'), icon1024);
fs.writeFileSync(path.join(assetsDir, 'icon-background.png'), icon1024);

const appIconSetDir = path.join(
  root,
  'ios',
  'App',
  'App',
  'Assets.xcassets',
  'AppIcon.appiconset'
);
if (fs.existsSync(appIconSetDir)) {
  fs.writeFileSync(path.join(appIconSetDir, 'AppIcon-512@2x.png'), icon1024);
  const contentsJson = {
    images: [
      {
        filename: 'AppIcon-512@2x.png',
        idiom: 'universal',
        platform: 'ios',
        size: '1024x1024'
      }
    ],
    info: {
      author: 'xcode',
      version: 1
    }
  };
  fs.writeFileSync(
    path.join(appIconSetDir, 'Contents.json'),
    JSON.stringify(contentsJson, null, 2),
    'utf8'
  );
  console.log('✓ 1024x1024 Opaque RGB AppIcon.appiconset generated');
}

// 2. Patch ios/App/App/Info.plist
const plistPath = path.join(root, 'ios', 'App', 'App', 'Info.plist');
if (!fs.existsSync(plistPath)) {
  console.error('Info.plist not found:', plistPath);
  process.exit(1);
}

let plist = fs.readFileSync(plistPath, 'utf8');

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function valueXml(v) {
  if (v === true) return '<true/>';
  if (v === false) return '<false/>';
  if (Array.isArray(v)) {
    return (
      '<array>\n' +
      v.map((x) => '\t\t<string>' + esc(x) + '</string>').join('\n') +
      '\n\t</array>'
    );
  }
  return '<string>' + esc(v) + '</string>';
}

function setKey(key, value) {
  const keyTag = '<key>' + key + '</key>';
  const re = new RegExp(
    '\\t?<key>' +
      key +
      '</key>\\s*(<string>[\\s\\S]*?</string>|<true/>|<false/>|<array>[\\s\\S]*?</array>|<array/>)',
    'm'
  );
  const entry = '\t' + keyTag + '\n\t' + valueXml(value);
  if (re.test(plist)) {
    plist = plist.replace(re, entry);
  } else {
    const idx = plist.lastIndexOf('</dict>');
    plist = plist.slice(0, idx) + entry + '\n' + plist.slice(idx);
  }
}

setKey('CFBundleDisplayName', 'Zenith');
setKey('CFBundleName', 'Zenith');
setKey('CFBundleDevelopmentRegion', 'tr');
setKey('ITSAppUsesNonExemptEncryption', false);
setKey('UIViewControllerBasedStatusBarAppearance', true);
setKey('UIStatusBarStyle', 'UIStatusBarStyleLightContent');
setKey('UIRequiredDeviceCapabilities', ['arm64']);
setKey('UISupportedInterfaceOrientations', [
  'UIInterfaceOrientationPortrait',
  'UIInterfaceOrientationLandscapeLeft',
  'UIInterfaceOrientationLandscapeRight'
]);
setKey('UISupportedInterfaceOrientations~ipad', [
  'UIInterfaceOrientationPortrait',
  'UIInterfaceOrientationPortraitUpsideDown',
  'UIInterfaceOrientationLandscapeLeft',
  'UIInterfaceOrientationLandscapeRight'
]);

fs.writeFileSync(plistPath, plist, 'utf8');
console.log('✓ iOS Info.plist patched for Zenith');

// 3. Apple App Store ITMS-91053 (Required Reason API — PrivacyInfo.xcprivacy) compliance
const privacyXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>NSPrivacyTracking</key>
\t<false/>
\t<key>NSPrivacyTrackingDomains</key>
\t<array/>
\t<key>NSPrivacyCollectedDataTypes</key>
\t<array/>
\t<key>NSPrivacyAccessedAPITypes</key>
\t<array>
\t\t<dict>
\t\t\t<key>NSPrivacyAccessedAPIType</key>
\t\t\t<string>NSPrivacyAccessedAPICategoryUserDefaults</string>
\t\t\t<key>NSPrivacyAccessedAPITypeReasons</key>
\t\t\t<array>
\t\t\t\t<string>CA92.1</string>
\t\t\t</array>
\t\t</dict>
\t\t<dict>
\t\t\t<key>NSPrivacyAccessedAPIType</key>
\t\t\t<string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
\t\t\t<key>NSPrivacyAccessedAPITypeReasons</key>
\t\t\t<array>
\t\t\t\t<string>C617.1</string>
\t\t\t</array>
\t\t</dict>
\t\t<dict>
\t\t\t<key>NSPrivacyAccessedAPIType</key>
\t\t\t<string>NSPrivacyAccessedAPICategorySystemBootTime</string>
\t\t\t<key>NSPrivacyAccessedAPITypeReasons</key>
\t\t\t<array>
\t\t\t\t<string>35F9.1</string>
\t\t\t</array>
\t\t</dict>
\t\t<dict>
\t\t\t<key>NSPrivacyAccessedAPIType</key>
\t\t\t<string>NSPrivacyAccessedAPICategoryDiskSpace</string>
\t\t\t<key>NSPrivacyAccessedAPITypeReasons</key>
\t\t\t<array>
\t\t\t\t<string>E174.1</string>
\t\t\t</array>
\t\t</dict>
\t</array>
</dict>
</plist>
`;

const privacyTargets = [
  path.join(root, 'ios', 'App', 'App', 'PrivacyInfo.xcprivacy'),
  path.join(
    root,
    'node_modules',
    '@capacitor',
    'ios',
    'Capacitor',
    'Capacitor',
    'PrivacyInfo.xcprivacy'
  ),
  path.join(
    root,
    'node_modules',
    '@capacitor',
    'ios',
    'CapacitorCordova',
    'CapacitorCordova',
    'PrivacyInfo.xcprivacy'
  )
];

for (const target of privacyTargets) {
  if (fs.existsSync(path.dirname(target))) {
    fs.writeFileSync(target, privacyXml, 'utf8');
    console.log('✓ PrivacyInfo.xcprivacy updated:', path.relative(root, target));
  }
}
