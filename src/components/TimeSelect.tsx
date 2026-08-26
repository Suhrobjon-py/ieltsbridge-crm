const VAQTLAR: string[] = [];
for (let h = 8; h <= 20; h++) {
  for (const m of ['00', '30']) VAQTLAR.push(`${String(h).padStart(2, '0')}:${m}`);
}

// Dars boshlanish vaqti: 08:00 - 20:30, yarim soatlik qadam bilan toza tanlov
export default function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const v = (value ?? '').slice(0, 5);
  return (
    <select value={VAQTLAR.includes(v) ? v : v || ''} onChange={(e) => onChange(e.target.value)} required>
      {!v && <option value="" disabled>— Vaqtni tanlang —</option>}
      {v && !VAQTLAR.includes(v) && <option value={v}>{v}</option>}
      {VAQTLAR.map((t) => <option key={t} value={t}>{t}</option>)}
    </select>
  );
}
