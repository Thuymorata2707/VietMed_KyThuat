export const endoscopyAccessoryNames = [
  'Bộ xử lý',
  'Nguồn sáng',
  'Màn hình',
  'Adapter dùng cho màn hình',
  'Cáp kết nối dây soi',
  'Van khí/nước',
  'Van hút dịch',
  'Chổi rửa dài',
  'Chổi rửa ngắn',
  'Kìm sinh thiết',
  'Bịt đầu kênh sinh thiết',
  'Dây tiếp đất',
  'Đầu bịt chống dò rỉ',
  'Bình nước',
  'Bịt đầu dây soi',
  'Đồng hồ thử dò rỉ',
  'Bộ dây rửa dây soi',
  'Xi lanh',
  'Dây nguồn',
  'Cáp kết nối màn hình DVI',
  'Cáp kết nối màn hình HDMI',
  'Cầu chì',
  'Dụng cụ cân bằng trắng',
  'Giá đỡ cáp kết nối',
  'Bàn phím',
  'Dây video',
  'Xe đẩy SX tại VN',
  'Xe đẩy nhập khẩu',
  'Card HDMI kèm dây kết nối',
  'Card Video kèm dây kết nối',
  'Dây HDMI loại',
  'Sách HDSD Tiếng Anh',
  'Sách HDSD Tiếng Việt',
  'HDSD nhanh',
  'Ngáng miệng',
  'Chậu rửa dây soi',
  'Gioăng chống trượt',
  'Tem BH/hotline',
] as const;

export const endoscopyAccessoryOptions = endoscopyAccessoryNames.map((name) => ({
  label: name,
  value: name,
}));

export const endoscopyAccessoriesWithModel = new Set<string>([
  'Bộ xử lý',
  'Nguồn sáng',
  'Màn hình',
]);

export function isEndoscopyMachineModel(model?: {
  code?: string | null;
  name?: string | null;
  displayName?: string | null;
  productCategory?: string | null;
  businessLine?: { productCategory?: string | null } | null;
} | null) {
  if (!model) return false;
  const category = model.productCategory ?? model.businessLine?.productCategory;
  if (category === 'ENDOSCOPY') return true;

  const modelText = [model.code, model.name, model.displayName].filter(Boolean).join(' ').toUpperCase();
  return /\b(ENDOSCOPY|NOI SOI|NỘI SOI|GASTRO|COLONO|DUODENO|BRONCHO|FUJIFILM|OLYMPUS|PENTAX)\b/.test(modelText);
}
