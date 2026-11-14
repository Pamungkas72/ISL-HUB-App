// Jalankan: node tests/unit/daily-job-akun.test.js
const U = require("../../functions/dailyjob-akun-util.js");
let gagal = 0; const eq = (n, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) gagal++; console.log(ok ? "LULUS" : "GAGAL", n, ok ? "" : `dapat ${JSON.stringify(a)}, harus ${JSON.stringify(b)}`); };
eq("alias: bentrok hanya bila dipakai akun lain", [U.kunciBentrok(["u_a", "p_62"], [true, false], []), U.kunciBentrok(["u_a", "p_62"], [true, false], ["u_a"]), U.kunciBentrok(["u_a", "p_62"], [false, true], ["u_a"]), U.kunciBentrok(["u_a"], [false], [])], ["u_a", null, "p_62", null]);
eq("telepon 08 jadi 62", U.normalTelepon("0812-3456-7890"), "6281234567890");
eq("telepon +62", U.normalTelepon("+62 812 3456 7890"), "6281234567890");
eq("telepon tanpa nol", U.normalTelepon("81234567890"), "6281234567890");
eq("telepon terlalu pendek ditolak", U.normalTelepon("0812"), "");
eq("username valid", [U.usernameValid("dede.e"), U.usernameValid("ab"), U.usernameValid("Dede"), U.usernameValid("a b c")], [true, false, false, false]);
eq("kunci login: username", U.kunciLogin("  Dede.E "), "u_dede.e");
eq("kunci login: email", U.kunciLogin("Dede@Gmail.com"), "e_dede@gmail.com");
eq("kunci login: telepon", U.kunciLogin("0812 3456 7890"), "p_6281234567890");
eq("kunci login: angka pendek dianggap username", U.kunciLogin("12345"), "u_12345");
eq("email sintetis", U.emailSintetis("Dede.E"), "dede.e@dj.isl-hub.app");
eq("sandi", [U.sandiValid("12345678"), U.sandiValid("pendek")], [true, false]);
process.exit(gagal ? 1 : 0);
