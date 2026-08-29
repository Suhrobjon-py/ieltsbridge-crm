export function som(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('ru-RU').replace(/,/g, ' ') + " so'm";
}

export function sana(d: string | null | undefined): string {
  if (!d) return '—';
  const [y, m, day] = d.slice(0, 10).split('-');
  return `${day}.${m}.${y}`;
}

export function bugunISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function joriyDavr(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

export function uchOyKeyin(startISO: string): string {
  const d = new Date(startISO + 'T00:00:00');
  d.setMonth(d.getMonth() + 3);
  return d.toISOString().slice(0, 10);
}

export const HOLAT_UZ: Record<string, string> = {
  // umumiy
  faol: 'Faol', pauza: 'Pauza', bitirgan: 'Bitirgan', ketgan: 'Ketgan',
  // lead
  yangi: 'Yangi', aloqa_qilindi: 'Aloqaga chiqildi', sinov_belgilandi: 'Sinov belgilandi',
  sinovga_keldi: 'Sinovga keldi', yozildi: 'Yozildi', yoqotildi: "Yo'qotildi", kelmaydi: 'Kelmaydi',
  // guruh
  rejada: 'Rejada', imtihon: 'Imtihon', yakunlangan: 'Yakunlangan', bekor: 'Bekor',
  // sessiya
  otildi: "O'tildi", kochirildi: "Ko'chirildi",
  // davomat
  keldi: 'Keldi', kechikdi: 'Kechikdi', kelmadi: 'Kelmadi', sababli: 'Sababli',
  // to'lov
  kutilmoqda: 'Kutilmoqda', qisman: 'Qisman', tolangan: "To'langan", muddati_otgan: "Muddati o'tgan",
  // a'zolik
  yakunladi: 'Yakunladi', tashlab_ketdi: 'Tashlab ketdi', chetlashtirildi: 'Chetlashtirildi',
  // o'qituvchi darajasi
  main: 'Asosiy', support: 'Yordamchi',
  bosqich_takrorlaydi: 'Bosqichni takrorlaydi',
  // dars turi
  yangi_mavzu: 'Yangi mavzu', mustahkamlash: 'Mustahkamlash', amaliyot: 'Amaliyot',
  // keyingi qadam
  otdi_keyingi: "O'tdi", qayta_topshiradi: 'Qayta topshiradi', moslashuv_2_hafta: '2 hafta moslashuv',
  // manba
  instagram: 'Instagram', telegram: 'Telegram', tavsiya: 'Tavsiya', dostlar: "Do'stlar", otib_ketgan: "O'tib ketgan", boshqa: 'Boshqa',
};

// ==================== PIPELINE LUG'ATLARI ====================

export const LEAD_BOSQICHLAR: [string, string][] = [
  ['yangi', 'Yangi lid'],
  ['birinchi_aloqa', 'Birinchi aloqa'],
  ['boglanib_bolmadi', "Bog'lanib bo'lmadi"],
  ['aloqa_ornatildi', "Aloqa o'rnatildi"],
  ['qiziqish_bildirdi', 'Qiziqish bildirdi'],
  ['sinovga_yozildi', 'Sinovga yozildi'],
  ['sinovga_keldi', 'Sinovga keldi'],
  ['taklif_berildi', 'Taklif berildi'],
  ['qaror_kutilmoqda', 'Qaror kutilmoqda'],
  ['sotuv_yopildi', 'Sotuv yopildi'],
  ['rad_etdi', 'Rad etdi'],
];

export const MANBALAR: [string, string][] = [
  ['instagram_ads', 'Instagram Ads'],
  ['instagram_organic', 'Instagram Organic'],
  ['telegram', 'Telegram'],
  ['facebook_ads', 'Facebook Ads'],
  ['google_ads', 'Google Ads'],
  ['website', 'Vebsayt'],
  ['telefon', 'Telefon'],
  ['tavsiya', 'Tavsiya'],
  ['offline', 'Offline'],
  ['hamkor', 'Hamkor'],
  ['boshqa', 'Boshqa'],
];

export const NOSHOW_SABABLAR: [string, string][] = [
  ['unutgan', 'Unutib qoldi'],
  ['vaqt_mos_kelmadi', 'Vaqti mos kelmadi'],
  ['transport', 'Transport muammosi'],
  ['qiziqish_kamaydi', 'Qiziqishi kamaydi'],
  ['ota_ona_ruxsat_bermadi', 'Ota-ona ruxsat bermadi'],
  ['narx_qimmat', 'Narx qimmat'],
  ['boshqa_markaz', 'Boshqa markazni tanladi'],
  ['aloqa_bolmadi', "Aloqa qilish imkoni bo'lmadi"],
  ['nomalum', "Sabab noma'lum"],
  ['boshqa', 'Boshqa'],
];

export const RAD_SABABLAR: [string, string][] = [
  ['narx_qimmat', 'Narx qimmat'],
  ['ota_ona_maslahat', 'Ota-ona bilan maslahatlashadi'],
  ['vaqt_mos_emas', 'Vaqt mos emas'],
  ['oqituvchi_yoqmadi', "O'qituvchi yoqmadi"],
  ['kurs_yoqmadi', 'Kurs yoqmadi'],
  ['boshqa_markaz', 'Boshqa markaz tanlandi'],
  ['moliyaviy', 'Moliyaviy sabab'],
  ['keyinroq', 'Keyinroq boshlaydi'],
  ['aloqa_yoqolgan', "Aloqa yo'qolgan"],
  ['boshqa', 'Boshqa'],
];

export const CHURN_SABABLAR: [string, string][] = [
  ['narx', 'Narx'],
  ['oqituvchi', "O'qituvchi"],
  ['davomat', 'Davomat muammosi'],
  ['natija_yoq', "Natija yo'q"],
  ['vaqt_mos_emas', 'Vaqt mos emas'],
  ['kochib_ketdi', "Ko'chib ketdi"],
  ['boshqa_markaz', 'Boshqa markaz'],
  ['moliyaviy', 'Moliyaviy muammo'],
  ['shaxsiy', 'Shaxsiy sabab'],
  ['boshqa', 'Boshqa'],
];

export const TRIAL_HOLATLAR: [string, string][] = [
  ['yozildi', 'Yozildi'],
  ['tasdiqlandi', 'Tasdiqlandi'],
  ['eslatma_yuborildi', 'Eslatma yuborildi'],
  ['keldi', 'Keldi'],
  ['kelmadi', 'Kelmadi'],
  ['qayta_yozildi', 'Qayta yozildi'],
  ['muvaffaqiyatli', 'Muvaffaqiyatli'],
  ['sotuvga_otkazildi', "Sotuvga o'tkazildi"],
];

export const WINBACK_BOSQICHLAR: [string, string][] = [
  ['aloqa_qilindi', 'Aloqa qilindi'],
  ['qiziqdi', 'Qiziqdi'],
  ['taklif_berildi', 'Maxsus taklif berildi'],
  ['qaytdi', 'Qaytdi'],
];

const LUGAT_QOSHIMCHA: Record<string, string> = {};
// tartib muhim: keyingisi ustun — lead bosqichlari eng oxirida (umumiy holat() uchun ular g'olib)
for (const juft of [...WINBACK_BOSQICHLAR, ...NOSHOW_SABABLAR, ...CHURN_SABABLAR, ...RAD_SABABLAR, ...MANBALAR, ...TRIAL_HOLATLAR, ...LEAD_BOSQICHLAR]) {
  LUGAT_QOSHIMCHA[juft[0]] = juft[1];
}
Object.assign(HOLAT_UZ, LUGAT_QOSHIMCHA, {
  past: 'Past', orta: "O'rta", yuqori: 'Yuqori',
});

export const BOLIMLAR: [string, string][] = [
  ['boshqaruv', 'Boshqaruv'],
  ['lidlar', 'Lidlar'],
  ['sinovlar', 'Sinov darslari'],
  ['muammolar', 'Muammolar'],
  ['oquvchilar', "O'quvchilar"],
  ['guruhlar', 'Guruhlar'],
  ['xonalar', 'Xonalar'],
  ['oqituvchilar', "O'qituvchilar"],
  ['tolovlar', "To'lovlar"],
  ['xarajatlar', 'Xarajatlar'],
  ['hisobotlar', 'Hisobotlar'],
  ['sozlamalar', 'Sozlamalar'],
];

export const ROLLAR: [string, string][] = [
  ['admin', 'Admin'],
  ['reseption', 'Resepshn'],
  ['call_markaz', 'Call-markaz'],
  ['oqituvchi', "O'qituvchi"],
];

Object.assign(HOLAT_UZ, {
  superadmin: 'Bosh admin', admin: 'Admin', reseption: 'Resepshn',
  call_markaz: 'Call-markaz', oqituvchi: "O'qituvchi",
  korish: "Ko'rish", tahrirlash: 'Tahrirlash', ochirish: "O'chirish",
});

export function riskHolat(score: number): { label: string; rang: string } {
  if (score >= 70) return { label: 'Faol', rang: 'green' };
  if (score >= 40) return { label: "E'tibor kerak", rang: 'amber' };
  return { label: 'Xavf ostida', rang: 'red' };
}

export function nechaKunOldin(ts: string | null | undefined): string {
  if (!ts) return '—';
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
  if (diff <= 0) return 'bugun';
  if (diff === 1) return 'kecha';
  return `${diff} kun oldin`;
}

export function qisqaSom(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + ' mln';
  if (abs >= 1_000) return Math.round(n / 1_000) + ' ming';
  return String(Math.round(n));
}

export function oyNomi(period: string): string {
  const OYLAR = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
  const [y, m] = period.split('-');
  return `${OYLAR[Number(m) - 1]} ${y}`;
}

export function holat(s: string | null | undefined): string {
  if (!s) return '—';
  return HOLAT_UZ[s] ?? s;
}

export const KUNLAR: Record<string, string> = {
  DCJ: 'Du · Chor · Ju',
  SPS: 'Se · Pay · Shan',
};
