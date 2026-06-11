import { Brand } from '../Brand';

export function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center gap-3 bg-[#f4f7fb] p-6">
      <Brand />
      <span>Đang kiểm tra phiên làm việc</span>
    </div>
  );
}
