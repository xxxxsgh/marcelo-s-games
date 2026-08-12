/**
 * Passe unico que junta quatro efeitos que, separados, custariam quatro
 * leituras da tela inteira:
 *   1. motion blur RADIAL por velocidade, centrado em PRA ONDE voce vai
 *      (nao no centro da tela) — e o que da a sensacao de tunel na velocidade
 *   2. distorcao de lente (barril) do modo FPV
 *   3. aberracao cromatica so na borda
 *   4. correcao de cor (lift/gamma/gain simplificado) + vinheta
 */
export const GradeShader = {
  name: 'GradeShader',
  uniforms: {
    tDiffuse: { value: null },
    uBlurStrength: { value: 0.0 },   // 0..1
    uBlurCenter: { value: [0.5, 0.5] },
    uDistortion: { value: 0.0 },     // barril do FPV
    uChroma: { value: 0.0 },    // ver nota no fragment shader: fica desligada
    uVignette: { value: 0.28 },
    uSaturation: { value: 1.06 },
    uContrast: { value: 1.04 },
    uLift: { value: [0.004, 0.006, 0.012] },   // sombra levemente azulada
    uGain: { value: [1.02, 1.0, 0.985] },      // luz levemente quente
    uDamage: { value: 0.0 },         // artefato de camera danificada (Fase 6)
    uSignal: { value: 1.0 },         // 1 = sinal limpo, 0 = perdido (Fase 3)
    uTime: { value: 0.0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uBlurStrength;
    uniform vec2  uBlurCenter;
    uniform float uDistortion;
    uniform float uChroma;
    uniform float uVignette;
    uniform float uSaturation;
    uniform float uContrast;
    uniform vec3  uLift;
    uniform vec3  uGain;
    uniform float uDamage;
    uniform float uSignal;
    uniform float uTime;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    void main() {
      vec2 uv = vUv;

      // --- 1. distorcao de barril (lente FPV) ---
      if (uDistortion > 0.001) {
        vec2 c = uv - 0.5;
        float r2 = dot(c, c);
        uv = 0.5 + c * (1.0 + uDistortion * r2 * 1.6) / (1.0 + uDistortion * 0.4);
      }

      // --- perda de sinal: tearing horizontal + ruido ---
      if (uSignal < 0.999) {
        float loss = 1.0 - uSignal;
        float band = step(0.985 - loss * 0.5, hash(vec2(floor(uv.y * 90.0), floor(uTime * 12.0))));
        uv.x += band * loss * 0.06 * (hash(vec2(uTime, uv.y)) - 0.5);
      }

      vec4 color;

      // --- 2. motion blur radial na direcao do voo ---
      if (uBlurStrength > 0.002) {
        vec2 dir = uv - uBlurCenter;
        // Nao borra o centro: a mira tem que ficar nitida.
        float mask = smoothstep(0.05, 0.55, length(dir));
        vec2 step = dir * uBlurStrength * 0.14 * mask;
        vec3 acc = vec3(0.0);
        float total = 0.0;
        for (int i = 0; i < 8; i++) {
          float t = float(i) / 7.0;
          float w = 1.0 - t * 0.55;
          acc += texture2D(tDiffuse, uv - step * t).rgb * w;
          total += w;
        }
        color = vec4(acc / total, 1.0);
      } else {
        color = texture2D(tDiffuse, uv);
      }

      // --- 3. aberracao cromatica (DESLIGADA por padrao) ---
      // Este bloco re-amostra R e B da textura SEM borrao enquanto G vem do
      // caminho borrado. O tamanho do deslocamento e irrelevante: a simples
      // mistura de canal borrado com canal nitido ja pinta franja verde/
      // magenta em toda silhueta quando ha motion blur. Fazer certo custaria
      // borrar os tres canais (3x as amostras) por um efeito que nem estava
      // no escopo — entao uChroma nasce em 0. Ver DECISOES.md.
      float edge = dot(uv - 0.5, uv - 0.5);
      if (uChroma > 0.0005 && uBlurStrength < 0.02) {
        vec2 off = (uv - 0.5) * uChroma * edge * 0.9;
        color.r = texture2D(tDiffuse, uv + off).r;
        color.b = texture2D(tDiffuse, uv - off).b;
      }

      // --- camera danificada: bloco/ruido ---
      if (uDamage > 0.001) {
        vec2 blockUv = floor(uv * 64.0) / 64.0;
        float n = hash(blockUv + floor(uTime * 8.0));
        if (n < uDamage * 0.35) {
          color.rgb = mix(color.rgb, vec3(n), uDamage * 0.8);
        }
        color.rgb += (hash(uv * 900.0 + uTime) - 0.5) * uDamage * 0.18;
      }

      // --- 4. correcao de cor ---
      vec3 c = color.rgb;
      c = c * uGain + uLift;
      float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(lum), c, uSaturation);
      c = (c - 0.5) * uContrast + 0.5;

      // vinheta
      c *= 1.0 - uVignette * edge * 2.2;

      gl_FragColor = vec4(max(c, 0.0), color.a);
    }
  `,
};
