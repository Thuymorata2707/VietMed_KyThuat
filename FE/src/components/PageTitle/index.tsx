type PageTitleProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function PageTitle({ eyebrow, title, description }: PageTitleProps) {
  return (
    <div className="max-w-[820px]">
      <span className="page-kicker inline-block">{eyebrow}</span>
      <h1 className="page-heading mt-1.5">{title}</h1>
      <p className="page-description mt-3">{description}</p>
    </div>
  );
}
