# Ticket System (NestJS)

Proyek ini adalah contoh sistem ticketing asinkron yang menggunakan arsitektur HTTP API (producer) + Worker (consumer) dengan shared library. Dirancang sebagai monorepo NestJS dengan komponen utama:

- `engine/apps/engine` — HTTP API yang menerima permintaan booking dan menerbitkan event ke RabbitMQ.
- `engine/apps/worker` — Worker/microservice yang mendengarkan event RabbitMQ dan melakukan finalisasi (simpan Ticket, update Seat).
- `engine/libs/common` — Shared library: entitas TypeORM (`Ticket`, `Seat`), koneksi TypeORM, dan helper Redis lock.
- `docker-compose.yml` — Infrastruktur dev: PostgreSQL, Redis, RabbitMQ.

## Teknologi utama

- Node.js + TypeScript
- NestJS (HTTP + Microservices)
- TypeORM + PostgreSQL
- RabbitMQ (amqplib, amqp-connection-manager)
- Redis (ioredis) — untuk mekanisme lock
- Docker / Docker Compose — untuk menjalankan infra dev
- Jest — unit & e2e tests

## Struktur singkat

- `engine/` — monorepo NestJS
  - `apps/engine` — HTTP API
  - `apps/worker` — Worker (RabbitMQ consumer)
  - `libs/common` — shared entities & utilities
- `docker-compose.yml` — service: postgres, redis, rabbitmq
- `war-test.js` — skrip load-test sederhana

## Prasyarat

- Docker & Docker Compose
- Node.js (direkomendasikan v18+)
- npm

## Quickstart (lokal)

1. Jalankan infrastruktur (Postgres, Redis, RabbitMQ):

```bash
docker compose up -d
```

2. Install dependencies (dari root project):

```bash
cd engine
npm install
```

3. Jalankan HTTP API (Engine):

```bash
# di folder engine
npm run start:dev
# default: http://localhost:3000
```

4. Jalankan Worker (di terminal lain):

```bash
# di folder engine
npx nest start worker
```

Catatan: `engine` dan `worker` adalah dua app terpisah dalam monorepo yang sama (lihat `nest-cli.json`). `npm run start:dev` untuk HTTP API, `npx nest start worker` untuk consumer. Keduanya bisa jalan bersamaan.

## Environment & konfigurasi

Periksa konfigurasi koneksi database, Redis, dan RabbitMQ di `engine/libs/common/src/common.module.ts` dan file konfigurasi terkait. Pastikan port/host sesuai dengan `docker-compose.yml` bila Anda menjalankan infra via Docker.

> Perhatian: TypeORM biasanya diset `synchronize: true` di konfigurasi dev — hanya untuk pengembangan.

## Endpoint penting (Engine)

- POST /admin/seed — seed data kursi (populate seats)
- POST /book — buat permintaan booking (HTTP API membuat event ke RabbitMQ)
- GET /tickets — list tiket

Lihat implementasi di `engine/apps/engine/src/engine.controller.ts` dan `engine/apps/engine/src/engine.service.ts`.

## Alur singkat

1. Client → POST /book ke `engine`
2. `engine` validasi seat (`AVAILABLE`), ambil Redis lock (`SET NX`, TTL 600s) → publish event `ticket_created` ke RabbitMQ
3. `worker` mendengarkan event → finalisasi: simpan `Ticket` (PENDING → BOOKED), update `Seat` ke `BOOKED`
4. `worker` lepas Redis lock (compare-and-delete, hanya kalau masih pemegangnya) → selesai generate PDF/QR → tiket `ISSUED`

### Keamanan & kegagalan

- **Lock holder-aware**: `releaseLock` memakai Lua compare-and-delete. Worker yang lock-nya sudah kedaluwarsa TTL tidak bisa menghapus lock milik user baru.
- **Manual ack** (`noAck: false`): pesan gagal di-requeue hingga 3x (transient error, mis. DB down). Setelah 3x gagal, pesan di-drop agar poison message tidak looping selamanya; tiket ditandai `FAILED` di DB.
- **Idempotent**: retry tidak membuat tiket duplikat — tiket lama yang belum `ISSUED` dipakai ulang; duplikat yang sudah `ISSUED` di-skip.
- **Status tiket**: `PENDING` → `BOOKED` → `ISSUED` (atau `FAILED` jika proses gagal).

## Scripts penting

Di direktori `engine` ada beberapa npm scripts (lihat `engine/package.json`):

- `npm run start:dev` — jalankan HTTP API (Engine) dalam mode watch
- `npx nest start worker` — jalankan Worker (RabbitMQ consumer)
- `npm run build` — build project
- `npm run lint` — jalankan ESLint
- `npm run test` — jalankan jest
- `npm run test:e2e` — jalankan e2e tests untuk `apps/engine`
- `npm run format` — prettier

## Testing & load testing

- Unit & e2e: menggunakan Jest. Jalankan `npm run test` atau `npm run test:e2e` dari folder `engine`.
- Load test: `war-test.js` (root) — skrip sederhana untuk mengirim banyak request POST /book.

## Troubleshooting singkat

- Pastikan Docker Compose berjalan: `docker compose ps`.
- Jika worker/engine tidak terhubung ke DB/Rabbit/Redis, periksa konfigurasi host/port dan variable environment pada code.
- Jika ada masalah TypeORM migration/schema, cek bahwa `synchronize` sesuai untuk dev.

## Next steps & rekomendasi

- Tambahkan CI (GitHub Actions) untuk lint, test, dan build.
- Commit lockfile (`package-lock.json`/`pnpm-lock.yaml`) untuk reproducible installs.
- Jika hendak deploy ke production: matikan `synchronize`, tambahkan migration, dan amankan credentials.
