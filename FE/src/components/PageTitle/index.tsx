type PageTitleProps = {
  eyebrow: string;
  title: string;
  description?: string;
};

export function PageTitle({ eyebrow, title }: PageTitleProps) {
  return (
    <div className="page-title-card">
      <div className="page-title-card__glow" />
      <div className="relative">
        <span className="page-kicker inline-block">{eyebrow}</span>
        <h1 className="page-heading mt-2">{title}</h1>
      </div>
    </div>
  );
}
