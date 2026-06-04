import './styles.css';

type BrandProps = {
  compact?: boolean;
  size?: 'default' | 'large';
};

const logoUrl = 'https://cdn.hstatic.net/themes/200001042017/1001404866/14/logo.png?v=1335';

export function Brand({ compact = false, size = 'default' }: BrandProps) {
  return (
    <div className={`${size === 'large' ? 'brand brand-large' : 'brand'}${compact ? ' brand-compact' : ''}`}>
      <div className={size === 'large' ? 'brand-mark brand-mark-large' : 'brand-mark'}>
        <img alt="VietMed" src={logoUrl} />
      </div>
      {compact ? null : (
        <div>
          <strong>{size === 'large' ? 'VietMed Kỹ Thuật' : 'VietMed'}</strong>
          <span>{size === 'large' ? 'Điều phối thiết bị y tế và dịch vụ kỹ thuật' : 'Kỹ thuật'}</span>
        </div>
      )}
    </div>
  );
}
