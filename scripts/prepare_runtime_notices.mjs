import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const notices = path.join(root, 'public/assets/licenses');
await mkdir(notices, { recursive: true });
const threeLicense = await readFile(path.join(root, 'node_modules/three/LICENSE'), 'utf8');
await writeFile(path.join(notices, 'THREE-LICENSE.txt'), threeLicense);
const gsapPackage = JSON.parse(await readFile(path.join(root, 'node_modules/gsap/package.json'), 'utf8'));
const gsapSource = await readFile(path.join(root, 'node_modules/gsap/dist/gsap.js'), 'utf8');
const header = gsapSource.match(/\/\*![\s\S]*?\*\//)?.[0];
if (!header) throw new Error('GSAP distribution license notice was not found');
await writeFile(path.join(notices, 'GSAP-NOTICE.txt'), header + '\n\nPackage license: ' + gsapPackage.license + '\nOriginal terms: https://gsap.com/standard-license/\n');
const threePackage = JSON.parse(await readFile(path.join(root, 'node_modules/three/package.json'), 'utf8'));
await writeFile(path.join(root, 'public/THIRD_PARTY_NOTICES.txt'),
  `Runtime libraries distributed with this artwork:\n\nThree.js ${threePackage.version}\nMIT License; see assets/licenses/THREE-LICENSE.txt\nhttps://threejs.org/\n\nGSAP ${gsapPackage.version}\n${gsapPackage.license}; the original distribution notice is preserved in assets/licenses/GSAP-NOTICE.txt\nhttps://gsap.com/standard-license/\n\nFont notices and complete licenses: assets/fonts/NOTICE.txt and the accompanying OFL text files.\nArchive image sources and rights statements: ATTRIBUTION.md.\n`);
console.log(`Prepared runtime notices for Three.js ${threePackage.version} and GSAP ${gsapPackage.version}.`);
