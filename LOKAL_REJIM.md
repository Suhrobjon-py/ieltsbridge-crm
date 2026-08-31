# Lokal rejim (internetsiz ishlash)

CRM ikki rejimda ishlaydi — kod bitta, baza ikkita ALOHIDA:

| | Bulut rejimi | Lokal rejim |
|---|---|---|
| Ishga tushirish | `CRM ishga tushirish.bat` / `npm run dev` | `CRM LOKAL.bat` / `npm run lokal` |
| Manzil | localhost:5199 | **localhost:5200** |
| Baza | Supabase (internet kerak) | Kompyuterdagi `lokal_baza/` papkasi |
| Internet | Kerak | **Kerak emas** |
| Birinchi kirish | Supabase'dagi akkauntingiz | **admin / admin123** (keyin almashtiring!) |

Muhim: ikkala rejim ma'lumotlari **avtomatik sinxronlanmaydi** — bular ikki alohida baza.

## Lokal rejim imkoniyatlari

- Barcha bo'limlar, qoidalar, avtomatikalar (davomat/imtihon/xavf bali) bulutdagi bilan BIR XIL —
  chunki baza xuddi shu Postgres migratsiyalari bilan quriladi (PGlite).
- Foydalanuvchilar va huquqlar ham ishlaydi: Sozlamalar → Foydalanuvchilar (parollar shu kompyuterda saqlanadi).
- Bir binodagi boshqa kompyuterlar (bir Wi-Fi/tarmoqda) ham kira oladi:
  brauzerda `http://<server-kompyuter-IP>:5200` (IP ni bilish: PowerShell'da `ipconfig` → IPv4).
- Yangi migratsiyalar keyingi ishga tushirishda avtomatik qo'llanadi.

## Zaxira nusxa (juda muhim!)

Lokal ma'lumot faqat shu kompyuterda. Kompyuter buzilsa — ma'lumot ketadi. Shuning uchun:

1. **Oson usul:** CRM → Sozlamalar → "💾 Zaxira nusxa yuklab olish" — .json fayl. Haftada bir marta
   flesh yoki Telegram "Saqlangan xabarlar"ga tashlab qo'ying.
2. **To'liq usul:** server o'chirilgan holatda `IELTSBridge_CRM\lokal_baza` papkasini nusxalash.

## Cheklovlar

- Mobil ilova (o'quvchi/ota-ona telefoni) lokal rejim bilan ishlamaydi — unga bulut kerak.
- Bulut ↔ lokal o'rtasida avtomatik sinxron yo'q (kelajakda qo'shish mumkin).
