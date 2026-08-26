# IELTSBridge CRM

O'quv markaz boshqaruv tizimi: lidlar, o'quvchilar, guruhlar, dars jurnali,
davomat, to'lovlar. Ma'lumotlar Supabase (PostgreSQL) da; oltala darslik
kontenti (84 mavzu, 252 dars, 1536 so'z, 645 material, 432 uy vazifasi)
bazaga seed sifatida yuklangan. Mobil ilova ham shu bazadan oziqlanadi.

- Sozlash: **SOZLASH.md**
- Texnologiya: Vite + React + TypeScript + supabase-js
- Ishga tushirish: `npm run dev` → http://localhost:5199
- Build: `npm run build` (natija `dist/` da)

## Tuzilma

```
supabase/migrations/   baza sxemasi + kontent seed (SQL Editor'da ishga tushiriladi)
src/pages/             sahifalar: Dashboard, Lidlar, O'quvchilar, Guruhlar, To'lovlar...
src/lib/               supabase klienti, formatlash
src/components/        Modal, Badge
```

## Baza funksiyalari (RPC)

| Funksiya | Vazifasi |
|---|---|
| `make_group_id(level, start)` | GRP-2609-BEG-01 ko'rinishida ID beradi |
| `generate_sessions(group_id)` | Guruh uchun 36 dars jadvalini tuzadi (DCJ/SPS kunlari) |
| `generate_monthly_payments(period)` | Oy uchun to'lov yozuvlarini ochadi (chegirma hisobida) |
| `receive_payment(id, amount, method, by)` | To'lov qabul qiladi, holatni yangilaydi |

ID tizimi va to'liq ma'lumot modeli: `Desktop\IELTSBridge_tizim_jadvallari.xlsx`
