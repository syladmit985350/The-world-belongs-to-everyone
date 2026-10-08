import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { Resources, PALETTE, BASE, box, line, crowd, humanGeometry, clamp, noise, smooth } from '../core/Resources';
import { seaMaterial } from '../shaders/Materials';
import { CONSTITUTION_DOCUMENT } from '../content/constitution';

export interface World {
  group: THREE.Group;
  camera: THREE.CatmullRomCurve3;
  focus: THREE.Vector3;
  update: (progress: number, elapsed: number) => void;
  document?: { mesh: THREE.Mesh; position: THREE.Vector3; focus: THREE.Vector3 };
  dispose?: () => void;
}

type GeoFeature = { geometry: { type: string; coordinates: unknown } };
type GeoCollection = { features: GeoFeature[] };
const cities: [string, number, number][] = [
  ['CUIHENG', 113.5, 22.4], ['HONG KONG', 114.2, 22.3], ['HONOLULU', -157.9, 21.3],
  ['YOKOHAMA', 139.6, 35.4], ['TOKYO', 139.7, 35.7], ['SINGAPORE', 103.8, 1.3],
  ['LONDON', -0.12, 51.5], ['SAN FRANCISCO', -122.4, 37.8], ['GUANGZHOU', 113.3, 23.1],
  ['WUCHANG', 114.3, 30.6], ['SHANGHAI', 121.5, 31.2], ['NANJING', 118.8, 32.1], ['BEIJING', 116.4, 39.9],
];
let coastline: Promise<GeoCollection> | undefined;
const globePosition = (lon: number, lat: number, radius = 4): THREE.Vector3 => {
  const a = THREE.MathUtils.degToRad(lon - 125), b = THREE.MathUtils.degToRad(lat);
  return new THREE.Vector3(radius * Math.cos(b) * Math.sin(a), radius * Math.sin(b), radius * Math.cos(b) * Math.cos(a));
};

function coast(resources: Resources, group: THREE.Group, spherical: boolean, radius = 4): void {
  coastline ??= fetch(BASE + 'assets/archive/world-coastline.geojson').then(response => {
    if (!response.ok) throw new Error('coastline unavailable'); return response.json() as Promise<GeoCollection>;
  });
  const pending = coastline.then(data => {
    const coords: number[] = [];
    for (const feature of data.features) {
      const type = feature.geometry.type;
      const rings: number[][][] = type === 'LineString' ? [feature.geometry.coordinates as number[][]]
        : type === 'MultiLineString' || type === 'Polygon' ? feature.geometry.coordinates as number[][][]
        : type === 'MultiPolygon' ? (feature.geometry.coordinates as number[][][][]).flat() : [];
      for (const ring of rings) for (let i = 1; i < ring.length; i++) {
        const a = ring[i - 1], b = ring[i]; if (Math.abs(a[0] - b[0]) > 100) continue;
        const va = spherical ? globePosition(a[0], a[1], radius + 0.015) : new THREE.Vector3(a[0] / 27, a[1] / 20, 0);
        const vb = spherical ? globePosition(b[0], b[1], radius + 0.015) : new THREE.Vector3(b[0] / 27, b[1] / 20, 0);
        coords.push(...va.toArray(), ...vb.toArray());
      }
    }
    const geometry = resources.geometry(new THREE.BufferGeometry()); geometry.setAttribute('position', new THREE.Float32BufferAttribute(coords, 3));
    const outline = new THREE.LineSegments(geometry, resources.material(new THREE.LineBasicMaterial({ color: PALETTE.ochre, opacity: 0.7, transparent: true })));
    group.add(outline);
  }).catch(() => { if (!resources.failures.includes('world-coastline.geojson')) resources.failures.push('world-coastline.geojson'); });
  resources.pending.push(pending);
}

function arc(resources: Resources, a: THREE.Vector3, b: THREE.Vector3, globe = false, color = PALETTE.red): THREE.Line {
  const pts: THREE.Vector3[] = [];
  if (globe) {
    for (let i = 0; i <= 80; i++) {
      const t = i / 80;
      const p = a.clone().lerp(b, t).normalize().multiplyScalar(a.length() + Math.sin(t * Math.PI) * 1.6);
      pts.push(p);
    }
  } else {
    const mid = a.clone().lerp(b, 0.5); mid.z += a.distanceTo(b) * 0.28;
    pts.push(...new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(60));
  }
  return line(resources, pts, color, 0.6);
}

function ship(resources: Resources): THREE.Group {
  const group = new THREE.Group();
  const hull = box(resources, 1.3, 0.22, 0.36, '#35382e'); hull.position.y = -0.12; group.add(hull);
  const deck = box(resources, 0.65, 0.13, 0.3, '#8c8168'); deck.position.set(-0.08, 0.05, 0); group.add(deck);
  const smoke = box(resources, 0.09, 0.34, 0.1, '#35372e'); smoke.position.set(0.02, 0.25, 0); group.add(smoke);
  const pole = box(resources, 0.026, 0.82, 0.026, '#8a8067'); pole.position.set(-0.4, 0.42, 0); group.add(pole);
  return group;
}

function sea(resources: Resources, group: THREE.Group, y = -3): THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
  const material = resources.material(seaMaterial());
  const mesh = new THREE.Mesh(resources.geometry(new THREE.PlaneGeometry(130, 130, 80, 80)), material);
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(0, y, -25); group.add(mesh); return mesh;
}

function paper(resources: Resources, group: THREE.Group, title: string, lines: string[], position: [number, number, number], size = 4, kind: 'ink' | 'burn' | 'photo' = 'ink') {
  const page = resources.plane(resources.document(title, lines), size, size * 1.367, kind); page.position.set(...position); group.add(page); return page;
}

function photograph(resources: Resources, group: THREE.Group, file: string, position: [number, number, number], width: number, height: number) {
  const photo = resources.plane(resources.texture('assets/archive/' + file), width, height, 'photo'); photo.position.set(...position); group.add(photo); return photo;
}

function person(resources: Resources, group: THREE.Group, x: number, y: number, z: number, scale = 1, color = '#111610'): THREE.Mesh {
  const mesh = new THREE.Mesh(humanGeometry(resources), resources.material(new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 1, transparent: true })));
  mesh.position.set(x, y, z); mesh.scale.setScalar(scale); group.add(mesh); return mesh;
}

function frame(resources: Resources, group: THREE.Group, center: THREE.Vector3, width: number, height: number, color = PALETTE.ochre): THREE.Line {
  const pts = [new THREE.Vector3(-width / 2, -height / 2, 0), new THREE.Vector3(width / 2, -height / 2, 0), new THREE.Vector3(width / 2, height / 2, 0), new THREE.Vector3(-width / 2, height / 2, 0), new THREE.Vector3(-width / 2, -height / 2, 0)];
  const f = line(resources, pts, color, 0.4); f.position.copy(center); group.add(f); return f;
}

function city(resources: Resources, group: THREE.Group, wire = true, count = 45): THREE.Group {
  const town = new THREE.Group();
  const geometry = resources.geometry(new THREE.BoxGeometry(1, 1, 1));
  const material = resources.material(new THREE.MeshStandardMaterial({ color: PALETTE.green, wireframe: wire, transparent: true, opacity: wire ? 0.45 : 0.85, roughness: 0.95 }));
  const buildings = new THREE.InstancedMesh(geometry, material, count); const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const h = 0.5 + noise(i + 900) * 3.7;
    dummy.position.set(((i % 9) - 4) * 1.42, h / 2 - 3, -Math.floor(i / 9) * 2.0 - 2);
    dummy.scale.set(0.62 + noise(i) * 0.5, h, 0.75); dummy.updateMatrix(); buildings.setMatrixAt(i, dummy.matrix);
  }
  town.add(buildings);
  for (let i = 0; i < 12; i++) town.add(line(resources, [new THREE.Vector3((i - 6) * 1.5, -2.95, 5), new THREE.Vector3((i - 6) * 1.5, -2.95, -20)], PALETTE.ochre, 0.27));
  group.add(town); return town;
}

function school(resources: Resources, group: THREE.Group): THREE.Group {
  const room = new THREE.Group();
  const material = resources.material(new THREE.MeshStandardMaterial({ color: '#555548', roughness: 0.95 }));
  const geometry = resources.geometry(new THREE.BoxGeometry(0.82, 0.1, 0.85));
  const seats = new THREE.InstancedMesh(geometry, material, 56); const backs = new THREE.InstancedMesh(resources.geometry(new THREE.BoxGeometry(0.82, 0.8, 0.1)), material, 56);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 56; i++) {
    const x = (i % 8 - 3.5) * 1.5, z = -Math.floor(i / 8) * 2 - 1;
    dummy.position.set(x, -1.8, z); dummy.updateMatrix(); seats.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, -1.4, z - 0.38); dummy.updateMatrix(); backs.setMatrixAt(i, dummy.matrix);
    const legs = line(resources, [new THREE.Vector3(x - 0.35, -3, z), new THREE.Vector3(x - 0.35, -1.8, z), new THREE.Vector3(x + 0.35, -1.8, z), new THREE.Vector3(x + 0.35, -3, z)], '#6b6855', 0.7); room.add(legs);
  }
  room.add(seats, backs);
  const board = box(resources, 10, 4, 0.18, '#1a2c22'); board.position.set(0, 0, -16); room.add(board);
  const word = resources.label('理念，如何交给后来的人？', 8); word.position.set(0, 0.25, -15.89); room.add(word);
  group.add(room); return room;
}

export function makeWorld(index: number, resources: Resources, mobile: boolean): World {
  const group = new THREE.Group(); group.name = `historical-world-${index}`;
  const focus = new THREE.Vector3(0, 0, 0);
  const start = new THREE.Vector3(0, 1.6, 18), mid = new THREE.Vector3(1.2, 0.6, 16), end = new THREE.Vector3(-0.6, 0.6, 12.7);
  let animate = (_p: number, _t: number): void => {};
  let dispose: (() => void) | undefined;
  let readableDocument: World['document'];

  if (index === 0) {
    const ocean = sea(resources, group, -3.75); const atlas = new THREE.Group(); atlas.position.set(mobile ? 2.0 : 4.3, mobile ? -3.9 : 0.3, 0); atlas.scale.setScalar(mobile ? 0.54 : 1); atlas.rotation.set(-0.12, -0.16, -0.08); group.add(atlas);
    const texture = resources.texture('assets/archive/east-asia-1892.jpg');
    const shards: { mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>; home: THREE.Vector3; direction: THREE.Vector3 }[] = [];
    for (let y = 0; y < 5; y++) for (let x = 0; x < 7; x++) {
      const tile = resources.plane(texture, 1.4, 1.27); const uv = tile.geometry.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (x + uv.getX(i)) / 7, (y + uv.getY(i)) / 5);
      uv.needsUpdate = true;
      const home = new THREE.Vector3((x - 3) * 1.415, (y - 2) * 1.285, (noise(y * 7 + x) - 0.5) * 0.19);
      const direction = new THREE.Vector3((x - 3) * 0.16, (y - 2) * 0.11, noise(x * 7 + y) * 0.65);
      tile.position.copy(home).addScaledVector(direction, 1); tile.rotation.y = (noise(x + y * 7) - 0.5) * 0.13;
      atlas.add(tile); shards.push({ mesh: tile, home, direction });
    }
    const slipTextures = ['电讯', '时局'].map(title => resources.document(title, ['海港 · 商埠 · 电报', '十九世纪的世界', '一封信穿过海洋']));
    for (let i = 0; i < 13; i++) {
      const slip = resources.plane(slipTextures[i % 2], 0.7 + noise(i) * 0.45, 1.1 + noise(i) * 0.9);
      slip.position.set(-4 + noise(i + 40) * 13, -2.9 + noise(i + 20) * 6.6, -3 - noise(i) * 8); slip.rotation.set(-0.1, (noise(i) - 0.5) * 1.7, (noise(i + 7) - 0.5) * 1.1); group.add(slip);
      if (mobile) { slip.position.x = 1.8 + noise(i + 40) * 4; slip.position.y = -4.4 + noise(i + 20) * 0.9; slip.scale.setScalar(0.55); }
    }
    const vessel = ship(resources); vessel.position.set(3, -3.5, 4); vessel.scale.setScalar(0.62); group.add(vessel);
    const route = line(resources, new THREE.CatmullRomCurve3([new THREE.Vector3(0.4, -0.7, 0.3), new THREE.Vector3(3.3, 1.8, 2.4), new THREE.Vector3(7.0, 2.5, -1)]).getPoints(70), PALETTE.red, 0.58); atlas.add(route);
    const coordinate = resources.label('EAST ASIA · 1892', 3, PALETTE.ochre); coordinate.position.set(4.7, -3.0, 1); group.add(coordinate);
    start.set(0, 1.1, 19.4); mid.set(0.4, 1.4, 17.6); end.set(2.2, 1.2, 12); focus.set(mobile ? 0.6 : 1.8, -0.05, 0);
    animate = (p, t) => {
      ocean.material.uniforms.uTime.value = t;
      atlas.rotation.z = -0.08 + Math.sin(t * 0.09) * 0.018;
      shards.forEach((s, i) => { s.mesh.position.copy(s.home).addScaledVector(s.direction, 0.7 + p * 0.7 + Math.sin(t * 0.3 + i) * 0.12); s.mesh.material.uniforms.uTime.value = t; });
      vessel.position.x = 3 + Math.sin(t * 0.08) * 0.4; vessel.rotation.z = Math.sin(t * 0.5) * 0.02;
    };
  } else if (index === 1) {
    const ocean = sea(resources, group, -3.15);
    const wall = box(resources, 8.2, 5.3, 0.45, '#898777'); wall.position.set(1.8, -0.2, -3); group.add(wall);
    const doorway = box(resources, 1.5, 3.4, 0.48, '#292e26'); doorway.position.set(2.5, -1.1, -2.71); group.add(doorway);
    const roof = box(resources, 9.1, 0.28, 2.4, '#3f4540'); roof.position.set(1.8, 2.8, -3); roof.rotation.z = -0.055; group.add(roof);
    for (let i = 0; i < 20; i++) { const tile = box(resources, 0.07, 0.11, 2.4, '#646b62'); tile.position.set(-2.5 + i * 0.46, 2.97, -3); group.add(tile); }
    const tree = new THREE.Group(); tree.position.set(-3, -3, 0); group.add(tree);
    for (let i = 0; i < 14; i++) {
      const a = new THREE.Vector3(0, 0, 0), b = new THREE.Vector3((noise(i + 18) - 0.5) * 6, 3.5 + noise(i) * 3.2, (noise(i + 13) - 0.5) * 2);
      tree.add(line(resources, new THREE.CatmullRomCurve3([a, new THREE.Vector3((noise(i) - 0.5) * 0.9, 2.3, 0), b]).getPoints(24), '#6d7466', 0.7));
      const leaves = new THREE.Mesh(resources.geometry(new THREE.IcosahedronGeometry(1, 1)), resources.material(new THREE.MeshStandardMaterial({ color: '#283e30', roughness: 1, transparent: true, opacity: 0.78 }))); leaves.position.copy(b); leaves.scale.set(1.15, 0.57, 0.65); tree.add(leaves);
    }
    const boy = person(resources, group, 0.4, -3, 2.2, 0.72, '#20261e'); boy.rotation.y = 0.17;
    const stone = box(resources, 9, 0.17, 4, '#686f63'); stone.position.set(0.3, -3.12, 0); group.add(stone);
    start.set(-1.7, 1.7, 18); mid.set(0.3, 0.4, 15); end.set(1.2, -0.3, 12.3); focus.set(0.8, -0.3, -1);
    animate = (_p, t) => { ocean.material.uniforms.uTime.value = t; tree.rotation.z = Math.sin(t * 0.4) * 0.016; };
  } else if (index === 2) {
    const page = paper(resources, group, '医　学', ['身体 · 生命 · 社会', '1892　香港西医书院', '从一个人的病痛', '走向一个时代的问路'], [0, 0.3, 0], 4.6);
    page.rotation.y = -0.18;
    for (let i = 0; i < 8; i++) {
      const bottle = new THREE.Mesh(resources.geometry(new THREE.CylinderGeometry(0.16, 0.25, 0.95, 12)), resources.material(new THREE.MeshPhysicalMaterial({ color: i % 2 ? '#73867b' : '#afa790', roughness: 0.2, transmission: mobile ? 0 : 0.65, transparent: true, opacity: 0.65 })));
      bottle.position.set(-4.8 + i * 1.0, -2.5, 1.4 + Math.sin(i) * 0.7); group.add(bottle);
      const neck = box(resources, 0.13, 0.26, 0.13, '#4f5b4e'); neck.position.copy(bottle.position).add(new THREE.Vector3(0, 0.6, 0)); group.add(neck);
    }
    const desk = box(resources, 11, 0.12, 5, '#6e7468'); desk.position.set(0, -3.06, 0); group.add(desk);
    const pulsePts: THREE.Vector3[] = [];
    for (let i = 0; i < 170; i++) { const x = i / 169 * 11 - 5.5; const phase = i % 45; const y = phase === 20 ? 1 : phase === 21 ? -0.6 : phase === 19 ? -0.2 : 0; pulsePts.push(new THREE.Vector3(x, -1.3 + y, 3)); }
    const pulse = line(resources, pulsePts, PALETTE.red, 0.8); group.add(pulse);
    const geography = new THREE.Group(); geography.position.set(0, 0, -2); coast(resources, geography, false); group.add(geography);
    const people = crowd(resources, 37, 18, '#3b443a'); people.position.z = -7; group.add(people);
    if (mobile) { start.set(0, 1.2, 19); mid.set(0, 0.5, 18.5); end.set(0, 0.1, 17.8); }
    animate = (p, t) => { page.rotation.z = Math.sin(t * 0.2) * 0.015; page.material.uniforms.uTime.value = t; pulse.scale.y = 0.6 + Math.sin(t * 5.4) * 0.4; geography.scale.setScalar(0.3 + p * 0.8); };
  } else if (index === 3) {
    const letter = paper(resources, group, '上李鸿章书', ['人能尽其才，', '地能尽其利，', '物能尽其用，', '货能畅其流。', '1894 · 一条尚未打开的路'], [0.7, 0, 0], 5, 'burn'); letter.rotation.set(-0.025, -0.16, -0.035);
    const stamp = resources.label('一八九四', 2.8, PALETTE.red); stamp.position.set(2.2, -2.6, 0.05); stamp.rotation.z = -0.08; group.add(stamp);
    frame(resources, group, new THREE.Vector3(0.7, 0, -0.25), 5.7, 7.4);
    const ashes: THREE.Mesh[] = [];
    const geometry = resources.geometry(new THREE.PlaneGeometry(0.09, 0.15)); const material = resources.material(new THREE.MeshBasicMaterial({ color: '#a69b80', side: THREE.DoubleSide, transparent: true, opacity: 0.65 }));
    for (let i = 0; i < 65; i++) { const ash = new THREE.Mesh(geometry, material); group.add(ash); ashes.push(ash); }
    start.set(-0.4, 0.4, 18); end.set(1, 0.1, 10.5); focus.set(0.7, 0, 0);
    animate = (p, t) => { letter.material.uniforms.uTime.value = t; letter.material.uniforms.uBurn.value = smooth((p - 0.48) / 0.5) * 0.95; ashes.forEach((ash, i) => { ash.visible = p > 0.52; const phase = (t * 0.09 + noise(i)) % 1; ash.position.set((noise(i + 33) - 0.5) * 6 + phase, -3 + phase * 9, noise(i + 1) * 3); ash.rotation.set(t * 0.12 + i, i, t * 0.2); }); };
  } else if (index === 4) {
    const map = new THREE.Group(); map.position.set(0.5, 0, -0.5); coast(resources, map, false); group.add(map);
    const net: THREE.Line[] = [];
    const positions = cities.map(c => new THREE.Vector3(c[1] / 27, c[2] / 20, 0.1));
    const order = [2, 1, 8, 3, 4, 5, 7, 6];
    for (let i = 1; i < order.length; i++) { const route = arc(resources, positions[order[i - 1]], positions[order[i]]); map.add(route); net.push(route); }
    order.forEach((i, n) => { const point = new THREE.Mesh(resources.geometry(new THREE.SphereGeometry(0.055, 8, 8)), resources.material(new THREE.MeshBasicMaterial({ color: n === 0 ? PALETTE.red : PALETTE.ivory }))); point.position.copy(positions[i]); map.add(point); const tag = resources.label(cities[i][0], 1.4, PALETTE.ochre); tag.position.copy(positions[i]).add(new THREE.Vector3(0.4, 0.22 + (n % 2) * 0.2, 0.1)); map.add(tag); });
    const people = crowd(resources, 75, 15, '#454b3e'); people.position.set(0, -0.1, -3); group.add(people);
    const word = resources.label('興中會', 5.5); word.position.set(0, -2.1, 2.1); group.add(word);
    frame(resources, group, new THREE.Vector3(0, 0, -1), 14, 7);
    animate = (p, t) => { map.rotation.y = Math.sin(t * 0.075) * 0.08; net.forEach((route, i) => route.geometry.setDrawRange(0, Math.floor(clamp(p * 1.5 - i * 0.1) * 61))); };
  } else if (index === 5) {
    const globe = new THREE.Group(); globe.position.set(0.4, 0.1, 0); group.add(globe);
    const sphere = new THREE.Mesh(resources.geometry(new THREE.SphereGeometry(4, 48, 32)), resources.material(new THREE.MeshStandardMaterial({ color: '#18211b', roughness: 0.94, transparent: true, opacity: 0.93 }))); globe.add(sphere); coast(resources, globe, true);
    for (let lat = -60; lat <= 60; lat += 30) { const pts = Array.from({ length: 100 }, (_, i) => globePosition(i / 99 * 360 - 180, lat, 4.01)); globe.add(line(resources, pts, '#68735f', 0.17)); }
    const order = [8, 1, 3, 2, 7, 6, 5, 4]; const routes: THREE.Line[] = [];
    for (let i = 1; i < order.length; i++) { const route = arc(resources, globePosition(cities[order[i - 1]][1], cities[order[i - 1]][2], 4.035), globePosition(cities[order[i]][1], cities[order[i]][2], 4.035), true); globe.add(route); routes.push(route); }
    for (const i of order) { const marker = resources.label(cities[i][0], 1.65, PALETTE.ochre); marker.position.copy(globePosition(cities[i][1], cities[i][2], 4.3)); marker.lookAt(marker.position.clone().multiplyScalar(2)); globe.add(marker); }
    const boat = ship(resources); boat.scale.setScalar(0.34); globe.add(boat);
    const prison = new THREE.Group(); prison.position.set(0, 0, 5.2); group.add(prison);
    const left = box(resources, 5, 11, 6, '#353a32'); left.position.set(-9, 0, -1); prison.add(left);
    const right = box(resources, 5, 11, 6, '#353a32'); right.position.set(9, 0, -1); prison.add(right);
    const escape = paper(resources, prison, 'LONDON · 1896', ['一封信穿过墙隙', '信息，成为援助'], [0, -1.0, -1], 1.15);
    const bars = new THREE.Group(); for (let i = 0; i < 7; i++) { const bar = box(resources, 0.055, 7, 0.065, '#4d584b'); bar.position.set((i - 3) * 0.6, 0, -2.5); bars.add(bar); } prison.add(bars);
    start.set(1.8, 1.9, 18); mid.set(-0.9, 1.0, 15); end.set(0, 0.2, 11); focus.set(0.2, 0, 0);
    animate = (p, t) => {
      globe.rotation.y = -0.12 + p * 1.65; routes.forEach((route, i) => route.geometry.setDrawRange(0, Math.floor(clamp(p * 2.3 - i * 0.12) * 81)));
      const path = globePosition(125 + p * 105, 15 + Math.sin(p * 3) * 12, 4.21); boat.position.copy(path); boat.lookAt(path.clone().add(new THREE.Vector3(0.5, 0, 0)));
      const confinement = smooth((p - 0.54) / 0.20) * (1 - smooth((p - 0.85) / 0.14)); prison.visible = p > 0.5; left.position.x = -9 + confinement * 5; right.position.x = 9 - confinement * 5; bars.position.z = -3 + confinement * 3.2; bars.visible = p < 0.86;
      escape.position.set(smooth((p - 0.79) / 0.2) * 8, -1 + p, -1 + smooth((p - 0.79) / 0.2) * 6); escape.rotation.z = t * 0.07;
    };
  } else if (index === 6) {
    const photo = photograph(resources, group, 'tongmenghui.jpg', [0, 2.2, -2.4], 6.4, 2.8); photo.rotation.y = -0.06;
    const principle = new THREE.Group(); group.add(principle);
    const words = ['民族', '民權', '民生'];
    words.forEach((word, i) => { const label = resources.label(word, mobile ? 3 : 4.1, i === 1 ? PALETTE.ivory : PALETTE.ochre, mobile ? 264 : 132); label.position.set((i - 1) * (mobile ? 3.2 : 5.3), 0.1, i === 1 ? 2 : -0.5); label.rotation.y = (1 - i) * 0.17; principle.add(label); });
    const nation = new THREE.Group(); nation.position.set(-5.3, -1.8, 0); nation.scale.setScalar(0.27); coast(resources, nation, false); principle.add(nation);
    const throne = box(resources, 0.9, 2.4, 0.6, '#6c604b'); throne.position.set(0, -1.8, -1.8); principle.add(throne);
    const people = crowd(resources, 54, 5, '#626b59'); people.position.set(0, 0, 0); principle.add(people);
    const living = city(resources, principle, true, 18); living.position.set(5.3, -1.1, 0); living.scale.setScalar(0.38);
    if (mobile) { nation.position.x = -3.2; living.position.x = 3.2; living.scale.setScalar(0.28); }
    const concentric = Array.from({ length: 7 }, (_, i) => { const pts = Array.from({ length: 81 }, (_, n) => new THREE.Vector3(Math.cos(n / 80 * Math.PI * 2) * (1.4 + i * 0.45), -2.9, Math.sin(n / 80 * Math.PI * 2) * (1.4 + i * 0.45))); const ring = line(resources, pts, PALETTE.green, 0.35); group.add(ring); return ring; });
    start.set(-3, 1.5, 18.5); mid.set(0, 0.5, 19); end.set(3, 0.3, 17); focus.set(0, -0.2, 0);
    if (mobile) { start.set(0, 1.5, 20); mid.set(0, 0.5, 19.5); end.set(0, 0.3, 19); }
    animate = (p, t) => { photo.material.uniforms.uReveal.value = smooth(p * 3); photo.material.uniforms.uTime.value = t; throne.scale.y = Math.max(0.02, 1 - smooth((p - 0.25) * 2)); nation.scale.setScalar(0.2 + smooth(p * 2) * 0.12); concentric.forEach((ring, i) => { ring.scale.setScalar(0.6 + smooth(p * 2 - i * 0.1) * 0.7); }); };
  } else if (index === 7) {
    const attempts = ['1895 · 广州', '1900 · 惠州', '1907 · 镇南关', '1908 · 河口', '1911 · 广州'];
    const lamps: THREE.Mesh[] = [];
    attempts.forEach((label, i) => {
      const x = (i - 2) * 2.5, z = -i * 0.35;
      const stand = box(resources, 0.025, 3.5, 0.025, '#6b6654'); stand.position.set(x, -1.25, z); group.add(stand);
      const lamp = new THREE.Mesh(resources.geometry(new THREE.SphereGeometry(0.1, 10, 8)), resources.material(new THREE.MeshBasicMaterial({ color: '#edd9a6', transparent: true }))); lamp.position.set(x, 0.6, z); group.add(lamp); lamps.push(lamp);
      const text = resources.label(label, 2.6, '#aea386'); text.position.set(x, -1.6, z + 0.3); group.add(text);
    });
    for (let i = 0; i < 6; i++) { const step = box(resources, 9 - i * 0.7, 0.18, 1.2, '#5d6257'); step.position.set(0, -3 + i * 0.18, -3 - i * 1.05); group.add(step); }
    const petals = new THREE.InstancedMesh(resources.geometry(new THREE.PlaneGeometry(0.13, 0.23)), resources.material(new THREE.MeshBasicMaterial({ color: '#f0ece1', side: THREE.DoubleSide, transparent: true, opacity: 0.8 })), mobile ? 160 : 460); group.add(petals);
    const names = resources.label('林觉民　林时爽　喻培伦　方声洞　陈更新', 8.5); names.position.set(0, -0.2, -2); group.add(names);
    const dummy = new THREE.Object3D();
    animate = (p, t) => { lamps.forEach((lamp, i) => { const progress = p * 8 - i * 0.95; lamp.scale.setScalar(progress > 0 && progress < 0.8 ? 2.8 : 0.35); }); names.visible = p > 0.67; petals.visible = p > 0.6; for (let i = 0; i < petals.count; i++) { const phase = (t * 0.05 + noise(i)) % 1; dummy.position.set((noise(i + 34) - 0.5) * 15 + Math.sin(t * 0.3 + i) * 0.3, 4.5 - phase * 8, (noise(i + 70) - 0.5) * 9); dummy.rotation.set(i + t * 0.1, i, t * 0.2 + i); dummy.updateMatrix(); petals.setMatrixAt(i, dummy.matrix); } petals.instanceMatrix.needsUpdate = true; };
  } else if (index === 8) {
    const wuchang = new THREE.Group(); wuchang.position.set(-4, 0, 0); group.add(wuchang);
    const distant = new THREE.Group(); distant.position.set(4, 0, 0); group.add(distant);
    const left = resources.label('武昌 · 10 OCT 1911', 5.0); left.position.set(0, 2.3, 0); wuchang.add(left);
    const right = resources.label('海外 · 消息抵达', 4.5); right.position.set(0, 2.3, 0); distant.add(right);
    const soldiers = crowd(resources, 38, 5, '#5c6555'); wuchang.add(soldiers);
    const sun = person(resources, distant, 0, -3, 1.0, 0.9, '#444d3c');
    const telegram = paper(resources, distant, '电报 / TELEGRAM', ['武昌起义', '地方新军 · 革命党人', '不同的行动者', '消息，跨越海洋'], [0, 0, -1], 2.5);
    const telegraph = arc(resources, new THREE.Vector3(-4, 1.4, 0), new THREE.Vector3(4, 1.4, 0), false, PALETTE.ochre); group.add(telegraph);
    const provinceNames = ['湖北', '湖南', '陕西', '江西', '山西', '云南', '浙江', '江苏'];
    const provinceLights: THREE.Mesh[] = [];
    provinceNames.forEach((name, i) => { const tag = resources.label(name, 1.3, PALETTE.ochre); tag.position.set((i % 4 - 1.5) * 2.0, -0.7 - Math.floor(i / 4) * 1.2, 3); group.add(tag); provinceLights.push(tag); });
    const ocean = sea(resources, group); const boat = ship(resources); boat.position.set(0, -2.65, 4.6); group.add(boat);
    start.set(0, 1.7, 20); mid.set(0, 0.8, 18); end.set(0.5, -0.2, 13.8); focus.set(0, -0.3, 0);
    animate = (p, t) => { ocean.material.uniforms.uTime.value = t; telegraph.geometry.setDrawRange(0, Math.floor(clamp(p * 2) * 61)); provinceLights.forEach((tag, i) => { tag.visible = p > 0.24 + i * 0.055; }); boat.visible = p > 0.65; boat.position.z = 6 - smooth((p - 0.65) / 0.35) * 4; sun.position.z = 1 - p; telegram.material.uniforms.uTime.value = t; };
  } else if (index === 9) {
    const room = new THREE.Group(); group.add(room);
    const floor = box(resources, 26, 0.15, 29, '#b9b7a3'); floor.position.set(0, -3.1, -8); room.add(floor);
    for (let i = 0; i < 7; i++) {
      const x = (i - 3) * 3.4;
      const column = box(resources, 0.2, 11, 0.25, '#a9ae99'); column.position.set(x, 1.5, -6); room.add(column);
      const word = resources.label(['国民', '主权', '权利', '法律', '公民', '参议院', '制度'][i], 3.5, PALETTE.green); word.rotation.z = Math.PI / 2; word.position.set(x, 1.3, -5.85); room.add(word);
    }
    for (let i = 0; i < 6; i++) room.add(line(resources, [new THREE.Vector3(-11, -1 + i * 1.6, -6), new THREE.Vector3(11, -1 + i * 1.6, -6)], PALETTE.green, 0.3));
    ['主权　国民　权利　共和　法律', '自由　平等　制度　公民　国家'].forEach((text, i) => { const beam = resources.label(text, 17, '#4c674e'); beam.position.set(0, 4.7 - i * 1.55, -5.7); room.add(beam); });
    const desk = box(resources, 5.6, 0.2, 2.8, '#324d3b'); desk.position.set(0, -1.8, 0); room.add(desk);
    [-2.3, 2.3].forEach(x => { const leg = box(resources, 0.13, 1.3, 0.13, '#4a5842'); leg.position.set(x, -2.45, 0); room.add(leg); });
    const president = resources.label('PRESIDENT', 3, PALETTE.green); president.position.set(0, -0.9, 0.8); group.add(president);
    const clauses = CONSTITUTION_DOCUMENT.excerpts.flatMap(clause => [clause.labelZh, ...clause.zh.match(/.{1,14}/g)!]);
    const constitution = paper(resources, group, CONSTITUTION_DOCUMENT.titleZh, [...clauses, CONSTITUTION_DOCUMENT.date], [3.0, 0.25, 1.6], 2.8); constitution.rotation.y = -0.2;
    readableDocument = { mesh: constitution, position: new THREE.Vector3(mobile ? 1.4 : 2.1, 0.4, mobile ? 10.6 : 8.3), focus: constitution.position.clone() };
    const photo = photograph(resources, group, 'sun-provisional-president.jpg', [-3.5, 0.1, -0.3], 2.5, 4.3); photo.rotation.y = 0.15;
    const seal = box(resources, 0.4, 0.3, 0.4, '#70443a'); seal.position.set(0.8, -1.45, 0.7); group.add(seal);
    const window = resources.plane(resources.text('1912 · NANJING', 80, '#64735d', 1600, 1200, '#e7e3d3'), 12, 8); window.position.set(0, 1, -8); group.add(window);
    start.set(-2.4, 1.1, 17); mid.set(0, 0.4, 15); end.set(2.4, 0.1, 12.5); focus.set(0, -0.1, -1);
    if (mobile) { start.set(0, 1.1, 21); mid.set(0, 0.4, 20); end.set(0, 0.1, 18.5); }
    animate = (p, t) => { photo.material.uniforms.uTime.value = t; photo.material.uniforms.uReveal.value = smooth(p * 3); constitution.material.uniforms.uTime.value = t; president.rotation.x = smooth((p - 0.65) / 0.3) * -Math.PI / 2; president.position.y = -0.9 - smooth((p - 0.65) / 0.3) * 0.75; };
  } else if (index === 10) {
    const structure = new THREE.Group(); group.add(structure);
    const columns: THREE.Mesh[] = [];
    for (let i = 0; i < 11; i++) {
      const piece = box(resources, 0.15, 7, 0.2, '#a1aca2'); piece.position.set((i - 5) * 1.22, 0.1, -1 + noise(i) * 1.7); structure.add(piece); columns.push(piece);
      const word = resources.label(['共和', '法律', '国民', '权利'][i % 4], 2.5, '#86998d'); word.rotation.z = Math.PI / 2; word.position.copy(piece.position).add(new THREE.Vector3(0, 0, 0.18)); structure.add(word);
    }
    const fractures: THREE.Line[] = [];
    for (let i = 0; i < 14; i++) { const crack = line(resources, [new THREE.Vector3(-6 + noise(i) * 12, 3, 0), new THREE.Vector3(-3 + noise(i + 4) * 6, 1, 1), new THREE.Vector3(-5 + noise(i + 1) * 10, -3, 0)], '#adb8ab', 0.5); structure.add(crack); fractures.push(crack); }
    const base = resources.label('共和', 4.6, '#b4b7a6'); base.rotation.x = -Math.PI / 2; base.position.set(0, -3, 3); group.add(base);
    const loss = resources.label('1913 · 宋教仁遇刺', 5.5, '#b1b7aa'); loss.position.set(0, 2.3, 2); group.add(loss);
    const boat = ship(resources); boat.position.set(-4, -2.8, -5); group.add(boat);
    animate = (p, t) => { columns.forEach((piece, i) => { const collapse = smooth((p - i * 0.015 - 0.35) / 0.5); piece.rotation.z = collapse * (noise(i) - 0.5) * 2.4; piece.position.y = 0.1 - collapse * noise(i + 1) * 2.8; piece.position.z = -1 + noise(i) * 1.7 + collapse * noise(i + 3) * 3; }); fractures.forEach((crack, i) => { crack.geometry.setDrawRange(0, Math.floor(clamp(p * 2 - i * 0.06) * 3)); }); boat.position.x = -4 + Math.sin(t * 0.13) * 0.5; };
  } else if (index === 11) {
    const document = paper(resources, group, 'CONSTITUTION', ['法　／　1917', '共和国的合法性', '仍然是一道未完成的问题', '广州 · 护法'], [-1.3, 0.1, 2], 3.6, 'burn'); document.rotation.z = -0.1;
    const hand = box(resources, 0.22, 2, 0.25, '#8c8876'); hand.position.set(-3, -2.2, 2.1); hand.rotation.z = -0.4; group.add(hand);
    const town = city(resources, group, true, 63); town.position.set(0, 0, -4);
    const plan = resources.label('铁路 · 港口 · 水利 · 学校', 8, PALETTE.ochre); plan.position.set(2.5, 2.6, -1); group.add(plan);
    animate = (p, t) => { document.material.uniforms.uTime.value = t; document.material.uniforms.uBurn.value = 0.22 + (1 - smooth(p * 1.5)) * 0.22; document.position.y = 0.1 + p * 0.8; hand.position.y = -2.2 + p * 0.8; town.scale.y = 0.8 + smooth(p) * 0.2; };
  } else if (index === 12) {
    const network = new THREE.Group(); group.add(network);
    const words = ['政党', '工人', '农民', '青年', '学校', '军队', '社会运动'];
    const nodes = words.map((word, i) => {
      const angle = i / words.length * Math.PI * 2; const pos = new THREE.Vector3(Math.cos(angle) * 5.2, Math.sin(angle) * 2.8, Math.sin(angle * 2) * 1.3);
      const label = resources.label(word, 2.2, i % 2 ? PALETTE.ochre : '#d7d8c1'); label.position.copy(pos); network.add(label); return pos;
    });
    const routes: THREE.Line[] = []; for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) { const route = arc(resources, nodes[i], nodes[j], false, i % 3 ? PALETTE.ochre : PALETTE.red); network.add(route); routes.push(route); }
    const center = resources.label('1924 · 重新组织', 4.8); center.position.set(0, 0, 2); group.add(center);
    const people = crowd(resources, 95, 17, '#485443'); group.add(people);
    const context = resources.label('联俄 · 联共 · 扶助农工｜特定历史时期的政治选择', 10, '#958f78'); context.position.set(0, -2.45, 3); group.add(context);
    animate = (p, t) => { routes.forEach((route, i) => route.geometry.setDrawRange(0, Math.floor(clamp(p * 2 - noise(i) * 0.65) * 61))); network.rotation.y = Math.sin(t * 0.07) * 0.09; };
  } else if (index === 13) {
    const room = school(resources, group);
    const photo = photograph(resources, group, 'whampoa.jpg', [5, 1.1, -9], 4.2, 2.9); photo.rotation.y = -0.35;
    const youths = crowd(resources, 32, 14, '#5a6350'); youths.position.z = -2; group.add(youths);
    const window = new THREE.Group(); window.position.set(0, 0, 4); group.add(window);
    const borders = [box(resources, 11, 0.42, 0.45, '#3a443a'), box(resources, 11, 0.55, 0.45, '#3a443a'), box(resources, 0.42, 7, 0.45, '#3a443a'), box(resources, 0.42, 7, 0.45, '#3a443a')];
    borders[0].position.y = 3.1; borders[1].position.y = -3.1; borders[2].position.x = -5.3; borders[3].position.x = 5.3; window.add(...borders);
    const sill = box(resources, 11, 0.15, 1.2, '#4e5548'); sill.position.set(0, -3.2, 0.6); window.add(sill);
    const tracks: THREE.Line[] = [];
    for (let i = 0; i < 2; i++) { const track = line(resources, [new THREE.Vector3(-1 + i * 2, -3, 5), new THREE.Vector3(-1 + i * 2, -3, -80)], '#7b887a', 0.65); group.add(track); tracks.push(track); }
    const sleepers = new THREE.InstancedMesh(resources.geometry(new THREE.BoxGeometry(3.1, 0.07, 0.2)), resources.material(new THREE.MeshBasicMaterial({ color: '#707969' })), 60); group.add(sleepers);
    const traveller = person(resources, window, 3.4, -3, 0.2, 1.25, '#333e31');
    const journey = resources.label('1924 · 北上｜海路与铁路的抽象旅途', 8, '#a9b4a3'); journey.position.set(0, 2.15, -1); window.add(journey);
    const dummy = new THREE.Object3D();
    start.set(0, 1.6, 16); mid.set(0.2, 0.4, 14); end.set(0.3, 0.3, 13); focus.set(0, -0.2, -2);
    animate = (p, t) => { const train = smooth((p - 0.43) / 0.25); room.visible = p < 0.7; room.position.z = -train * 18; window.visible = p > 0.42; window.position.z = -5 + train * 9; youths.position.z = -2 + p * 6; youths.visible = p < 0.65; tracks.forEach(track => { track.visible = p > 0.45; }); sleepers.visible = p > 0.45; traveller.scale.x = 1.25 * Math.max(0.1, 1 - smooth((p - 0.8) / 0.2) * 0.75); photo.material.uniforms.uReveal.value = smooth(p * 4); photo.material.uniforms.uTime.value = t; for (let i = 0; i < 60; i++) { dummy.position.set(0, -3, 6 - ((i * 1.4 + t * 6) % 84)); dummy.updateMatrix(); sleepers.setMatrixAt(i, dummy.matrix); } sleepers.instanceMatrix.needsUpdate = true; };
  } else if (index === 14) {
    const quote1 = resources.label('现在革命尚未成功。', mobile ? 8.7 : 10, '#e4e5da'); quote1.position.set(0, 0.5, 0); group.add(quote1);
    const quote2 = resources.label('继续努力，以求贯彻。', mobile ? 8.2 : 9, '#c1c7b8'); quote2.position.set(0, -1.3, 0); group.add(quote2);
    const portraits = new THREE.Group(); group.add(portraits);
    const files: [string, number, number][] = [['sun-portrait.jpg', 2.8, 3.8], ['sun-provisional-president.jpg', 2.4, 4.2], ['tongmenghui.jpg', 5, 2.2]];
    const photos = files.map(([file, w, h], i) => { const photo = photograph(resources, portraits, file, [(i - 1) * (mobile ? 3 : 4.4), 0.3, -1 - i * 0.5], w * (mobile ? 0.88 : 1), h * (mobile ? 0.88 : 1)); photo.rotation.y = (1 - i) * 0.14; return photo; });
    const date = resources.label('12 MARCH 1925 · BEIJING', 6, '#aab4a1'); date.position.set(0, -2.5, 1); group.add(date);
    start.set(0, 0.6, 18); mid.set(0, 0.5, 16); end.set(0, 0, 14.5);
    animate = (p, t) => { quote1.visible = p < 0.5; quote2.visible = p > 0.2 && p < 0.53; portraits.visible = p > 0.48 && p < 0.97; date.visible = p > 0.54 && p < 0.97; photos.forEach((photo, i) => { photo.material.uniforms.uTime.value = t; photo.material.uniforms.uReveal.value = smooth((p - 0.48 - i * 0.05) / 0.14) * (1 - smooth((p - 0.80 - i * 0.035) / 0.15)); }); };
  } else {
    const ink = resources.texture('assets/archive/tianxia-mask.png');
    const distanceField = resources.texture('assets/archive/tianxia-sdf.png', true);
    const calligraphy = resources.plane(ink, 12.2, 3.195, 'ink', distanceField); calligraphy.position.set(0, 0.55, 0); calligraphy.material.uniforms.uTone.value.set('#edece1'); calligraphy.material.uniforms.uInkOnly.value = 1; calligraphy.material.uniforms.bleed.value = 0; group.add(calligraphy);
    const people = crowd(resources, mobile ? 68 : 142, 24, '#839185'); people.instanceMatrix.setUsage(THREE.DynamicDrawUsage); people.frustumCulled = false; group.add(people);
    const walkers = Array.from({ length: people.count }, (_, i) => ({
      side: i % 2 ? 1 : -1, x: 3.7 + noise(i + 160) * 7.5,
      z: -4.5 + noise(i + 170) * 3.6, scale: 0.46 + noise(i + 180) * 0.36,
      direction: noise(i + 190) > 0.5 ? 1 : -1, speed: 0.08 + noise(i + 200) * 0.11,
      phase: noise(i + 210) * Math.PI * 2,
    }));
    const walker = new THREE.Object3D();
    const mirror = new Reflector(resources.geometry(new THREE.PlaneGeometry(10, 7)), { color: '#202820', textureWidth: mobile ? 384 : 768, textureHeight: mobile ? 384 : 768, clipBias: 0.004 }); mirror.position.set(0, 0.5, -6); group.add(mirror);
    const mirrorFrame = frame(resources, group, new THREE.Vector3(0, 0.5, -5.95), 10.15, 7.15, '#4b5749');
    const viewer = person(resources, group, 0, -3, -2, 0.82, '#8b978c');
    const years = resources.label('1894　1905　1911　1912　1925', 8.5, '#b6bba9'); years.position.set(0, 1.6, -4); group.add(years);
    const question = new THREE.Group(); question.position.set(0, 0.75, -5.72); group.add(question);
    const readingField = new THREE.Mesh(resources.geometry(new THREE.PlaneGeometry(8.5, 2.55)), resources.material(new THREE.MeshBasicMaterial({ color: '#0b110c', transparent: true, opacity: 0.94, depthWrite: false, toneMapped: false })));
    readingField.position.z = -0.09; question.add(readingField);
    const questionZh = resources.label('历史已经过去。问题没有。', 7.6, '#e3e8da'); questionZh.position.y = 0.48; question.add(questionZh);
    const questionEn = resources.label('HISTORY HAS PASSED.', 4.8, '#c1cebf'); questionEn.position.y = -0.27; question.add(questionEn);
    const questionEn2 = resources.label('THE QUESTION HAS NOT.', 5.5, '#c1cebf'); questionEn2.position.y = -0.77; question.add(questionEn2);
    const floor = new Reflector(resources.geometry(new THREE.PlaneGeometry(55, 55)), { color: '#131a14', textureWidth: mobile ? 256 : 512, textureHeight: mobile ? 256 : 512, clipBias: 0.003 }); floor.rotation.x = -Math.PI / 2; floor.position.set(0, -3.02, -12); group.add(floor);
    // Spatial reading type is placed on the mirror surface, never reflected a second time.
    for (const reflector of [mirror, floor]) {
      const renderReflection = reflector.onBeforeRender;
      reflector.onBeforeRender = function (...args) {
        const showQuestion = question.visible, showYears = years.visible;
        question.visible = false; years.visible = false;
        renderReflection.apply(this, args);
        question.visible = showQuestion; years.visible = showYears;
      };
    }
    const final = new THREE.Group(); final.position.z = 6; group.add(final);
    const bg = new THREE.Mesh(resources.geometry(new THREE.PlaneGeometry(60, 40)), resources.material(new THREE.MeshBasicMaterial({ color: '#ffffff', depthWrite: true, toneMapped: false, fog: false }))); bg.position.z = -0.1; final.add(bg);
    const original = resources.plane(ink, 7.6, 1.99, 'ink', distanceField); original.material.uniforms.uTone.value.set('#151b14'); original.material.uniforms.uInkOnly.value = 1; original.material.uniforms.bleed.value = 0; original.material.uniforms.uSdfRelief.value = 0.35; original.position.set(0, 1.2, 0); final.add(original);
    const subtitles = [['THE WORLD BELONGS TO ALL', -0.3, 7.5], ['1866 — 1925  /  SUN YAT-SEN', -1.35, 4.7], ['为革命的一生。超越一生的理想。', -2.05, 6]] as const;
    subtitles.forEach(([text, y, w]) => { const label = resources.label(text, w, '#354130'); label.position.set(0, y, 0.1); final.add(label); });
    start.set(0, 0.8, 19); mid.set(0, 0.3, 13); end.set(0, 0.2, 19.5); focus.set(0, 0, 0);
    animate = (p, t) => {
      calligraphy.material.uniforms.uTime.value = t;
      calligraphy.visible = p < 0.48; calligraphy.scale.setScalar(1 + smooth((p - 0.33) / 0.16) * 3.5);
      people.visible = p > 0.34 && p < 0.86;
      const seconds = (p - 0.34) * 30;
      walkers.forEach((person, i) => {
        const stride = seconds * person.speed * person.direction;
        const x = 3.7 + ((person.x - 3.7 + stride + 15) % 7.5);
        walker.position.set(person.side * x, -3 + Math.sin(seconds * 2.9 + person.phase) * 0.018, person.z + Math.sin(seconds * 0.18 + person.phase) * 0.42);
        walker.scale.setScalar(person.scale);
        walker.rotation.set(0, person.direction * (0.18 + noise(i + 240) * 0.26), Math.sin(seconds * 2.9 + person.phase) * 0.025);
        walker.updateMatrix(); people.setMatrixAt(i, walker.matrix);
      });
      people.instanceMatrix.needsUpdate = true;
      (people.material as THREE.Material).userData.baseOpacity = 0.74 - smooth((p - 0.61) / 0.10) * 0.28;
      mirror.visible = p > 0.48 && p < 0.86; mirrorFrame.visible = mirror.visible; viewer.visible = p > 0.55 && p < 0.86; years.visible = p > 0.51 && p < 0.63; question.visible = p > 0.64 && p < 0.86;
      floor.visible = p > 0.34 && p < 0.86; final.visible = p > 0.86;
      const fieldImage = distanceField.image as { width?: number; height?: number } | undefined;
      if (fieldImage?.width && fieldImage.height) {
        calligraphy.material.uniforms.uSdfTexelSize.value.set(1 / fieldImage.width, 1 / fieldImage.height);
        original.material.uniforms.uSdfTexelSize.value.copy(calligraphy.material.uniforms.uSdfTexelSize.value);
      }
      original.material.uniforms.uTime.value = t; original.material.uniforms.uReveal.value = smooth((p - 0.86) / 0.04);
    };
    dispose = () => { mirror.getRenderTarget().dispose(); floor.getRenderTarget().dispose(); };
  }
  const camera = new THREE.CatmullRomCurve3([start, mid, end]);
  return { group, camera, focus, update: animate, dispose, document: readableDocument };
}

export function opacityWorld(world: World, opacity: number): void {
  world.group.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.material) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of list) {
      if (material instanceof THREE.ShaderMaterial && material.uniforms.uOpacity) material.uniforms.uOpacity.value = opacity;
      else if (!(object instanceof Reflector)) {
        if (material.userData.baseOpacity === undefined) material.userData.baseOpacity = material.opacity;
        material.transparent = true; material.opacity = material.userData.baseOpacity * opacity;
      }
    }
  });
}
