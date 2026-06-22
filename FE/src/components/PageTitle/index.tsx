type PageTitleProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function PageTitle({ eyebrow, title, description }: PageTitleProps) {
  return (
    <div className="max-w-[760px]">
      <span className="inline-block text-[11px] font-semibold text-[#d71920]">{eyebrow}</span>
      <h1 className="mt-1 text-[27px] font-semibold leading-[1.18] text-[#1f1f1f] max-sm:text-[23px]">{title}</h1>
      <p className="mt-2 max-w-[700px] text-[14px] leading-6 text-[#666666]">{description}</p>
    </div>
  );
}
