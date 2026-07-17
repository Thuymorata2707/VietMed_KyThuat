type BrandProps = {
  compact?: boolean;
  logoOnly?: boolean;
  size?: 'default' | 'large';
};

const logoUrl = 'https://cdn.hstatic.net/themes/200001042017/1001404866/14/logo.png?v=1335';

export function Brand({ compact = false, logoOnly = false, size = 'default' }: BrandProps) {
  const isLarge = size === 'large';
  const markClass = compact
    ? isLarge
      ? 'h-14 w-[168px]'
      : 'h-[30px] w-[50px]'
    : logoOnly
      ? isLarge
        ? 'h-12 w-[154px]'
        : 'h-10 w-[128px]'
    : isLarge
      ? 'h-11 w-[126px] max-[420px]:h-10 max-[420px]:w-[132px]'
      : 'h-[34px] w-[86px] max-[420px]:h-10 max-[420px]:w-[132px]';

  return (
    <div className={`flex min-w-0 items-center ${logoOnly ? 'justify-center' : isLarge ? 'gap-3.5' : 'gap-2.5'} max-[420px]:items-start max-[420px]:flex-col`}>
      <div className={`${markClass} inline-flex shrink-0 items-center justify-center`}>
        <img alt="VietMed" className={`block h-full w-full object-contain ${logoOnly ? 'object-center' : 'object-left'}`} src={logoUrl} />
      </div>
      {compact || logoOnly ? null : (
        <div>
          <strong className="block whitespace-nowrap text-[15px] font-medium leading-tight text-[#1f1f1f]">{isLarge ? 'VietMed Kỹ Thuật' : 'VietMed'}</strong>
          <span className="block text-[12px] font-medium leading-snug text-[#666666]">{isLarge ? 'Quản lý kỹ thuật và bảo hành' : 'Kỹ thuật'}</span>
        </div>
      )}
    </div>
  );
}
