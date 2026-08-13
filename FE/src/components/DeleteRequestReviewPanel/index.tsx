type DeleteRequestReviewPanelProps = {
  disabled?: boolean;
  onApprove: () => void;
  onReject: () => void;
  reason?: string;
};

const sidePanelClass = 'rounded-[24px] border border-[#e4e4e7] bg-white/95 p-5 shadow-[0_8px_24px_rgba(24,24,27,0.05)]';
const eyebrowClass = 'text-xs font-bold uppercase tracking-[0.16em] text-[#18181b]';
const sectionTitleClass = 'text-lg font-bold leading-tight text-[#1f1f1f]';

export function DeleteRequestReviewPanel({
  disabled = false,
  onApprove,
  onReject,
  reason,
}: DeleteRequestReviewPanelProps) {
  return (
    <section className={sidePanelClass}>
      <span className={eyebrowClass}>Duyệt xóa phiếu</span>
      <h2 className={`${sectionTitleClass} mt-1`}>Kỹ sư yêu cầu xóa</h2>
      <p className="mt-2 rounded-lg border border-[#f3d7d9] bg-[#fff7f7] p-3 text-sm font-medium leading-6 text-[#7a1b22]">
        {reason || 'Không ghi lý do.'}
      </p>
      <div className="mt-4 grid gap-2">
        <button className="primary-button justify-center" disabled={disabled} onClick={onApprove} type="button">
          Duyệt và xóa
        </button>
        <button className="secondary-button justify-center" disabled={disabled} onClick={onReject} type="button">
          Không duyệt
        </button>
      </div>
    </section>
  );
}
