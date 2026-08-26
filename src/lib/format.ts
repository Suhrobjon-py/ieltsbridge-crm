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
  sinovga_keldi: 'Sinovga keldi', yozildi: 'Yozildi', yoqotildi: "Yo'qotildi",
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
  main: 'Asosiy (Main)', support: 'Yordamchi (Support)',
  bosqich_takrorlaydi: 'Bosqichni takrorlaydi',
  // dars turi
  yangi_mavzu: 'Yangi mavzu', mustahkamlash: 'Mustahkamlash', amaliyot: 'Amaliyot',
  // keyingi qadam
  otdi_keyingi: "O'tdi", qayta_topshiradi: 'Qayta topshiradi', moslashuv_2_hafta: '2 hafta moslashuv',
  // manba
  instagram: 'Instagram', telegram: 'Telegram', tavsiya: 'Tavsiya', dostlar: "Do'stlar", otib_ketgan: "O'tib ketgan", boshqa: 'Boshqa',
};

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
