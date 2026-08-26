# IELTSBridge CRM — sozlash yo'riqnomasi

CRM tayyor kodlangan va sinovdan o'tgan. Ishga tushirish uchun faqat Supabase
loyihasini ulash kerak (~5-10 daqiqa). Buni bir marta qilasiz.

## 1. Supabase loyihasi yaratish

1. <https://supabase.com> ga kiring → **Start your project** → akkaunt oching
   (GitHub yoki email bilan, bepul).
2. **New project** bosing:
   - Name: `ieltsbridge`
   - Database password: kuchli parol yozing va **saqlab qo'ying**
   - Region: **Southeast Asia (Singapore)** (O'zbekistonga eng yaqini)
3. Loyiha tayyor bo'lishini kuting (~2 daqiqa).

## 2. Bazani o'rnatish (migratsiyalar)

1. Chap menyudan **SQL Editor** ni oching.
2. `supabase/migrations/20260825100000_schema.sql` faylini ochib, butun matnini
   nusxalang → SQL Editorga qo'ying → **Run**. ("Success" chiqishi kerak.)
3. Xuddi shunday `supabase/migrations/20260825100001_content_seed.sql` ni ham
   ishga tushiring (katta fayl, bir necha soniya oladi).
   Bu oltala kitobning butun kontentini yuklaydi: 84 mavzu, 252 dars,
   1536 so'z, 645 material, 432 uy vazifasi.

Tekshirish: **Table Editor** da `units` jadvalini oching — 84 qator ko'rinsin.

## 3. Admin foydalanuvchi yaratish

1. **Authentication → Users → Add user → Create new user**
2. O'z emailingiz + parol yozing, **Auto Confirm User** ni belgilang → yarating.
   (Xodim qo'shmoqchi bo'lsangiz, har biriga shu tarzda akkaunt ochasiz.)

## 4. CRM'ni ulash

1. Supabase'da **Settings → API** ni oching.
2. `IELTSBridge_CRM` papkasida `.env.example` faylidan nusxa olib `.env` deb
   nomlang va to'ldiring:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co        <- Project URL
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...              <- anon public key
```

3. CRM'ni ishga tushiring:

```
cd C:\Users\ASUS\Desktop\IELTSBridge_CRM
npm run dev
```

4. Brauzerda <http://localhost:5199> oching, 3-qadamdagi email/parol bilan kiring.

## 5. Birinchi ish tartibi (pilot guruh)

1. **O'qituvchilar** → yangi o'qituvchi qo'shing.
2. **Guruhlar** → yangi guruh oching (bosqich, kunlar, vaqt, narx) —
   36 ta dars jadvali avtomatik tuziladi.
3. **O'quvchilar** (yoki **Lidlar** orqali) → o'quvchi qo'shing → guruh
   sahifasida "O'quvchi qo'shish".
4. **To'lovlar** → oyni tanlab "to'lovlarini yaratish" → to'lov qabul qilish.
5. Har dars kuni guruh jurnalida qatorni bosib davomat kiriting.

## Eslatmalar

- **anon key** ni oshkor qilish xavfsiz (himoya RLS siyosatlarida), lekin
  **service_role key** ni HECH QAYERGA qo'ymang.
- Baza parolini yo'qotsangiz Supabase Settings'da almashtirasiz.
- Internetga chiqarish (hosting) keyinroq: `npm run build` → `dist` papkasini
  istalgan statik hostingga (Vercel/Netlify) qo'yish mumkin.
- Mobil ilova keyingi bosqichda xuddi shu Supabase'ga ulanadi — alohida
  backend kerak emas.
