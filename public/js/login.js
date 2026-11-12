import { loginUser, daftarUser, mapAuthError, watchAuthState, kirimResetSandi } from "./auth.js";
import { catatAktif } from "./sesi.js";
import { WA_ADMIN_TAMPILAN, linkWaAdmin, pesanDaftarSales } from "./kontak-admin.js";

const form = document.getElementById("login-form");
const errorBox = document.getElementById("login-error");
const btnSubmit = document.getElementById("btn-submit");

// Kalau sudah login, langsung lempar ke dashboard.
let sedangDaftar = false; // selama mendaftar, jangan pindah halaman sebelum nama akun selesai disimpan
watchAuthState(
  () => { if (!sedangDaftar) window.location.href = "app.html#beranda"; },
  () => {},
  { tanpaGerbang: true }
);

const fd = document.getElementById("daftar-form"), tog = document.getElementById("tog-daftar");
// Teks daftar akun ("Daftar akun" tanpa kata sales, plus pilihan status) berlaku di desktop dan HP.
const TEKS_DAFTAR = "Daftar akun";
const TEKS_TOGGLE = "Belum punya akun? Daftar akun";
const TEKS_SUB = "Gunakan akun yang sudah terdaftar. Belum punya? Daftar akun.";
tog.textContent = TEKS_TOGGLE; document.getElementById("login-sub").textContent = TEKS_SUB;
let modeDaftar = false;
tog.addEventListener("click", (e) => {
  e.preventDefault(); modeDaftar = !modeDaftar;
  form.classList.toggle("hidden", modeDaftar); fd.classList.toggle("hidden", !modeDaftar); errorBox.classList.add("hidden");
  tog.textContent = modeDaftar ? "Sudah punya akun? Masuk" : TEKS_TOGGLE;
  document.getElementById("login-judul").textContent = modeDaftar ? TEKS_DAFTAR : "Masuk"; document.getElementById("login-sub").textContent = modeDaftar ? "Isi data di bawah. Master akan menyetujui akunmu sebelum bisa dipakai." : TEKS_SUB;
});
fd.addEventListener("submit", async (e) => {
  e.preventDefault(); errorBox.classList.add("hidden");
  const elPeran = document.getElementById("df-peran"), peran = elPeran ? (elPeran.value || "sales") : null, nama = document.getElementById("df-nama").value.trim(), email = document.getElementById("df-email").value.trim(), pass = document.getElementById("df-pass").value;
  const galat = (t) => { errorBox.textContent = t; errorBox.classList.remove("hidden"); };
  if (nama.length < 2) return galat("Isi nama lengkap.");
  if (!email) return galat("Isi email.");
  if (pass.length < 6) return galat("Kata sandi minimal 6 karakter.");
  const b = document.getElementById("df-submit"); b.disabled = true; b.textContent = "Mendaftar..."; sedangDaftar = true;
  try { if (peran) { try { sessionStorage.setItem("islhub-peran-diminta", ["admin", "cs", "sales"].includes(peran) ? peran : "sales"); } catch (_) {} } await daftarUser(nama, email, pass); popupSetelahDaftar({ nama, email, peran }); }
  catch (err) { sedangDaftar = false; galat(mapAuthError(err.code, "daftar")); b.disabled = false; b.textContent = "Daftar"; }
});

/* Lupa kata sandi: kirim tautan atur ulang ke email yang sudah diisi di form masuk. */
const lupaSandi = document.getElementById("lupa-sandi"), lupaInfo = document.getElementById("lupa-info");
lupaSandi.addEventListener("click", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  errorBox.classList.add("hidden"); lupaInfo.classList.add("hidden");
  if (!email) { errorBox.textContent = "Isi email dulu, lalu klik Lupa kata sandi."; errorBox.classList.remove("hidden"); return; }
  lupaSandi.textContent = "Mengirim...";
  try {
    await kirimResetSandi(email);
    lupaInfo.textContent = `Tautan untuk mengatur ulang kata sandi sudah dikirim ke ${email}. Cek kotak masuk dan folder spam.`;
    lupaInfo.classList.remove("hidden");
  } catch (err) {
    errorBox.textContent = err.code === "auth/user-not-found" ? "Email ini belum terdaftar." : mapAuthError(err.code);
    errorBox.classList.remove("hidden");
  } finally {
    lupaSandi.textContent = "Lupa kata sandi?";
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBox.classList.add("hidden");
  btnSubmit.disabled = true;
  btnSubmit.textContent = "Memproses...";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    await loginUser(email, password);
    catatAktif();
    try { sessionStorage.removeItem("islhub-tutup"); sessionStorage.removeItem("islhub-notif-cache"); sessionStorage.setItem("islhub-login", String(Date.now())); } catch (e) {}
    window.location.href = "app.html#beranda";
  } catch (err) {
    errorBox.textContent = mapAuthError(err.code);
    errorBox.classList.remove("hidden");
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Masuk";
  }
});

/* Pop-up setelah mendaftar: akun belum aktif, jadi arahkan ke admin lewat WhatsApp (nama dan email ikut terkirim). */
function popupSetelahDaftar(data) {
  const kotak = document.createElement("div");
  kotak.className = "ip-lapis"; kotak.setAttribute("role", "dialog"); kotak.setAttribute("aria-modal", "true"); kotak.setAttribute("aria-label", "Pendaftaran terkirim");
  const teks = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  kotak.innerHTML = `<div class="ip-kartu">
    <div class="ip-grip"></div>
    <div class="ip-head">
      <span class="ip-ikon ip-ikon--ok" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>
      <div class="ip-head-teks"><div class="ip-judul">Pendaftaran terkirim</div><div class="ip-sub">Akun ${teks(data.email)} menunggu persetujuan.</div></div>
    </div>
    <p class="ip-teks">Akun Anda belum aktif. Hubungi admin lewat WhatsApp supaya pendaftaran segera ditindaklanjuti.</p>
    <div class="ip-kotak">
      <div class="ip-kotak-label">Admin ISL HUB</div>
      <div class="ip-nomor">${teks(WA_ADMIN_TAMPILAN)}</div>
      <div class="ip-aksi">
        <a class="ip-btn ip-btn--wa" href="${linkWaAdmin(pesanDaftarSales(data))}" target="_blank" rel="noopener">Hubungi admin via WhatsApp</a>
      </div>
    </div>
    <div class="ip-aksi ip-aksi--baris">
      <button type="button" class="ip-btn ip-btn--tegas" id="daftar-lanjut">Ke halaman masuk</button>
    </div>
  </div>`;
  document.body.appendChild(kotak);
  kotak.querySelector("#daftar-lanjut").addEventListener("click", () => { window.location.href = "app.html#beranda"; });
}

// Ikon mata: tampil/sembunyikan kata sandi (login dan daftar)
const IKON_MATA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const IKON_MATA_CORET = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.9 17.9A10.6 10.6 0 0 1 12 19C5.6 19 2 12 2 12a18 18 0 0 1 5.1-5.9M9.9 5.2A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a18 18 0 0 1-2.2 3.2M1 1l22 22M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
for (const id of ["password", "df-pass"]) {
  const inp = document.getElementById(id);
  if (!inp) continue;
  const wrap = document.createElement("div");
  wrap.className = "pw";
  inp.replaceWith(wrap);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "pw-mata";
  const set = (tampil) => {
    inp.type = tampil ? "text" : "password";
    btn.classList.toggle("on", tampil);
    btn.setAttribute("aria-pressed", String(tampil));
    btn.setAttribute("aria-label", tampil ? "Sembunyikan kata sandi" : "Tampilkan kata sandi");
    btn.innerHTML = tampil ? IKON_MATA_CORET : IKON_MATA;
  };
  set(false);
  btn.addEventListener("click", () => { set(inp.type === "password"); inp.focus(); });
  wrap.append(inp, btn);
}
