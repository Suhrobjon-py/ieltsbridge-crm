// "Ha / Yo'q" tasdiqlash oynasi (window.confirm o'rniga — barcha brauzerlarda ishlaydi)
export default function Confirm({ text, onHa, onYoq }: { text: string; onHa: () => void; onYoq: () => void }) {
  return (
    <div className="modal-back" style={{ zIndex: 60 }} onMouseDown={(e) => e.target === e.currentTarget && onYoq()}>
      <div className="modal" style={{ width: 400 }}>
        <div className="modal-body">
          <p style={{ marginBottom: 18, fontWeight: 600, fontSize: 15 }}>{text}</p>
          <div className="row-gap" style={{ justifyContent: 'flex-end' }}>
            <button className="btn-sm" onClick={onYoq}>Yo'q</button>
            <button className="btn btn-danger-solid" onClick={onHa}>Ha</button>
          </div>
        </div>
      </div>
    </div>
  );
}
