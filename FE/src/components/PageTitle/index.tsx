type PageTitleProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function PageTitle({ eyebrow, title, description }: PageTitleProps) {
  return (
    <div className="max-w-[760px]">
      <span className="inline-block text-xs font-extrabold uppercase text-[#657384]">{eyebrow}</span>
      <h1 className="mt-1.5 text-[32px] font-bold leading-[1.15] text-[#111827] max-sm:text-[26px]">{title}</h1>
      <p className="mt-2.5 leading-relaxed text-[#657384]">{description}</p>
    </div>
  );
}
