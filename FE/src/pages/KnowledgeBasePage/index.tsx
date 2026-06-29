import { AlertTriangle, BookOpenCheck, Boxes, ClipboardCheck, Clock3, FileText, PackageCheck, Search, ShieldCheck, Wrench } from 'lucide-react';
import { ReactNode, useMemo, useState } from 'react';
import { PageFrame } from '../../components/PageFrame';

type ExperienceCategory = 'common-faults' | 'packing' | 'repair' | 'installation' | 'maintenance' | 'safety';

type ExperienceArticle = {
  id: string;
  category: ExperienceCategory;
  title: string;
  summary: string;
  modelHint: string;
  owner: string;
  updatedAt: string;
  readMinutes: number;
  tags: string[];
  symptoms?: string[];
  steps: string[];
  checklist: string[];
  note: string;
};

const categoryMeta: Record<ExperienceCategory, { label: string; shortLabel: string; icon: ReactNode; tone: string }> = {
  'common-faults': {
    label: 'Lỗi thường gặp',
    shortLabel: 'Lỗi',
    icon: <AlertTriangle size={18} />,
    tone: 'bg-[#fff7f8] text-[#b5121b] border-[#f5c7cb]',
  },
  packing: {
    label: 'Quy trình đóng hàng',
    shortLabel: 'Đóng hàng',
    icon: <Boxes size={18} />,
    tone: 'bg-[#f7fbff] text-[#155e8a] border-[#cfe7f7]',
  },
  repair: {
    label: 'Quy trình sửa chữa',
    shortLabel: 'Sửa chữa',
    icon: <Wrench size={18} />,
    tone: 'bg-[#fff9ed] text-[#9a5b00] border-[#f4ddb5]',
  },
  installation: {
    label: 'Quy trình lắp đặt',
    shortLabel: 'Lắp đặt',
    icon: <PackageCheck size={18} />,
    tone: 'bg-[#f3fbf6] text-[#197044] border-[#ccebd8]',
  },
  maintenance: {
    label: 'Bảo trì định kỳ',
    shortLabel: 'Bảo trì',
    icon: <ClipboardCheck size={18} />,
    tone: 'bg-[#f8f6ff] text-[#5840a6] border-[#ddd5ff]',
  },
  safety: {
    label: 'An toàn & bàn giao',
    shortLabel: 'An toàn',
    icon: <ShieldCheck size={18} />,
    tone: 'bg-[#f7f7f7] text-[#444444] border-[#dddddd]',
  },
};

const articles: ExperienceArticle[] = [
  {
    id: 'bc-series-sample-clog',
    category: 'common-faults',
    title: 'Máy xét nghiệm huyết học báo tắc kim hút mẫu',
    summary: 'Cách khoanh vùng lỗi khi BC series báo tắc, hút mẫu yếu hoặc kết quả bất thường.',
    modelHint: 'BC-20s, BC-30s, BC-60s, BC-6800',
    owner: 'Nhóm xét nghiệm',
    updatedAt: '2026-06-20',
    readMinutes: 6,
    tags: ['Huyết học', 'Mindray', 'Kim hút mẫu'],
    symptoms: ['Máy báo clog/aperture block.', 'Mẫu hút chậm hoặc không đủ thể tích.', 'Kết quả WBC/RBC/PLT dao động bất thường.'],
    steps: [
      'Hỏi khách hàng thời điểm phát sinh lỗi và loại mẫu chạy gần nhất.',
      'Kiểm tra hóa chất, mức dung dịch rửa, đường ống xả và bình thải.',
      'Chạy quy trình probe cleanser theo hướng dẫn từng model.',
      'Kiểm tra kim hút mẫu, tubing và bơm định lượng nếu lỗi lặp lại.',
      'Chạy QC sau xử lý và lưu ảnh màn hình kết quả vào phiếu.',
    ],
    checklist: ['Găng tay, khăn thấm, dung dịch rửa.', 'Ảnh cảnh báo lỗi trước/sau xử lý.', 'Kết quả QC hoặc mẫu kiểm chứng.'],
    note: 'Không tháo cụm kim khi chưa xả áp và chưa ghi nhận tình trạng ban đầu.',
  },
  {
    id: 'ultrasound-no-image',
    category: 'common-faults',
    title: 'Máy siêu âm mất hình hoặc nhiễu mạnh',
    summary: 'Checklist nhanh để phân biệt lỗi đầu dò, cổng probe, setting hoặc bo xử lý hình ảnh.',
    modelHint: 'HD-350, X-CUBE 50, P series',
    owner: 'Nhóm CĐHA',
    updatedAt: '2026-06-18',
    readMinutes: 5,
    tags: ['Siêu âm', 'Đầu dò', 'Hình ảnh'],
    symptoms: ['Màn hình có sọc/nhiễu.', 'Một đầu dò mất hình, đầu dò khác bình thường.', 'Freeze hoặc gain không phản hồi ổn định.'],
    steps: [
      'Chụp lại preset, đầu dò đang dùng và tình trạng hình ảnh.',
      'Đổi đầu dò sang cổng khác nếu máy có nhiều cổng.',
      'Kiểm tra chân connector, khóa đầu dò và vết nứt cáp.',
      'Reset preset hoặc thử exam type khác để loại trừ setting.',
      'Nếu nhiều đầu dò cùng lỗi, kiểm tra log và bo xử lý theo service manual.',
    ],
    checklist: ['Ảnh connector đầu dò.', 'Video ngắn mô tả nhiễu.', 'Tên preset và phiên bản phần mềm.'],
    note: 'Không kéo cáp đầu dò khi đầu dò còn khóa trên cổng máy.',
  },
  {
    id: 'packing-ultrasound-machine',
    category: 'packing',
    title: 'Đóng hàng máy siêu âm dạng trolley',
    summary: 'Quy trình đóng máy trước khi chuyển kho, chuyển tỉnh hoặc gửi bảo hành.',
    modelHint: 'Máy siêu âm có trolley',
    owner: 'Kho máy',
    updatedAt: '2026-06-15',
    readMinutes: 7,
    tags: ['Đóng hàng', 'Siêu âm', 'Trolley'],
    steps: [
      'Tắt máy đúng quy trình, rút nguồn và chờ máy nguội.',
      'Tháo đầu dò, bọc riêng từng đầu dò bằng túi chống sốc.',
      'Cố định màn hình, bàn phím, bánh xe và các khay phụ kiện.',
      'Bọc thân máy bằng màng PE, foam góc và lớp chống ẩm.',
      'Dán tem hướng đặt, tem dễ vỡ và ghi rõ danh sách phụ kiện đi kèm.',
    ],
    checklist: ['Biên bản tình trạng máy.', 'Ảnh 4 mặt trước khi đóng.', 'Danh sách đầu dò/phụ kiện.', 'Tem serial ngoài kiện.'],
    note: 'Đầu dò luôn đi hộp riêng hoặc khoang riêng, không đặt đè lên thân máy.',
  },
  {
    id: 'repair-before-onsite',
    category: 'repair',
    title: 'Chuẩn bị trước khi đi sửa chữa onsite',
    summary: 'Các bước cần có trước khi kỹ sư xuất phát để tránh thiếu linh kiện và thiếu thông tin lỗi.',
    modelHint: 'Tất cả model',
    owner: 'Điều phối kỹ thuật',
    updatedAt: '2026-06-12',
    readMinutes: 4,
    tags: ['Onsite', 'Sửa chữa', 'Chuẩn bị'],
    steps: [
      'Đọc phiếu lỗi, lịch sử bảo trì và lịch sử thay linh kiện của máy.',
      'Gọi xác nhận người phụ trách tại bệnh viện và thời gian được phép thao tác.',
      'Chuẩn bị linh kiện nghi ngờ, cáp, dụng cụ đo và vật tư tiêu hao.',
      'Kiểm tra phiên bản phần mềm hoặc tài liệu service cần mang theo.',
      'Cập nhật trạng thái di chuyển để admin và khách hàng theo dõi.',
    ],
    checklist: ['Phiếu lỗi.', 'Serial/model máy.', 'Dụng cụ đo.', 'Linh kiện nghi ngờ.', 'Thông tin liên hệ khách hàng.'],
    note: 'Nếu lỗi ảnh hưởng vận hành khoa, ưu tiên phương án tạm chạy an toàn trước khi xử lý triệt để.',
  },
  {
    id: 'installation-handover',
    category: 'installation',
    title: 'Lắp đặt và bàn giao máy mới',
    summary: 'Khung thao tác từ nhận mặt bằng, lắp đặt, chạy thử đến ký nghiệm thu.',
    modelHint: 'Máy siêu âm, nội soi, xét nghiệm',
    owner: 'Nhóm lắp đặt',
    updatedAt: '2026-06-10',
    readMinutes: 8,
    tags: ['Lắp đặt', 'Bàn giao', 'Nghiệm thu'],
    steps: [
      'Kiểm tra mặt bằng, nguồn điện, tiếp địa, điều hòa và vị trí đặt máy.',
      'Đối chiếu serial máy, phụ kiện, đầu dò/module với phiếu xuất kho.',
      'Lắp đặt theo thứ tự cơ khí, nguồn, phụ kiện, kết nối mạng nếu có.',
      'Chạy test chức năng chính, in/lưu kết quả mẫu và chụp ảnh hiện trạng.',
      'Hướng dẫn vận hành cơ bản, vệ sinh, tắt mở máy và cảnh báo an toàn.',
      'Ký biên bản bàn giao, nghiệm thu và cập nhật hồ sơ máy.',
    ],
    checklist: ['Biên bản lắp đặt.', 'Ảnh serial.', 'Ảnh vị trí máy.', 'Kết quả test.', 'Thông tin người nhận bàn giao.'],
    note: 'Không nghiệm thu khi nguồn điện hoặc tiếp địa chưa đạt điều kiện tối thiểu.',
  },
  {
    id: 'maintenance-quarterly',
    category: 'maintenance',
    title: 'Bảo trì định kỳ theo quý',
    summary: 'Checklist chung cho các máy đang hoạt động tại khách hàng.',
    modelHint: 'Tất cả model đang vận hành',
    owner: 'Nhóm bảo trì',
    updatedAt: '2026-06-08',
    readMinutes: 5,
    tags: ['Bảo trì', 'Checklist', 'Định kỳ'],
    steps: [
      'Ghi nhận số giờ chạy, số lần test hoặc counter liên quan.',
      'Vệ sinh bề mặt, khe gió, lọc bụi, khu vực lấy mẫu hoặc cổng kết nối.',
      'Kiểm tra cảnh báo tồn đọng, log lỗi và tình trạng phụ kiện tiêu hao.',
      'Chạy kiểm tra chức năng chính theo từng dòng máy.',
      'Khuyến nghị vật tư cần thay trong kỳ tới và cập nhật phiếu bảo trì.',
    ],
    checklist: ['Ảnh trước/sau bảo trì.', 'Log lỗi nếu có.', 'Counter máy.', 'Khuyến nghị vật tư.'],
    note: 'Luôn hỏi khách hàng về lỗi nhỏ lặp lại, vì nhiều lỗi không xuất hiện trong ngày bảo trì.',
  },
  {
    id: 'safety-electrical',
    category: 'safety',
    title: 'An toàn điện trước khi thao tác máy',
    summary: 'Các điểm cần kiểm tra trước khi mở vỏ máy, đo nguồn hoặc thay linh kiện.',
    modelHint: 'Tất cả model',
    owner: 'Quản lý kỹ thuật',
    updatedAt: '2026-06-05',
    readMinutes: 4,
    tags: ['An toàn', 'Nguồn điện', 'Linh kiện'],
    steps: [
      'Tắt máy đúng quy trình và rút nguồn khỏi ổ cắm.',
      'Chờ tụ xả theo khuyến nghị của từng dòng máy.',
      'Dùng đồng hồ đo xác nhận điểm nguồn đã an toàn trước khi chạm tay.',
      'Đeo vòng chống tĩnh điện khi thao tác bo mạch.',
      'Chỉ cấp nguồn lại khi tất cả connector, vỏ che và dây tiếp địa đã đúng vị trí.',
    ],
    checklist: ['Đồng hồ đo.', 'Găng tay phù hợp.', 'Vòng ESD.', 'Ảnh connector trước khi tháo.'],
    note: 'Nếu môi trường ẩm hoặc nguồn không ổn định, dừng thao tác và báo quản lý kỹ thuật.',
  },
];

const allCategoryKey = 'all';

export function KnowledgeBasePage() {
  const [selectedCategory, setSelectedCategory] = useState<ExperienceCategory | typeof allCategoryKey>(allCategoryKey);
  const [query, setQuery] = useState('');
  const [selectedArticleId, setSelectedArticleId] = useState(articles[0]?.id ?? '');

  const filteredArticles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return articles.filter((article) => {
      const matchCategory = selectedCategory === allCategoryKey || article.category === selectedCategory;
      const haystack = [
        article.title,
        article.summary,
        article.modelHint,
        article.owner,
        categoryMeta[article.category].label,
        ...article.tags,
      ].join(' ').toLowerCase();
      return matchCategory && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [query, selectedCategory]);

  const selectedArticle = articles.find((article) => article.id === selectedArticleId) ?? filteredArticles[0] ?? articles[0];
  const totalSteps = articles.reduce((total, article) => total + article.steps.length, 0);
  const activeArticlesByCategory = Object.entries(categoryMeta).map(([key, meta]) => ({
    id: key as ExperienceCategory,
    ...meta,
    count: articles.filter((article) => article.category === key).length,
  }));

  function handleCategorySelect(category: ExperienceCategory | typeof allCategoryKey) {
    setSelectedCategory(category);
    const nextArticle = articles.find((article) => category === allCategoryKey || article.category === category);
    if (nextArticle) setSelectedArticleId(nextArticle.id);
  }

  return (
    <PageFrame>
      <section className="relative overflow-hidden rounded-[30px] border border-[#f5c7cb] bg-[#fff7f8] p-6 shadow-[0_24px_70px_rgba(215,25,32,0.10)] lg:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_10%,rgba(215,25,32,0.14),transparent_30%),radial-gradient(circle_at_88%_12%,rgba(255,255,255,0.92),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.86),rgba(255,247,248,0.78))]" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:items-end">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#f5c7cb] bg-white px-3 py-1 text-xs font-semibold text-[#d71920]">
              <BookOpenCheck size={15} />
              Kinh nghiệm kỹ thuật
            </span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#1f1f1f] md:text-4xl">Sổ tay chia sẻ giữa các kỹ sư</h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-[#555555]">
              Gom lỗi thường gặp, quy trình đóng hàng, sửa chữa, lắp đặt và bàn giao vào một nơi để đội kỹ thuật tra nhanh khi cần.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <KnowledgeMetric label="Chủ đề" value={activeArticlesByCategory.length} />
            <KnowledgeMetric label="Bài viết" value={articles.length} />
            <KnowledgeMetric label="Bước xử lý" value={totalSteps} />
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="grid content-start gap-4 rounded-2xl border border-[#e8edf3] bg-white p-4 shadow-[0_14px_36px_rgba(20,32,51,0.06)] lg:sticky lg:top-4">
          <label className="flex h-11 items-center gap-2 rounded-xl border border-[#d9e0e8] bg-[#fafafa] px-3 text-[#666666] focus-within:border-[#d71920] focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(215,25,32,0.12)]">
            <Search size={16} />
            <input
              className="min-w-0 flex-1 border-0 bg-transparent text-sm text-[#1f1f1f] outline-none"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm lỗi, model, quy trình"
              value={query}
            />
          </label>

          <div className="grid gap-2">
            <CategoryButton
              active={selectedCategory === allCategoryKey}
              count={articles.length}
              icon={<BookOpenCheck size={18} />}
              label="Tất cả kinh nghiệm"
              onClick={() => handleCategorySelect(allCategoryKey)}
            />
            {activeArticlesByCategory.map((category) => (
              <CategoryButton
                active={selectedCategory === category.id}
                count={category.count}
                icon={category.icon}
                key={category.id}
                label={category.label}
                onClick={() => handleCategorySelect(category.id)}
              />
            ))}
          </div>

          <div className="rounded-2xl border border-dashed border-[#f5c7cb] bg-[#fffafa] p-4 text-sm text-[#666666]">
            <strong className="block text-[#1f1f1f]">Gợi ý bước sau</strong>
            Sau khi thống nhất mẫu, có thể thêm nút Add/Edit để kỹ sư tự đóng góp kinh nghiệm và admin duyệt trước khi hiển thị.
          </div>
        </aside>

        <div className="grid min-w-0 gap-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredArticles.map((article) => (
              <ArticleCard
                active={article.id === selectedArticle?.id}
                article={article}
                key={article.id}
                onClick={() => setSelectedArticleId(article.id)}
              />
            ))}
          </div>

          {filteredArticles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#d7e0eb] bg-[#fbfdff] p-8 text-center text-sm text-[#666666]">
              Không có kinh nghiệm phù hợp. Thử đổi từ khóa hoặc chọn lại nhóm chủ đề.
            </div>
          ) : null}

          {selectedArticle ? <ArticleDetail article={selectedArticle} /> : null}
        </div>
      </section>
    </PageFrame>
  );
}

function KnowledgeMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-[0_12px_28px_rgba(215,25,32,0.08)]">
      <span className="text-xs font-semibold text-[#777777]">{label}</span>
      <strong className="mt-1 block text-2xl font-semibold text-[#1f1f1f]">{value}</strong>
    </div>
  );
}

function CategoryButton({
  active,
  count,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border px-3 text-left text-sm font-semibold transition active:translate-y-px ${
        active
          ? 'border-[#f5c7cb] bg-[#fff7f8] text-[#d71920] shadow-[0_10px_24px_rgba(215,25,32,0.10)]'
          : 'border-[#eef1f5] bg-white text-[#444444] hover:border-[#f5c7cb] hover:text-[#d71920]'
      }`}
      onClick={onClick}
      type="button"
    >
      <span className="flex min-w-0 items-center gap-2">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <span className="rounded-full bg-[#f4f5f7] px-2 py-0.5 text-xs text-[#666666]">{count}</span>
    </button>
  );
}

function ArticleCard({ active, article, onClick }: { active: boolean; article: ExperienceArticle; onClick: () => void }) {
  const meta = categoryMeta[article.category];
  return (
    <button
      className={`grid min-h-[210px] content-between rounded-2xl border bg-white p-4 text-left shadow-[0_10px_28px_rgba(20,32,51,0.05)] transition hover:-translate-y-0.5 hover:border-[#f5c7cb] hover:shadow-[0_18px_42px_rgba(215,25,32,0.10)] active:translate-y-px ${
        active ? 'border-[#d71920] ring-4 ring-[#fff0f1]' : 'border-[#e8edf3]'
      }`}
      onClick={onClick}
      type="button"
    >
      <div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.tone}`}>
          {meta.icon}
          {meta.shortLabel}
        </span>
        <h2 className="mt-3 line-clamp-2 text-lg font-semibold leading-snug text-[#1f1f1f]">{article.title}</h2>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#666666]">{article.summary}</p>
      </div>
      <div className="mt-4 grid gap-3">
        <div className="flex flex-wrap gap-1.5">
          {article.tags.slice(0, 3).map((tag) => (
            <span className="rounded-full bg-[#f5f6f8] px-2 py-1 text-[11px] font-medium text-[#666666]" key={tag}>
              {tag}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 text-xs font-medium text-[#777777]">
          <span className="truncate">{article.modelHint}</span>
          <span className="inline-flex shrink-0 items-center gap-1">
            <Clock3 size={13} />
            {article.readMinutes} phút
          </span>
        </div>
      </div>
    </button>
  );
}

function ArticleDetail({ article }: { article: ExperienceArticle }) {
  const meta = categoryMeta[article.category];
  return (
    <article className="overflow-hidden rounded-[26px] border border-[#e8edf3] bg-white shadow-[0_18px_50px_rgba(20,32,51,0.08)]">
      <div className="grid gap-4 border-b border-[#edf0f4] bg-[#fbfcfd] p-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.tone}`}>
            {meta.icon}
            {meta.label}
          </span>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#1f1f1f]">{article.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#666666]">{article.summary}</p>
        </div>
        <div className="grid content-start gap-2 rounded-2xl border border-[#e8edf3] bg-white p-4 text-sm">
          <InfoLine label="Model" value={article.modelHint} />
          <InfoLine label="Nhóm" value={article.owner} />
          <InfoLine label="Cập nhật" value={formatDate(article.updatedAt)} />
        </div>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-5">
          {article.symptoms?.length ? (
            <SectionBlock icon={<AlertTriangle size={18} />} title="Dấu hiệu nhận biết">
              <ul className="grid gap-2">
                {article.symptoms.map((symptom) => (
                  <li className="rounded-xl border border-[#f0d9dc] bg-[#fff8f8] px-3 py-2 text-sm text-[#555555]" key={symptom}>
                    {symptom}
                  </li>
                ))}
              </ul>
            </SectionBlock>
          ) : null}

          <SectionBlock icon={<FileText size={18} />} title="Quy trình xử lý">
            <ol className="grid gap-3">
              {article.steps.map((step, index) => (
                <li className="grid grid-cols-[34px_minmax(0,1fr)] gap-3 rounded-2xl border border-[#edf0f4] bg-white p-3" key={step}>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d71920] text-sm font-semibold text-white">{index + 1}</span>
                  <span className="self-center text-sm leading-6 text-[#444444]">{step}</span>
                </li>
              ))}
            </ol>
          </SectionBlock>
        </div>

        <aside className="grid content-start gap-4">
          <SectionBlock icon={<ClipboardCheck size={18} />} title="Checklist cần mang">
            <ul className="grid gap-2">
              {article.checklist.map((item) => (
                <li className="flex gap-2 rounded-xl bg-[#f7f8fa] px-3 py-2 text-sm text-[#555555]" key={item}>
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d71920]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </SectionBlock>

          <div className="rounded-2xl border border-[#f5c7cb] bg-[#fff7f8] p-4">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#d71920]">Lưu ý</span>
            <p className="mt-2 text-sm leading-6 text-[#555555]">{article.note}</p>
          </div>
        </aside>
      </div>
    </article>
  );
}

function SectionBlock({ children, icon, title }: { children: ReactNode; icon: ReactNode; title: string }) {
  return (
    <section className="rounded-2xl border border-[#edf0f4] bg-white p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1f1f1f]">
        <span className="text-[#d71920]">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-xs font-semibold text-[#777777]">{label}</span>
      <strong className="mt-0.5 block text-sm font-semibold text-[#1f1f1f]">{value}</strong>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}
