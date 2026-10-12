import { InfoHint } from '../InfoHint';

type PageTitleProps = {
  eyebrow: string;
  title: string;
  description?: string;
  meta?: string;
};

export function PageTitle({ eyebrow, title, description, meta }: PageTitleProps) {
  return (
    <div className="page-title-card">
      <div className="page-title-card__glow" />
      <div className="relative">
        <span className="page-kicker inline-block">{eyebrow}</span>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h1 className="page-heading mt-2">{title}</h1>
          {meta ? <span className="mt-2 inline-flex items-center rounded-md bg-[#eef2f6] px-2 py-1 text-xs font-semibold text-[#475467]">{meta}</span> : null}
          {description ? <InfoHint content={description} label={title} /> : null}
        </div>
      </div>
    </div>
  );
}
