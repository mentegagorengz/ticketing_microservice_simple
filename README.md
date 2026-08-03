# Ticket Booking System (Asynchronous)

Sistem pemesanan tiket asinkron berbasis event-driven. HTTP API menerima permintaan booking, lalu finalisasi tiket dikerjakan oleh worker terpisah melalui RabbitMQ — dengan Redis lock sebagai penjaga konsistensi agar dua user tidak pernah mendapat tiket kursi yang sama.

## Fitur utama

- **Anti double-booking**: Redis distributed lock (`SET NX` + TTL) membatasi satu kursi untuk satu user pada satu waktu.
- **Pemisahan producer-consumer**: HTTP API (engine) dan pemroses tiket (worker) berjalan sebagai proses terpisah, terhubung via RabbitMQ queue yang durable.
- **At-least-once + idempotent**: pesan yang gagal diproses di-retry hingga 3 kali; pemrosesan ulang tidak membuat tiket duplikat.
- **Owner-aware lock release**: pelepasan lock memakai Lua compare-and-delete, sehingga proses yang lock-nya sudah kedaluwarsa tidak bisa mencabut lock milik proses lain.
- **Status tiket ter-track**: `PENDING` → `BOOKED` → `ISSUED`, atau `FAILED` jika proses gagal.

## Arsitektur

```
┌──────────────┐   POST /book    ┌──────────────────────────────────────────────┐
│    Client    │ ──────────────▶ │                  ENGINE (HTTP)                 │
└──────────────┘                 │ 1. Validasi seat (status AVAILABLE)          │
                                 │ 2. Redis lock: SET lock:seat:<id> NX EX 600  │
                                 │ 3. Publish event ticket_created             │
                                 └──────────────┬───────────────────────────────┘
                                                │ RabbitMQ (queue: ticket_queue,
                                                │ durable)
                                                ▼
                                 ┌──────────────────────────────────────────────┐
                                 │              WORKER (consumer)                │
                                 │ 1. Simpan Ticket (PENDING)                   │
                                 │ 2. Update Seat → BOOKED + Ticket → BOOKED    │
                                 │ 3. Release Redis lock (compare-and-delete)   │
                                 │ 4. Generate PDF/QR → Ticket → ISSUED         │
                                 │ 5. Ack pesan; retry 3x jika gagal            │
                                 └──────────────────────────────────────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    ▼                         ▼                         ▼
               PostgreSQL                  Redis                    (worker lain
               (Seat, Ticket)              (lock)                   bisa scale-out)
```

## Alur booking

1. `POST /book` dengan `{ seatId, userId }` masuk ke engine.
2. Engine memvalidasi kursi masih `AVAILABLE`, lalu mengambil Redis lock untuk kursi tersebut. Gagal dapat lock (ada proses lain) → request ditolak `409`.
3. Engine mempublikasikan event `ticket_created` ke RabbitMQ. Lock sengaja **tidak dilepas di sini** — yang melepas adalah worker setelah kursi tersimpan durable ke `BOOKED`, sehingga tidak ada celah double-booking antara request sukses dan finalisasi.
4. Worker menerima event, menyimpan tiket `PENDING`, mengunci kursi jadi `BOOKED`, melepas lock, lalu menuntaskan tiket menjadi `ISSUED`.
5. Jika emisi event gagal, engine melepas lock sendiri agar kursi tidak terkunci.

## Keputusan teknis & trade-off

| Masalah | Solusi | Catatan |
|---|---|---|
| Dua request bersamaan untuk kursi sama | Redis lock `SET NX EX` di engine | TTL 600s sebagai safety net jika worker mati; lock dipegang sampai worker finalisasi, bukan langsung dilepas setelah request |
| Lock salah dilepas oleh proses lain | Lua compare-and-delete | Release hanya dijalankan jika value lock masih milik pemegangnya (userId), bukan `DEL` polos |
| Pesan gagal hilang diam-diam | Manual ack (`noAck: false`) + retry 3x | Setelah 3x gagal, pesan di-drop (bukan requeue tak terbatas yang bisa infinite-loop); tiket ditandai `FAILED` |
| Retry membuat tiket duplikat | Idempotent processing | Worker mencari tiket lama per seat sebelum membuat baru; duplikat yang sudah `ISSUED` di-skip |
| Konfigurasi antar-app tidak konsisten | Shared library `@app/common` | Entitas TypeORM, koneksi DB/Redis, dan fungsi lock berada di satu tempat agar tidak saling menyimpang |

## Tech stack

- **Runtime**: Node.js + TypeScript
- **Framework**: NestJS (HTTP + Microservices), monorepo
- **Messaging**: RabbitMQ (amqplib) — queue durable
- **Database**: PostgreSQL via TypeORM (entitas `Seat`, `Ticket`)
- **Caching/Lock**: Redis (ioredis)
- **Infrastruktur dev**: Docker Compose
- **Testing**: Jest

## Struktur repo

```
ticketing-system/
├── docker-compose.yml          # PostgreSQL, Redis, RabbitMQ
├── war-test.js                 # Load test: 100 user berebut 1 kursi
└── engine/                     # NestJS monorepo
    ├── apps/
    │   ├── engine/             # HTTP API (producer)
    │   └── worker/             # RabbitMQ consumer
    └── libs/
        └── common/             # Entitas, koneksi DB, Redis lock (shared)
```

## Quickstart

Prasyarat: Docker, Node.js 18+, npm.

```bash
# 1. Jalankan infrastruktur (PostgreSQL, Redis, RabbitMQ)
docker compose up -d

# 2. Install dependencies
cd engine
npm install

# 3. Terminal 1 — HTTP API
npm run start:dev              # http://localhost:3000

# 4. Terminal 2 — Worker
npx nest start worker
```

Environment diambil dari `.env` di root project (lihat `.env.example`).

## Endpoint

| Method | Path | Deskripsi |
|---|---|---|
| POST | `/book` | Buat booking `{ seatId, userId }`. Sukses → 201 (diproses asinkron); kursi diproses user lain → 409 |
| GET | `/tickets` | Daftar tiket, terbaru dulu |
| POST | `/admin/seed` | Seed 100 kursi (A-1 .. A-100; 20 VIP) |

## Testing

```bash
cd engine
npm run test        # unit tests (engine, worker, common)
```

Selain unit test, `war-test.js` mengirim 100 request serentak untuk kursi yang sama:

```
Sukses (dapat tiket) : 1
Diblokir (409)       : 99
Error sistem         : 0
```

Hasil: tepat satu user mendapatkan kursi, sisanya ditolak, tanpa double booking.

## Batasan & roadmap

- Belum ada dead-letter queue — pesan yang drop setelah 3x retry hanya tercatat di log dan status tiket `FAILED`. Upgrade: DLQ + retry dengan backoff (RabbitMQ delayed message plugin).
- `synchronize: true` di TypeORM hanya untuk pengembangan; produksi harus migration.
- PDF/QR masih simulasi (delay 1 detik), belum diimplementasikan.
- Lock tidak auto-renewal; TTL 600s cukup untuk kasus sekarang.
