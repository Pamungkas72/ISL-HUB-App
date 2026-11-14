// ===========================================================
// LOGIN DESKTOP — portal pelabuhan.
// Foto pelabuhan 2,5D (js/portal-parallax.js, WebGL depth-parallax) menjadi latar di desktop dan HP.
// Desktop (>= 761 px): tiap kartu modul membuka pop-up login modulnya (ISL HUB memakai form login js/login.js; modul lain belum aktif).
// HP: form tampil langsung di kartu bawah; latar bergerak mengikuti kemiringan HP atau sentuhan; chip modul di atas form.
// ===========================================================
const desktop = matchMedia("(min-width: 761px)");
const hp = matchMedia("(max-width: 760px)");
const portal = document.getElementById("portal");
const sisi = document.querySelector(".login-form-side");
const tutupBtn = document.getElementById("login-tutup");

if (portal && sisi) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let pemicu = null, tierAktif = null, parallax = null;
  const info = document.getElementById("modul-info");
  const tutupPintu = () => { document.querySelectorAll(".tier.buka").forEach((t) => t.classList.remove("buka")); tierAktif = null; };
  const adaPopup = () => document.body.classList.contains("form-buka") || document.body.classList.contains("info-buka");
  // Saat pop-up terbuka, animasi latar dijeda (hemat tenaga dan tidak mengganggu mengetik).
  const sinkronLatar = () => { if (!parallax) return; if (adaPopup()) parallax.jeda(); else parallax.lanjut(); };

  const bukaForm = (dari) => {
    pemicu = dari || document.activeElement;
    document.body.classList.add("form-buka");
    sisi.removeAttribute("inert");
    sinkronLatar();
    setTimeout(() => {
      const wadah = sisi.querySelector(".login-form-wrap");
      wadah.setAttribute("role", "dialog"); wadah.setAttribute("aria-modal", "true"); wadah.setAttribute("aria-labelledby", "login-judul");
      const pertama = sisi.querySelector("form:not(.hidden) input"); if (pertama) pertama.focus();
    }, reduce ? 0 : 160);
  };
  const tutupForm = () => {
    document.body.classList.remove("form-buka");
    if (desktop.matches) sisi.setAttribute("inert", "");
    tutupPintu(); sinkronLatar();
    if (pemicu && pemicu.focus) pemicu.focus();
  };
  const bukaInfo = (nama, dari) => {
    pemicu = dari || document.activeElement;
    document.getElementById("info-nama").textContent = nama;
    document.body.classList.add("info-buka"); info.removeAttribute("inert"); sinkronLatar();
    setTimeout(() => document.getElementById("info-ok").focus(), reduce ? 0 : 160);
  };
  const tutupInfo = () => {
    document.body.classList.remove("info-buka"); info.setAttribute("inert", ""); tutupPintu(); sinkronLatar();
    if (pemicu && pemicu.focus) pemicu.focus();
  };
  // pilih modul: pintu kontainer pada kartu terbuka dulu, baru pop-up muncul
  const pilih = (t) => {
    if (tierAktif || adaPopup()) return;
    tierAktif = t; t.classList.add("buka");
    setTimeout(() => { if (t.dataset.aktif === "1") bukaForm(t); else bukaInfo(t.dataset.nama, t); }, reduce ? 0 : 650);
  };
  const atur = () => { if (desktop.matches && !document.body.classList.contains("form-buka")) sisi.setAttribute("inert", ""); else sisi.removeAttribute("inert"); };
  atur(); desktop.addEventListener("change", () => { if (!desktop.matches) document.body.classList.remove("form-buka"); atur(); });

  document.querySelectorAll(".portal-modul .tier").forEach((t) => t.addEventListener("click", (e) => { e.preventDefault(); pilih(t); }));

  // foto dan WebGL hanya dimuat di desktop
  let dimuat = false;
  const muatLatar = async () => {
    if (dimuat) return;
    dimuat = true;
    const kanvas = document.getElementById("portal-kanvas");
    try {
      const { mulaiParallax } = await import("./portal-parallax.js");
      const ponsel = hp.matches;
      // desktop: adegan hidup (awan, laut, truk melaju) di atas pelat foto tanpa truk; HP dan "kurangi gerak" memakai foto biasa
      const hidup = !ponsel && !reduce;
      const P = "assets/portal/";
      parallax = await mulaiParallax(kanvas, { foto: P + (hidup ? "hidup-pelat.jpg" : "foto-hd.jpg"), depth: P + (hidup ? "hidup-depth.png" : "depth-hd.png"), kurangiGerak: reduce,
        ringan: ponsel, fokus: ponsel ? 0.42 : 0.5, amp: ponsel ? 0.02 : 0.035, giro: ponsel,
        hidup: hidup ? { topeng: P + "hidup-topeng.png", truk: P + "hidup-truk.png" } : null });
    } catch (err) {
      // tanpa WebGL: foto diam sebagai latar biasa
      console.warn("Latar WebGL tidak tersedia, memakai foto diam:", err && err.message);
      portal.style.background = "#0b1a30 url(assets/portal/foto-hd.jpg) center / cover no-repeat";
      kanvas.style.display = "none";
    }
    portal.classList.add("siap");
    if (location.search.includes("uji-portal")) window.__portalParallax = parallax; // hanya untuk pengujian/rekaman
  };
  muatLatar();

  // HP: chip modul. ISL HUB = form di bawah; modul lain menampilkan keterangan singkat.
  const mobInfo = document.getElementById("mob-info"); let mobTimer = 0;
  document.querySelectorAll(".mob-chip").forEach((c) => c.addEventListener("click", () => {
    if (c.dataset.aktif === "1") { const e1 = document.getElementById("email"), e2 = document.getElementById("df-nama"); const f = [e1, e2].find((x) => x && x.offsetParent); if (f) f.focus(); return; }
    mobInfo.textContent = c.dataset.nama + " belum aktif. Login-nya muncul di sini saat modul dirilis.";
    mobInfo.classList.add("on"); clearTimeout(mobTimer); mobTimer = setTimeout(() => mobInfo.classList.remove("on"), 3200);
  }));

  document.getElementById("info-tutup")?.addEventListener("click", tutupInfo);
  document.getElementById("info-ok")?.addEventListener("click", tutupInfo);
  info?.addEventListener("click", (e) => { if (e.target === info) tutupInfo(); });

  document.getElementById("portal-masuk")?.addEventListener("click", (e) => { const t = document.querySelector(".tier[data-modul=\"isl\"]"); if (t) pilih(t); else bukaForm(e.currentTarget); });
  tutupBtn?.addEventListener("click", tutupForm);
  sisi.addEventListener("click", (e) => { if (e.target === sisi) tutupForm(); });
  document.addEventListener("keydown", (e) => {
    if (document.body.classList.contains("info-buka") && e.key === "Escape") { tutupInfo(); return; }
    if (!document.body.classList.contains("form-buka") || !desktop.matches) return;
    if (e.key === "Escape") { tutupForm(); return; }
    if (e.key === "Tab") { // fokus tetap di dalam pop-up
      const f = [...sisi.querySelectorAll("a[href], button, input, select, textarea")].filter((x) => x.offsetParent !== null && !x.disabled);
      if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
  });
  if (location.hash === "#masuk" && desktop.matches) { const t = document.querySelector(".tier[data-modul=\"isl\"]"); if (t) setTimeout(() => pilih(t), 400); }
}
