import { holat } from '../lib/format';

const RANG: Record<string, string> = {
  faol: 'green', otildi: 'green', tolangan: 'green', keldi: 'green', yozildi: 'green', otdi_keyingi: 'green',
  rejada: 'blue', yangi: 'blue', kutilmoqda: 'blue', aloqa_qilindi: 'blue', sinov_belgilandi: 'blue', sinovga_keldi: 'blue',
  qisman: 'amber', pauza: 'amber', kechikdi: 'amber', imtihon: 'amber', sababli: 'amber',
  muddati_otgan: 'red', kelmadi: 'red', yoqotildi: 'red', bekor: 'red', ketgan: 'red', tashlab_ketdi: 'red',
  bitirgan: 'gray', yakunlangan: 'gray', yakunladi: 'gray', kochirildi: 'gray',
};

export default function Badge({ s }: { s: string | null | undefined }) {
  if (!s) return <span>—</span>;
  return <span className={'badge badge-' + (RANG[s] ?? 'gray')}>{holat(s)}</span>;
}
