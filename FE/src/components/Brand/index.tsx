type BrandProps = {
  compact?: boolean;
  size?: 'default' | 'large';
};

const logoUrl = 'https://cdn.hstatic.net/themes/200001042017/1001404866/14/logo.png?v=1335';

export function Brand({ compact = false, size = 'default' }: BrandProps) {
  const isLarge = size === 'large';
  const markClass = compact
    ? isLarge
      ? 'h-14 w-[168px]'
      : 'h-[30px] w-[50px]'
    : isLarge
      ? 'h-11 w-[126px] max-[420px]:h-10 max-[420px]:w-[132px]'
      : 'h-[34px] w-[86px] max-[420px]:h-10 max-[420px]:w-[132px]';

  return (
    <div className={`flex min-w-0 items-center ${isLarge ? 'gap-3.5' : 'gap-2.5'} max-[420px]:items-start max-[420px]:flex-col`}>
      <div className={`${markClass} inline-flex shrink-0 items-center justify-center`}>
        <img alt="VietMed" className="block h-full w-full object-contain object-left" src={logoUrl} />
      </div>
      {compact ? null : (
        <div>
          <strong className="block whitespace-nowrap text-[15px] font-medium leading-tight text-[#101828]">{isLarge ? 'VietMed Kỹ Thuật' : 'VietMed'}</strong>
          <span className="block text-[12px] font-medium leading-snug text-[#667085]">{isLarge ? 'Điều phối thiết bị y tế và dịch vụ kỹ thuật' : 'Kỹ thuật'}</span>
        </div>
      )}
    </div>
  );
}
