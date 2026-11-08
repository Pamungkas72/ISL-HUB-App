// ===========================================================
// PORTAL PARALLAX — foto pelabuhan 4096 px + peta kedalaman, dirender WebGL2.
// Shader menggeser tiap titik gambar sesuai kedalamannya mengikuti kursor (atau kemiringan HP): objek
// dekat bergerak lebih jauh, objek jauh lebih pelan. Scroll/roda (desktop) memberi efek "maju-mundur".
// Gerak diam otomatis supaya gambar tetap hidup. Dimuat di desktop dan HP.
// ===========================================================

const VS = `#version 300 es
void main(){
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
uniform sampler2D uImg;
uniform sampler2D uDepth;
uniform vec2  uRes;
uniform vec2  uImgSize;
uniform vec2  uCenter;
uniform vec2  uMouse;
uniform float uZoom;
uniform float uTime;
uniform float uStrength;
uniform float uDolly;
uniform float uMargin;
uniform float uGerak;
uniform float uButir;
out vec4 outColor;

// layar -> koordinat gambar (mode "cover", tanpa gepeng); uCenter menentukan bagian yang tampil
vec2 cover(vec2 p){
  float sa = uRes.x / uRes.y;
  float ia = uImgSize.x / uImgSize.y;
  vec2 s = sa > ia ? vec2(1.0, ia / sa) : vec2(sa / ia, 1.0);
  return (p - 0.5) * s + uCenter;
}

float h11(float n){ return fract(sin(n * 127.1) * 43758.5453); }

void main(){
  vec2 p = gl_FragCoord.xy / uRes;

  // gerak diam otomatis: kamera mengambang pelan saat tidak disentuh
  vec2 idle = uGerak * 0.12 * vec2(sin(uTime * 0.23), cos(uTime * 0.17));
  vec2 m = uMouse + idle;

  vec2 q  = (p - 0.5) * uMargin + 0.5;
  vec2 uv = cover(q);

  // cari titik sampel: objek dekat bergeser lebih jauh, dan membesar saat "maju"
  vec2 uv2 = uv;
  float d = 0.5;
  for (int i = 0; i < 5; i++){
    d = texture(uDepth, uv2).r;
    float s = 1.0 - uZoom * uDolly * d;
    uv2 = (uv - 0.5) * s + 0.5 + m * uStrength * (d - 0.5);
  }
  uv2 = clamp(uv2, 0.001, 0.999);

  vec3 col = texture(uImg, uv2).rgb;

  // kabut tipis di kejauhan untuk menambah kedalaman
  col = mix(col, vec3(0.64, 0.76, 0.92), (1.0 - d) * 0.07);

  // pantulan cahaya lembut mengikuti kursor
  float g = pow(max(0.0, 1.0 - length((p - 0.5) - m * 0.35) * 1.6), 3.0);
  col += vec3(1.0, 0.95, 0.85) * g * 0.05;

  // vignette ringan
  float v = smoothstep(1.15, 0.35, length(p - 0.5));
  col *= mix(0.82, 1.0, v);

  // butiran tipis (desktop saja)
  col += (h11(dot(gl_FragCoord.xy, vec2(1.0, 57.0)) + floor(uTime * 24.0)) - 0.5) * uButir;

  outColor = vec4(col, 1.0);
}`;

function buatShader(gl, tipe, sumber) {
  const s = gl.createShader(tipe);
  gl.shaderSource(s, sumber); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader gagal");
  return s;
}
function muatGambar(src) {
  return new Promise((ok, gagal) => { const i = new Image(); i.decoding = "async"; i.onload = () => ok(i); i.onerror = () => gagal(new Error("gagal memuat " + src)); i.src = src; });
}

export async function mulaiParallax(kanvas, { foto, depth, kurangiGerak = false, ringan = false, fokus = 0.5, amp = 0.035, giro = false, onSiap } = {}) {
  const gl = kanvas.getContext("webgl2", { antialias: false, alpha: false });
  if (!gl) throw new Error("WebGL2 tidak tersedia");
  const [imgFoto, imgDepth] = await Promise.all([muatGambar(foto), muatGambar(depth)]);

  const prog = gl.createProgram();
  gl.attachShader(prog, buatShader(gl, gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, buatShader(gl, gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || "program gagal");
  gl.useProgram(prog);
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);

  // tekstur: batas ukuran mengikuti perangkat (HP 4096 sudah cukup; desktop boleh penuh)
  const maks = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), ringan ? 4096 : 8192);
  const kecil = (img) => {
    const w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, maks / Math.max(w, h));
    if (k === 1) return img;
    const c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(h * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); return c;
  };
  const tekstur = (src, unit) => {
    const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const ext = gl.getExtension("EXT_texture_filter_anisotropic");
    if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  };
  const fotoKecil = kecil(imgFoto);
  tekstur(fotoKecil, 0);
  tekstur(kecil(imgDepth), 1);

  const U = (n) => gl.getUniformLocation(prog, n);
  gl.uniform1i(U("uImg"), 0); gl.uniform1i(U("uDepth"), 1);
  gl.uniform2f(U("uImgSize"), fotoKecil.width, fotoKecil.height);
  gl.uniform1f(U("uStrength"), amp);
  gl.uniform1f(U("uDolly"), 0.32);
  gl.uniform1f(U("uMargin"), 0.9);
  gl.uniform1f(U("uGerak"), kurangiGerak ? 0 : 1);
  gl.uniform1f(U("uButir"), ringan ? 0 : 0.012);
  const uRes = U("uRes"), uCenter = U("uCenter"), uMouse = U("uMouse"), uTime = U("uTime"), uZoom = U("uZoom");

  // pusat gambar yang tampil: di HP, geser sesuai "fokus" (0..1) tanpa keluar dari tepi foto
  const ukur = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(2, Math.round(kanvas.clientWidth * dpr)), h = Math.max(2, Math.round(kanvas.clientHeight * dpr));
    if (kanvas.width !== w || kanvas.height !== h) { kanvas.width = w; kanvas.height = h; }
    gl.viewport(0, 0, kanvas.width, kanvas.height); gl.uniform2f(uRes, kanvas.width, kanvas.height);
    const sa = kanvas.width / kanvas.height, ia = fotoKecil.width / fotoKecil.height;
    const sx = sa > ia ? 1 : sa / ia, sy = sa > ia ? ia / sa : 1;
    const cx = Math.min(1 - sx / 2, Math.max(sx / 2, fokus)), cy = 0.5;
    gl.uniform2f(uCenter, cx, cy);
  };

  let tx = 0, ty = 0, mx = 0, my = 0, tz = 0, cz = 0, terakhirGerak = -99, t0 = performance.now(), jalan = true, frameId = 0;
  const gambar = (now) => {
    const t = (now - t0) / 1000;
    ukur();
    const diam = t - terakhirGerak > 3;
    const otoX = Math.sin(t * 0.17) * 0.32, otoY = Math.cos(t * 0.12) * 0.18;
    const gx = kurangiGerak ? 0 : diam ? otoX : tx, gy = kurangiGerak ? 0 : diam ? otoY : ty;
    mx += (gx - mx) * 0.06; my += (gy - my) * 0.06; cz += (tz - cz) * 0.06;
    gl.uniform2f(uMouse, mx, my); gl.uniform1f(uZoom, cz); gl.uniform1f(uTime, kurangiGerak ? 3.0 : t);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const putar = (now) => { if (!jalan) return; gambar(now); frameId = requestAnimationFrame(putar); };
  const onMove = (e) => {
    tx = (e.clientX / window.innerWidth) * 2 - 1; ty = -((e.clientY / window.innerHeight) * 2 - 1);
    terakhirGerak = (performance.now() - t0) / 1000;
  };
  // scroll/roda: maju-mundur (desktop). Tidak dicegat di atas form agar form tetap bisa digulir.
  const onWheel = (e) => {
    if (e.target.closest && e.target.closest(".login-form-side, .mob-modul")) return;
    tz = Math.min(1, Math.max(0, tz + e.deltaY * -0.0006)); terakhirGerak = (performance.now() - t0) / 1000;
  };
  // HP: kemiringan perangkat menggeser pandangan (iOS meminta izin saat sentuhan pertama)
  const pasangGiro = () => window.addEventListener("deviceorientation", (e) => {
    if (e.gamma == null || e.beta == null) return;
    tx = Math.max(-1, Math.min(1, e.gamma / 34)); ty = Math.max(-1, Math.min(1, -(e.beta - 50) / 40));
    terakhirGerak = (performance.now() - t0) / 1000;
  }, { passive: true });

  if (!kurangiGerak) {
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    if (giro && typeof DeviceOrientationEvent !== "undefined") {
      if (typeof DeviceOrientationEvent.requestPermission === "function") {
        window.addEventListener("pointerup", () => { DeviceOrientationEvent.requestPermission().then((h) => { if (h === "granted") pasangGiro(); }).catch(() => {}); }, { once: true });
      } else pasangGiro();
    }
    document.addEventListener("visibilitychange", () => { if (document.hidden) { jalan = false; cancelAnimationFrame(frameId); } else if (!jalan) { jalan = true; frameId = requestAnimationFrame(putar); } });
    frameId = requestAnimationFrame(putar);
  } else {
    gambar(performance.now());
    window.addEventListener("resize", () => gambar(performance.now()));
  }
  kanvas.dataset.siap = "1";
  if (onSiap) onSiap();
  return {
    jeda() { jalan = false; cancelAnimationFrame(frameId); },
    lanjut() { if (!kurangiGerak && !jalan) { jalan = true; frameId = requestAnimationFrame(putar); } },
    atur(x, y) { tx = x; ty = y; terakhirGerak = (performance.now() - t0) / 1000; },
    // untuk pengujian/rekaman: gambar satu bingkai pada waktu t dan posisi kursor (x, y) tertentu
    gambarDi(t, x, y) { jalan = false; cancelAnimationFrame(frameId); ukur(); gl.uniform2f(uMouse, x, y); gl.uniform1f(uZoom, tz); gl.uniform1f(uTime, t); gl.drawArrays(gl.TRIANGLES, 0, 3); },
  };
}
