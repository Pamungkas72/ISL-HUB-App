// Firebase tiruan di memori untuk menjalankan aplikasi ASLI (public/app.html) tanpa jaringan dan tanpa akun.
// Dipakai audit tampilan (tests/audit/audit-tema.js). Data awal lewat window.__FS_AWAL = { namaKoleksi: { idDokumen: { ... } } }.
// Bukan pengganti uji aturan Firestore (itu tests/rules).
const AUTH = `
export const getAuth = () => window.__AUTH || (window.__AUTH = { currentUser: window.__USER, languageCode: 'id' });
export const setPersistence = async () => {};
export const browserSessionPersistence = {}; export const inMemoryPersistence = {};
export const onAuthStateChanged = (a, cb) => { setTimeout(() => cb(window.__USER || null), 0); return () => {}; };
export const signOut = async () => {}; export const signInWithEmailAndPassword = async () => ({ user: window.__USER });
export const createUserWithEmailAndPassword = async () => ({ user: window.__USER }); export const updateProfile = async () => {}; export const sendPasswordResetEmail = async () => {};
`;
const APP = `export const initializeApp = c => ({ c });`;
const FS = `
const S = () => (window.__FS = window.__FS || JSON.parse(JSON.stringify(window.__FS_AWAL || {})));
const snapDoc = (kol, id, d) => ({ id, ref: { type: 'doc', kol, id }, exists: () => d !== undefined, data: () => (d === undefined ? undefined : JSON.parse(JSON.stringify(d))) });
const snapKol = (kol, filt) => { const o = S()[kol] || {}; let ids = Object.keys(o); (filt || []).forEach(f => { if (f.t === 'where') ids = ids.filter(i => f.op === '==' ? o[i][f.f] === f.v : f.op === 'in' ? (f.v || []).includes(o[i][f.f]) : true); if (f.t === 'limit') ids = ids.slice(0, f.n); }); const docs = ids.map(i => snapDoc(kol, i, o[i])); return { docs, size: docs.length, empty: !docs.length, forEach: fn => docs.forEach(fn), docChanges: () => [] }; };
export const getFirestore = () => ({});
export const collection = (db, ...p) => ({ type: 'col', kol: p.join('/') });
export const doc = (a, ...p) => a && a.type === 'col' ? { type: 'doc', kol: a.kol, id: p[0] || ('x' + Math.random().toString(36).slice(2, 9)) } : { type: 'doc', kol: p.slice(0, -1).join('/'), id: p[p.length - 1] };
export const where = (f, op, v) => ({ t: 'where', f, op, v }); export const orderBy = () => ({ t: 'order' }); export const limit = n => ({ t: 'limit', n });
export const query = (c, ...k) => ({ ...c, filt: k });
export const getDocs = async q => snapKol(q.kol, q.filt);
export const getDoc = async r => snapDoc(r.kol, r.id, (S()[r.kol] || {})[r.id]); export const getDocFromServer = getDoc;
export const setDoc = async (r, d, o) => { const s = S(); s[r.kol] = s[r.kol] || {}; s[r.kol][r.id] = o && o.merge ? { ...(s[r.kol][r.id] || {}), ...d } : d; };
export const updateDoc = async (r, d) => { const s = S(); s[r.kol] = s[r.kol] || {}; s[r.kol][r.id] = { ...(s[r.kol][r.id] || {}), ...d }; };
export const deleteDoc = async r => { const s = S(); if (s[r.kol]) delete s[r.kol][r.id]; };
export const deleteField = () => undefined; export const serverTimestamp = () => new Date().toISOString();
export class Timestamp { static now() { return new Date().toISOString(); } static fromDate(d) { return d.toISOString(); } }
export const onSnapshot = (q, cb) => { setTimeout(() => cb(snapKol(q.kol, q.filt)), 0); return () => {}; };
export const writeBatch = () => { const ops = []; const b = { set: (r, d, o) => { ops.push(() => setDoc(r, d, o)); return b; }, update: (r, d) => { ops.push(() => updateDoc(r, d)); return b; }, delete: r => { ops.push(() => deleteDoc(r)); return b; }, commit: async () => { for (const f of ops) await f(); } }; return b; };
export const runTransaction = async (db, fn) => fn({ get: getDoc, set: setDoc, update: updateDoc, delete: deleteDoc });
`;
const ST = `
export const getStorage = () => ({}); export const ref = (s, p) => ({ p });
export const uploadBytes = async () => ({}); export const uploadString = async () => ({}); export const deleteObject = async () => {};
export const getDownloadURL = async () => 'data:image/gif;base64,R0lGODlhAQABAAAAACw='; export const getBytes = async () => new ArrayBuffer(0);
`;
const FN = `export const getFunctions = () => ({}); export const httpsCallable = () => async () => ({ data: {} });`;
const MODUL = { 'firebase-functions': FN, 'firebase-app': APP, 'firebase-auth': AUTH, 'firebase-firestore': FS, 'firebase-storage': ST };

// Pasang ke sebuah halaman Playwright: berkas aplikasi dari folder public/ di origin http://isl.test, modul Firebase diganti tiruan.
async function pasang(page, publicDir, { email = 'codcodan1@gmail.com', awal = {}, nama = 'Ega' } = {}) {
  const fs = require('fs'), path = require('path');
  const tipe = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.webp': 'image/webp' };
  await page.addInitScript(({ email, awal, nama }) => {
    window.__USER = { uid: 'u-' + email.split('@')[0], email, displayName: nama, metadata: { lastLoginAt: String(Date.now()) }, getIdToken: async () => 'x' };
    window.__FS_AWAL = awal;
  }, { email, awal, nama });
  await page.route('https://www.gstatic.com/firebasejs/**', r => { const m = /firebasejs\/[\d.]+\/([\w-]+)\.js/.exec(r.request().url()); r.fulfill({ status: 200, contentType: 'text/javascript', body: MODUL[m && m[1]] || 'export {}' }); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('http://isl.test/**', r => {
    let p = new URL(r.request().url()).pathname; if (p === '/') p = '/index.html';
    const f = path.join(publicDir, p);
    if (!f.startsWith(publicDir) || !fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ status: 200, contentType: tipe[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
}
module.exports = { pasang };
