import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';

export function AccessDeniedPage({ message }: { message: string }) {
  return (
    <PageFrame>
      <PageTitle eyebrow="Phân quyền" title="Không có quyền truy cập" description={message} />
      <Notice message="Backend vẫn là nguồn kiểm soát quyền chính; frontend chỉ ẩn và chặn route để giao diện rõ ràng hơn." />
    </PageFrame>
  );
}
