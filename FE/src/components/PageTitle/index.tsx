type PageTitleProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function PageTitle({ eyebrow, title, description }: PageTitleProps) {
  return (
    <div className="relative w-full max-w-[880px] overflow-hidden rounded-[24px] border border-[#f5c7cb] bg-[#fff7f8] p-5 shadow-[0_18px_48px_rgba(215,25,32,0.09)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_6%_12%,rgba(215,25,32,0.13),transparent_30%),radial-gradient(circle_at_92%_10%,rgba(255,255,255,0.92),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.9),rgba(255,247,248,0.76))]" />
      <div className="relative">
        <span className="page-kicker inline-block">{eyebrow}</span>
        <h1 className="page-heading mt-1.5">{title}</h1>
        <p className="page-description mt-3">{description}</p>
      </div>
    </div>
  );
}
