import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { Notice } from '../../components/Notice';

export function AccessDeniedPage({ message }: { message: string }) {
  return (
    <PageFrame>
      <PageTitle eyebrow="Phân quyền" title="Không có quyền truy cập" />
      <Notice message={message || 'Tài khoản hiện tại chưa được mở quyền cho màn này.'} />
    </PageFrame>
  );
}
