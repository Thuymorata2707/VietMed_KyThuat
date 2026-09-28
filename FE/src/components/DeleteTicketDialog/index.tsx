import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';
import { KeyboardEvent, useEffect, useRef } from 'react';

export type DeleteTicketDetail = { label: string; value?: string | null };

export function DeleteTicketDialog({
  details,
  loading = false,
  onCancel,
  onConfirm,
  title,
  warning = 'Thao tác này không thể hoàn tác. Kỹ sư có thể tạo lại phiếu sau khi xóa.',
}: {
  details: DeleteTicketDetail[];
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  warning?: string;
}) {
  const visibleDetails = details.filter((item) => item.value?.trim());
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const cancelActionRef = useRef(onCancel);
  const loadingRef = useRef(loading);
  cancelActionRef.current = onCancel;
  loadingRef.current = loading;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape' && !loadingRef.current) cancelActionRef.current();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, []);

  function containTabFocus(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled])'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[#161b22]/55 p-4 backdrop-blur-[3px]" onClick={loading ? undefined : onCancel} role="presentation">
      <section
        aria-labelledby="delete-ticket-title"
        aria-modal="true"
        className="grid w-full max-w-lg gap-5 rounded-2xl border border-[#e7e2dc] bg-white p-5 shadow-[0_28px_90px_rgba(16,24,40,0.28)] sm:p-6"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={containTabFocus}
        ref={dialogRef}
        role="alertdialog"
      >
        <header className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#fff1f0] text-[#a61b29]"><AlertTriangle size={21} /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#20242a]" id="delete-ticket-title">Xác nhận xóa phiếu</h2>
            <p className="mt-1 break-words text-sm font-medium text-[#5e6672]">{title}</p>
          </div>
          <button aria-label="Đóng hộp thoại" className="rounded-lg p-2 text-[#737b85] hover:bg-[#f4f4f5]" disabled={loading} onClick={onCancel} type="button"><X size={18} /></button>
        </header>

        {visibleDetails.length ? (
          <dl className="grid gap-0 overflow-hidden rounded-xl border border-[#e8eaed] bg-[#fafafa] sm:grid-cols-2">
            {visibleDetails.map((item) => (
              <div className="min-w-0 border-b border-[#e8eaed] px-3.5 py-3 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 sm:[&:nth-child(odd)]:border-r" key={`${item.label}-${item.value}`}>
                <dt className="text-xs font-medium text-[#737b85]">{item.label}</dt>
                <dd className="mt-1 break-words text-sm font-semibold text-[#252b32]">{item.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        <p className="rounded-lg bg-[#fff8e8] px-3.5 py-3 text-sm leading-5 text-[#77530c]">{warning}</p>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-[#eceef0] pt-4">
          <button className="secondary-button" disabled={loading} onClick={onCancel} ref={cancelRef} type="button">Hủy</button>
          <button className="primary-button bg-[#a61b29] hover:bg-[#861522]" disabled={loading} onClick={onConfirm} type="button">
            {loading ? <Loader2 className="spin-icon" size={16} /> : <Trash2 size={16} />}
            {loading ? 'Đang xóa...' : 'Xóa phiếu'}
          </button>
        </footer>
      </section>
    </div>
  );
}
