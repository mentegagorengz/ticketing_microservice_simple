// war-test.js
const SERVER_URL = "http://localhost:3000/book";
const TOTAL_ATTACKERS = 100; // Jumlah penyerang
const TARGET_SEAT = "A-1"; // ✅ Kursi yang direbutkan (sesuai seed)

async function attack() {
  console.log(
    `🔥 MEMULAI SERANGAN: ${TOTAL_ATTACKERS} user berebut kursi ${TARGET_SEAT}...`
  );

  const requests = [];
  let successCount = 0;
  let failCount = 0;
  let errorCount = 0;

  const startTime = Date.now();

  // 1. Siapkan 100 Request secara serentak
  for (let i = 1; i <= TOTAL_ATTACKERS; i++) {
    const payload = {
      seatId: TARGET_SEAT,
      userId: `User-${i}`, // User-1, User-2, dst
    };

    // Kita push Promise ke array, jangan di-await dulu biar jalan paralel
    const req = fetch(SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        const data = await res.json();

        if (res.status === 201) return "SUCCESS"; // NestJS default return 201 for POST
        if (res.status === 409) return "BLOCKED"; // ✅ Conflict (Benar)

        console.log(`⚠️  Response ${res.status}:`, data.message);
        return "ERROR"; // Error lain (Salah)
      })
      .catch((err) => {
        console.error("Connection Error:", err.message);
        return "CONNECTION_ERROR";
      });

    requests.push(req);
  }

  // 2. TEMBAK SEMUANYA SEKALIGUS! 🔫
  const results = await Promise.all(requests);
  const endTime = Date.now();

  // 3. Hitung Mayat
  results.forEach((status) => {
    if (status === "SUCCESS") successCount++;
    else if (status === "BLOCKED") failCount++;
    else errorCount++;
  });

  console.log("\n========================================");
  console.log("📊 LAPORAN PERTEMPURAN");
  console.log("========================================");
  console.log(`⏱️  Durasi Serangan : ${endTime - startTime} ms`);
  console.log(`✅ Sukses (Dapat Tiket) : ${successCount}`);
  console.log(`🛡️  Diblokir (Gagal)     : ${failCount}`);
  console.log(`❌ Error Sistem         : ${errorCount}`);
  console.log("========================================");

  if (successCount === 1 && failCount === TOTAL_ATTACKERS - 1) {
    console.log("🏆 KESIMPULAN: SISTEM AMAN & DATA KONSISTEN!");
  } else if (successCount === 0 && errorCount === 0) {
    console.log(
      "⚠️  KESIMPULAN: Semua request diblokir (mungkin kursi sudah BOOKED)"
    );
  } else {
    console.log("⚠️  KESIMPULAN: ADA KEBOCORAN! (Double Booking Terjadi)");
  }
}

attack();
