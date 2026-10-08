import * as THREE from 'three';

/** Shared, GLSL 1 compatible noise. Keeping the octaves bounded matters on phones. */
const noiseGLSL = /* glsl */ `
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise21(vec2 p) {
    vec2 cell = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(cell);
    float b = hash21(cell + vec2(1.0, 0.0));
    float c = hash21(cell + vec2(0.0, 1.0));
    float d = hash21(cell + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float paperNoise(vec2 p) {
    float value = 0.0;
    float weight = 0.5;
    mat2 turn = mat2(0.80, -0.60, 0.60, 0.80);
    for (int octave = 0; octave < 4; octave++) {
      value += noise21(p) * weight;
      p = turn * p * 2.02 + vec2(17.1, 9.2);
      weight *= 0.5;
    }
    return value;
  }
`;

const paperVertex = /* glsl */ `
  uniform float uTime;
  uniform float uBurn;
  uniform sampler2D uDistanceField;
  uniform float uSdfRelief;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 p = position;
    // The centre stays relatively still; the free edges breathe like suspended paper.
    vec2 centred = uv - 0.5;
    float freeEdge = smoothstep(0.12, 0.52, length(centred));
    float ripple = sin(uv.x * 10.0 + uTime * 0.34)
                 * sin(uv.y * 7.0 - uTime * 0.23);
    float curl = sin(uv.y * 16.0 + uTime * 0.85) * uBurn;
    p.z += freeEdge * (ripple * 0.025 + curl * 0.038);
    // The field is derived from the original ink: its interior rises very gently.
    if (uSdfRelief > 0.001) {
      float distance = texture2D(uDistanceField, uv).r;
      p.z += smoothstep(0.5, 0.82, distance) * uSdfRelief * 0.045;
    }
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const paperFragment = /* glsl */ `
  uniform sampler2D uTexture;
  uniform sampler2D uDistanceField;
  uniform vec2 uSdfTexelSize;
  uniform float uSdfRelief;
  uniform float uTime;
  uniform float uReveal;
  uniform float uBurn;
  uniform float uOpacity;
  uniform vec3 uTone;
  uniform float uInkOnly;
  uniform vec2 uTexelSize;
  uniform float bleed;
  uniform float dryness;
  uniform float edgeNoise;
  uniform float paperFiber;
  uniform float inkDensity;
  varying vec2 vUv;

  ${noiseGLSL}

  void main() {
    vec4 source = texture2D(uTexture, vUv);
    float reveal = clamp(uReveal, 0.0, 1.0);
    float burn = clamp(uBurn, 0.0, 1.0);
    float fibres = noise21(vUv * vec2(180.0, 9.0));
    float paper = paperNoise(vUv * vec2(11.0, 17.0));
    float fineGrain = hash21(floor(vUv * vec2(1400.0, 1000.0))) - 0.5;
    float inkOnly = clamp(uInkOnly, 0.0, 1.0);
    float diffusion = clamp(bleed, 0.0, 1.0);
    float dry = clamp(dryness, 0.0, 1.0);
    float fibreAmount = clamp(paperFiber, 0.0, 1.0);
    float density = clamp(inkDensity, 0.0, 1.2);
    float edgeVariation = 0.60 + clamp(edgeNoise, 0.0, 1.0) * 0.85;
    float alphaShape = source.a;

    #if PAPER_KIND != 2
      // A transparent archival ink mask can take any pigment colour without losing its shape.
      // Texel-sized diffusion softens the actual extracted edges rather than inventing glyphs.
      if (inkOnly > 0.001 && diffusion > 0.001) {
        vec2 radius = uTexelSize * (0.55 + diffusion * 1.85)
                    * (0.84 + fibres * 0.32);
        float spread = texture2D(uTexture, vUv + vec2(radius.x, 0.0)).a;
        spread = max(spread, texture2D(uTexture, vUv - vec2(radius.x, 0.0)).a);
        spread = max(spread, texture2D(uTexture, vUv + vec2(0.0, radius.y)).a);
        spread = max(spread, texture2D(uTexture, vUv - vec2(0.0, radius.y)).a);
        alphaShape = mix(source.a, max(source.a, spread * 0.64), diffusion * inkOnly);
      }
    #endif

    // An irregular development front, with exact empty/full endpoints.
    float revealField = vUv.y * 0.80 + (paper * 0.17 + fibres * 0.035) * edgeVariation;
    float revealFront = mix(-0.12, 1.12, reveal);
    float revealed = 1.0 - smoothstep(revealFront - 0.028, revealFront + 0.028, revealField);
    revealed *= smoothstep(0.0, 0.045, reveal);

    vec3 colour;
    #if PAPER_KIND == 2
      // Develop the actual photograph's silver values; its subject is never replaced.
      float luminance = dot(source.rgb, vec3(0.2126, 0.7152, 0.0722));
      float development = smoothstep(0.06, 0.95, reveal);
      float silver = pow(max(luminance, 0.0001), mix(3.0, 0.92, development));
      float silverGrain = fineGrain * (0.018 + 0.020 * (1.0 - silver));
      silver = clamp(silver + silverGrain, 0.0, 1.0);
      colour = mix(vec3(0.010, 0.012, 0.011), uTone, silver);
      // A darkroom emergence is less directional than a paper/ink reconstruction.
      revealed = mix(revealed, smoothstep(0.015, 0.30, reveal), 0.72);
      revealed *= smoothstep(0.0, 0.045, reveal);
    #else
      // Keep the original map, handwriting, or typesetting, with a quiet paper tint.
      vec3 originalInk = source.rgb * uTone * (0.85 + 0.15 * density);
      colour = mix(originalInk, uTone, inkOnly);
      float paperTexture = (paper - 0.45) * 0.075 + (fibres - 0.5) * 0.042;
      colour *= 1.0 + paperTexture * fibreAmount;
      colour += vec3(fineGrain * (0.004 + dry * 0.010)) * (1.0 - inkOnly);
      // Dry pigment leaves sparse, quiet pores along the real calligraphy strokes.
      float dryPores = smoothstep(0.40, 0.50, fineGrain) * dry * 0.24;
      alphaShape *= mix(1.0, clamp(density, 0.0, 1.0) * (1.0 - dryPores), inkOnly);
      if (uSdfRelief > 0.001 && inkOnly > 0.001) {
        // Linear signed distance: 0.5 is the actual archival stroke boundary.
        float distance = texture2D(uDistanceField, vUv).r;
        float left = texture2D(uDistanceField, vUv - vec2(uSdfTexelSize.x, 0.0)).r;
        float right = texture2D(uDistanceField, vUv + vec2(uSdfTexelSize.x, 0.0)).r;
        float down = texture2D(uDistanceField, vUv - vec2(0.0, uSdfTexelSize.y)).r;
        float up = texture2D(uDistanceField, vUv + vec2(0.0, uSdfTexelSize.y)).r;
        vec3 normal = normalize(vec3((left - right) * 8.0, (down - up) * 8.0, 1.0));
        float grazing = dot(normal, normalize(vec3(-0.45, 0.6, 0.8)));
        float edge = 1.0 - smoothstep(0.025, 0.16, abs(distance - 0.5));
        colour *= 1.0 + (grazing - 0.73) * edge * uSdfRelief * 0.24;
        // Relief never adds opacity outside the extracted alpha mask.
        alphaShape = min(alphaShape, source.a);
      }
    #endif

    vec2 edge = min(vUv, vec2(1.0) - vUv);
    float edgeDistance = min(edge.x, edge.y) * 2.0;
    float burnField = edgeDistance + ((paper - 0.45) * 0.115
                    + (fibres - 0.5) * 0.030) * edgeVariation;
    float burnFront = burn * 1.26 - 0.11;
    float burnActive = smoothstep(0.002, 0.055, burn);
    float remaining = smoothstep(burnFront - 0.012, burnFront + 0.018, burnField);
    remaining = mix(1.0, remaining, burnActive);

    float distanceToFire = burnField - burnFront;
    float charred = (1.0 - smoothstep(0.0, 0.115, abs(distanceToFire))) * burnActive;
    float hotEdge = (1.0 - smoothstep(0.0, 0.026, abs(distanceToFire))) * burnActive;
    float emberPulse = 0.68 + 0.32 * noise21(vUv * 45.0 + vec2(uTime * 0.13, -uTime * 0.17));
    float complete = 1.0 - smoothstep(0.94, 1.0, burn);
    charred *= complete;
    hotEdge *= complete * emberPulse;

    #if PAPER_KIND == 1
      colour = mix(colour, vec3(0.025, 0.021, 0.015), charred * 0.94);
      colour += vec3(0.93, 0.24, 0.018) * hotEdge * 0.86;
    #else
      colour = mix(colour, vec3(0.024, 0.021, 0.016), charred * 0.90);
      colour += vec3(0.60, 0.17, 0.015) * hotEdge * 0.64;
    #endif

    // Fibrous grey islands briefly survive behind the edge, then become transparent ash.
    float ashIslands = smoothstep(0.60, 0.79,
      noise21(vUv * vec2(110.0, 34.0) + vec2(0.0, uTime * 0.06)));
    float ashTrail = smoothstep(burnFront - 0.13, burnFront - 0.055, burnField)
                   * (1.0 - remaining) * ashIslands * 0.22 * burnActive * complete;
    colour = mix(colour, vec3(0.20, 0.18, 0.14), ashTrail * 1.8);
    float alpha = alphaShape * revealed * clamp(uOpacity, 0.0, 1.0)
                * clamp(remaining + ashTrail, 0.0, 1.0);
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(max(colour, vec3(0.0)), alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Archival texture on a physical sheet. A subdivided plane also receives edge flutter. */
export function paperMaterial(
  texture: THREE.Texture,
  kind: 'ink' | 'burn' | 'photo' = 'ink',
  distanceField?: THREE.Texture,
): THREE.ShaderMaterial {
  const textureImage = texture.image as { width?: number; height?: number } | undefined;
  const textureWidth = Math.max(1, textureImage?.width || 1024);
  const textureHeight = Math.max(1, textureImage?.height || 1024);
  return new THREE.ShaderMaterial({
    name: `ArchivePaper:${kind}`,
    defines: { PAPER_KIND: kind === 'photo' ? 2 : kind === 'burn' ? 1 : 0 },
    uniforms: {
      uTime: { value: 0 },
      uReveal: { value: 1 },
      uBurn: { value: 0 },
      uOpacity: { value: 1 },
      uTone: { value: new THREE.Color(kind === 'photo' ? '#eee9db' : '#f4e8d0') },
      uTexture: { value: texture },
      uDistanceField: { value: distanceField ?? texture },
      uSdfRelief: { value: distanceField ? 0.6 : 0 },
      uSdfTexelSize: { value: new THREE.Vector2(1 / textureWidth, 1 / textureHeight) },
      uInkOnly: { value: 0 },
      uTexelSize: { value: new THREE.Vector2(1 / textureWidth, 1 / textureHeight) },
      bleed: { value: 0.28 },
      dryness: { value: 0.62 },
      edgeNoise: { value: 0.46 },
      paperFiber: { value: 0.58 },
      inkDensity: { value: 0.94 },
    },
    vertexShader: paperVertex,
    fragmentShader: paperFragment,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  });
}

const seaVertex = /* glsl */ `
  uniform float uTime;
  varying vec2 vSea;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  void main() {
    vSea = position.xy;
    float a = position.x * 0.34 + position.y * 0.19 + uTime * 0.31;
    float b = position.x * -0.22 + position.y * 0.51 - uTime * 0.22;
    float c = position.x * 0.91 + position.y * 0.37 + uTime * 0.47;
    float wave = sin(a) * 0.13 + sin(b) * 0.075 + sin(c) * 0.024;
    float slopeX = cos(a) * 0.0442 - cos(b) * 0.0165 + cos(c) * 0.02184;
    float slopeY = cos(a) * 0.0247 + cos(b) * 0.03825 + cos(c) * 0.00888;
    vec3 p = position + vec3(0.0, 0.0, wave);
    vec4 worldPosition = modelMatrix * vec4(p, 1.0);
    vWorldPosition = worldPosition.xyz;
    vec3 viewNormal = normalize(normalMatrix * vec3(-slopeX, -slopeY, 1.0));
    // Undo only the camera rotation; normalMatrix also handles nonuniform mesh scales.
    vWorldNormal = normalize(vec3(
      dot(viewMatrix[0].xyz, viewNormal),
      dot(viewMatrix[1].xyz, viewNormal),
      dot(viewMatrix[2].xyz, viewNormal)
    ));
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const seaFragment = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uTone;
  varying vec2 vSea;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  ${noiseGLSL}

  void main() {
    vec3 normal = normalize(vWorldNormal);
    if (!gl_FrontFacing) normal = -normal;
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float facing = clamp(dot(normal, viewDirection), 0.0, 1.0);
    float fresnel = 0.08 + pow(1.0 - facing, 4.0) * 0.72;
    vec3 reflection = reflect(-viewDirection, normal);

    // A small, warm, overcast sky reflected in near-black water.
    float skyHeight = smoothstep(-0.18, 0.66, reflection.y);
    float horizon = exp(-abs(reflection.y - 0.015) * 10.0);
    vec3 sky = mix(vec3(0.013, 0.014, 0.013), vec3(0.075, 0.071, 0.057), skyHeight);
    sky += vec3(0.085, 0.070, 0.043) * horizon;

    float ripple = sin(vSea.y * 3.1 + sin(vSea.x * 0.62 + uTime * 0.21)
                     + uTime * 0.31);
    float narrowRidges = pow(clamp(ripple * 0.5 + 0.5, 0.0, 1.0), 18.0);
    float broadReflection = exp(-pow((vSea.x + sin(vSea.y * 0.11) * 2.0) * 0.045, 2.0));
    float brokenLight = noise21(vSea * vec2(0.72, 2.6) + vec2(uTime * 0.03, -uTime * 0.12));
    float reflectedLight = narrowRidges * broadReflection * brokenLight * (0.014 + fresnel * 0.080);
    vec3 colour = uTone * (0.78 + brokenLight * 0.25) + sky * fresnel;
    colour += vec3(0.90, 0.78, 0.55) * reflectedLight;
    gl_FragColor = vec4(colour, clamp(uOpacity, 0.0, 1.0));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Use a subdivided XY plane, rotated -PI / 2 about X, for a horizontal ocean. */
export function seaMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: 'BlackArchivalSea',
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uTone: { value: new THREE.Color('#080a09') },
    },
    vertexShader: seaVertex,
    fragmentShader: seaFragment,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  });
}

const particleVertex = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  uniform float uSize;
  attribute vec3 aTarget;
  attribute float aSeed;
  varying float vSeed;
  varying float vProgress;

  void main() {
    float seed = fract(aSeed);
    float progress = smoothstep(0.0, 1.0, clamp(uProgress, 0.0, 1.0));
    float passage = sin(progress * 3.14159265359);
    vec3 p = mix(position, aTarget, progress);
    float phase = seed * 6.28318530718;
    // Leave and arrive precisely on the two point clouds; drift lives between them.
    p += vec3(
      sin(phase + uTime * 0.18) * (0.16 + seed * 0.24),
      cos(phase * 1.73 + uTime * 0.14) * 0.28,
      sin(phase * 2.31 - uTime * 0.12) * 0.48
    ) * passage;
    vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = clamp(uSize * (35.0 / max(1.0, -viewPosition.z))
                       * (0.68 + seed * 0.55), 0.75, 4.5);
    vSeed = seed;
    vProgress = progress;
  }
`;

const particleFragment = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  varying float vSeed;
  varying float vProgress;

  void main() {
    float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
    float roundEdge = 1.0 - smoothstep(0.63, 1.0, radius);
    float pigment = exp(-radius * radius * 2.4) * roundEdge;
    float breathe = 0.91 + sin(uTime * 0.45 + vSeed * 21.0) * 0.09;
    float alpha = pigment * clamp(uOpacity, 0.0, 1.0) * breathe;
    if (alpha < 0.004) discard;
    float ivory = clamp(smoothstep(0.22, 0.90, vProgress)
                      + smoothstep(0.87, 0.99, vSeed) * 0.36, 0.0, 1.0);
    vec3 ink = vec3(0.023, 0.025, 0.022);
    vec3 lightPaper = vec3(0.76, 0.69, 0.53);
    vec3 colour = mix(ink, lightPaper, ivory);
    colour *= 0.82 + vSeed * 0.18;
    gl_FragColor = vec4(colour, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Geometry must supply position, aTarget (vec3) and aSeed (float in [0, 1)). */
export function particleMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: 'CalligraphyToPeople',
    uniforms: {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uOpacity: { value: 1 },
      uSize: { value: 1.9 },
    },
    vertexShader: particleVertex,
    fragmentShader: particleFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
}

const transitionVertex = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    // A PlaneGeometry(2, 2) is a full screen overlay, independent of the film camera.
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const transitionFragment = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  uniform float uOpacity;
  varying vec2 vUv;

  ${noiseGLSL}

  void main() {
    float progress = clamp(uProgress, 0.0, 1.0);
    float envelope = sin(progress * 3.14159265359);
    float wash = paperNoise(vUv * vec2(6.0, 9.0) + vec2(uTime * 0.013, 0.0));
    float fibres = noise21(vUv * vec2(280.0, 15.0));
    float field = vUv.x * 0.70 + vUv.y * 0.30 + (wash - 0.45) * 0.30;
    float front = mix(-0.28, 1.28, progress);
    float swept = 1.0 - smoothstep(front - 0.12, front + 0.12, field);
    float wetEdge = 1.0 - smoothstep(0.015, 0.11, abs(field - front));
    float inkDensity = clamp(swept * 0.34 + wetEdge * 0.28 + wash * 0.12, 0.0, 0.70);
    float alpha = inkDensity * envelope * clamp(uOpacity, 0.0, 1.0);
    if (alpha < 0.002) discard;
    vec3 charcoal = vec3(0.015, 0.016, 0.013);
    vec3 paper = vec3(0.19, 0.16, 0.105);
    vec3 colour = mix(charcoal, paper, fibres * 0.20 + wetEdge * 0.14);
    gl_FragColor = vec4(colour, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Progress 0/1 is clear; a short wash peaks between chapters. Default opacity is off. */
export function transitionMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: 'PaperInkPassage',
    uniforms: {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uOpacity: { value: 0 },
    },
    vertexShader: transitionVertex,
    fragmentShader: transitionFragment,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
}
