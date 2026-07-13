import { Bell, ChevronsLeft, ChevronsRight, LogOut, Plus } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ApiUser, apiFetch, clearToken, getApiBaseUrl, getToken } from '../../api';
import { getRoleName, roleLabel } from '../../auth/roles';
import { Brand } from '../../components/Brand';
import { RequireRole } from '../../components/RequireRole';
import { navGroupsForRole, navItemsForRole } from '../../config/navigation';
import { resources } from '../../config/resources';
import { adminCrudConfigs } from '../../config/adminCrud';
import { queryClient } from '../../lib/queryClient';
import { queryKeys } from '../../lib/queryKeys';
import { initials } from '../../utils/format';

const AccessDeniedPage = lazy(() => import('../../pages/AccessDeniedPage').then((module) => ({ default: module.AccessDeniedPage })));
const AccountSettingsPage = lazy(() => import('../../pages/AccountSettingsPage').then((module) => ({ default: module.AccountSettingsPage })));
const AdminCrudFormPage = lazy(() => import('../../pages/AdminCrudPage').then((module) => ({ default: module.AdminCrudFormPage })));
const AdminCrudPage = lazy(() => import('../../pages/AdminCrudPage').then((module) => ({ default: module.AdminCrudPage })));
const AdminRegionsPage = lazy(() => import('../../pages/AdminRegionsPage').then((module) => ({ default: module.AdminRegionsPage })));
const AdminRolesPage = lazy(() => import('../../pages/AdminRolesPage').then((module) => ({ default: module.AdminRolesPage })));
const AdminUsersPage = lazy(() => import('../../pages/AdminUsersPage').then((module) => ({ default: module.AdminUsersPage })));
const AdminWorkAssignmentPage = lazy(() => import('../../pages/AdminWorkAssignmentPage').then((module) => ({ default: module.AdminWorkAssignmentPage })));
const DashboardPage = lazy(() => import('../../pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const DailyReportsPage = lazy(() => import('../../pages/DailyReportsPage').then((module) => ({ default: module.DailyReportsPage })));
const DailyWorkCalendarPage = lazy(() => import('../../pages/DailyWorkCalendarPage').then((module) => ({ default: module.DailyWorkCalendarPage })));
const EngineerPerformancePage = lazy(() => import('../../pages/EngineerPerformancePage').then((module) => ({ default: module.EngineerPerformancePage })));
const EngineerCustomersPage = lazy(() => import('../../pages/EngineerCustomersPage').then((module) => ({ default: module.EngineerCustomersPage })));
const EngineerTasksPage = lazy(() => import('../../pages/EngineerTasksPage').then((module) => ({ default: module.EngineerTasksPage })));
const InstallationUpdatePage = lazy(() => import('../../pages/InstallationUpdatePage').then((module) => ({ default: module.InstallationUpdatePage })));
const InventoryMovementsPage = lazy(() => import('../../pages/InventoryMovementsPage').then((module) => ({ default: module.InventoryMovementsPage })));
const KnowledgeBasePage = lazy(() => import('../../pages/KnowledgeBasePage').then((module) => ({ default: module.KnowledgeBasePage })));
const MaintenanceUpdatePage = lazy(() => import('../../pages/MaintenanceUpdatePage').then((module) => ({ default: module.MaintenanceUpdatePage })));
const ProductAddPage = lazy(() => import('../../pages/ProductCatalogPage').then((module) => ({ default: module.ProductAddPage })));
const ProductCatalogPage = lazy(() => import('../../pages/ProductCatalogPage').then((module) => ({ default: module.ProductCatalogPage })));
const ProductCatalogPortalPage = lazy(() => import('../../pages/ProductCatalogPortalPage').then((module) => ({ default: module.ProductCatalogPortalPage })));
const ProductIndustryModelsPage = lazy(() => import('../../pages/ProductCatalogPortalPage').then((module) => ({ default: module.ProductIndustryModelsPage })));
const ProductModelDetailPage = lazy(() => import('../../pages/ProductCatalogPage').then((module) => ({ default: module.ProductModelDetailPage })));
const RepairUpdatePage = lazy(() => import('../../pages/RepairUpdatePage').then((module) => ({ default: module.RepairUpdatePage })));
const ReportsPage = lazy(() => import('../../pages/ReportsPage').then((module) => ({ default: module.ReportsPage })));
const ResourcePage = lazy(() => import('../../pages/ResourcePage').then((module) => ({ default: module.ResourcePage })));
const ServiceTicketCreatePage = lazy(() => import('../../pages/ServiceTicketCreatePage').then((module) => ({ default: module.ServiceTicketCreatePage })));
const ServiceTicketsPage = lazy(() => import('../../pages/ServiceTicketsPage').then((module) => ({ default: module.ServiceTicketsPage })));
const InstallationsPage = lazy(() => import('../../pages/ServiceTicketsPage').then((module) => ({ default: module.InstallationsPage })));
const TechnicalMachinesPage = lazy(() => import('../../pages/TechnicalMachinesPage').then((module) => ({ default: module.TechnicalMachinesPage })));
const TechnicalStatisticsPage = lazy(() => import('../../pages/TechnicalStatisticsPage').then((module) => ({ default: module.TechnicalStatisticsPage })));
const WeeklyReportsPage = lazy(() => import('../../pages/WeeklyReportsPage').then((module) => ({ default: module.WeeklyReportsPage })));

type AppShellProps = {
  user: ApiUser;
  onLogout: () => void;
  onUserUpdated: (user: ApiUser) => void;
};

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  href?: string | null;
  readAt?: string | null;
  createdAt: string;
  createdBy?: { fullName?: string | null; email?: string | null } | null;
};

export function AppShell({ user, onLogout, onUserUpdated }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const notificationsQuery = useQuery({
    queryKey: queryKeys.notifications.list,
    queryFn: () => apiFetch<NotificationItem[]>('/notifications?limit=50'),
    refetchInterval: 15_000,
  });
  const notifications = notificationsQuery.data ?? [];
  const markNotificationReadMutation = useMutation({
    mutationFn: (notificationId: string) => apiFetch(`/notifications/${notificationId}/read`, { method: 'PATCH' }),
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.list });
      const previous = queryClient.getQueryData<NotificationItem[]>(queryKeys.notifications.list);
      queryClient.setQueryData<NotificationItem[]>(queryKeys.notifications.list, (current = []) =>
        current.map((item) => (item.id === notificationId ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item)),
      );
      return { previous };
    },
    onError: (_error, _notificationId, context) => {
      queryClient.setQueryData(queryKeys.notifications.list, context?.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list });
    },
  });
  const markAllNotificationsReadMutation = useMutation({
    mutationFn: () => apiFetch('/notifications/read-all', { method: 'PATCH' }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.list });
      const previous = queryClient.getQueryData<NotificationItem[]>(queryKeys.notifications.list);
      const now = new Date().toISOString();
      queryClient.setQueryData<NotificationItem[]>(queryKeys.notifications.list, (current = []) =>
        current.map((item) => ({ ...item, readAt: item.readAt ?? now })),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(queryKeys.notifications.list, context?.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list });
    },
  });
  const role = getRoleName(user);
  const visibleNavItems = navItemsForRole(role);
  const visibleNavGroups = navGroupsForRole(role);
  const activeNavItem = visibleNavItems.find((item) =>
    item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path),
  );
  const pageTitle = location.pathname.startsWith('/account-settings')
    ? 'Thiết lập tài khoản'
    : location.pathname.startsWith('/technical-machines')
      ? 'Máy phòng kỹ thuật'
    : location.pathname.startsWith('/customers/profile')
      ? 'Hồ sơ khách hàng'
    : location.pathname.startsWith('/knowledge-base')
      ? 'Chia sẻ kinh nghiệm'
    : location.pathname.startsWith('/technical-statistics')
      ? 'Thống kê kỹ thuật'
    : location.pathname.startsWith('/reports')
      ? 'Báo cáo'
    : location.pathname.startsWith('/my-reports')
      ? 'Báo cáo của tôi'
    : location.pathname.startsWith('/my-customers')
      ? 'Khách hàng phụ trách'
    : activeNavItem?.label || 'Tổng quan';
  const unreadCount = useMemo(() => notifications.filter((item) => !item.readAt).length, [notifications]);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const url = `${getApiBaseUrl()}/notifications/stream?token=${encodeURIComponent(token)}`;
    const events = new EventSource(url);

    function refreshRealtimeQueries() {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'overview'] });
      void queryClient.invalidateQueries({ queryKey: ['work-assignments', 'dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['daily-work', 'notes'] });
      void queryClient.invalidateQueries({ queryKey: ['daily-reports', 'report'] });
      void queryClient.invalidateQueries({ queryKey: ['weekly-reports', 'report'] });
      void queryClient.invalidateQueries({ queryKey: ['weekly-reports', 'daily-rows'] });
      void queryClient.invalidateQueries({ queryKey: ['weekly-reports', 'ticket-rows'] });
      void queryClient.invalidateQueries({ queryKey: ['knowledge', 'articles'] });
      void queryClient.invalidateQueries({ queryKey: ['work-operations', 'used-parts-summary'] });
    }

    events.addEventListener('notification', refreshRealtimeQueries);
    events.onerror = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list });
    };

    return () => {
      events.removeEventListener('notification', refreshRealtimeQueries);
      events.close();
    };
  }, [user.id]);

  useEffect(() => {
    if (!isNotificationOpen) {
      return;
    }

    function closeNotificationOnOutsideClick(event: PointerEvent) {
      const target = event.target;

      if (target instanceof Node && notificationRef.current?.contains(target)) {
        return;
      }

      setIsNotificationOpen(false);
    }

    document.addEventListener('pointerdown', closeNotificationOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeNotificationOnOutsideClick);
  }, [isNotificationOpen]);

  function logout() {
    clearToken();
    queryClient.clear();
    onLogout();
    navigate('/login');
  }

  async function openNotification(notification: NotificationItem) {
    if (!notification.readAt) {
      await markNotificationReadMutation.mutateAsync(notification.id).catch(() => null);
    }

    setIsNotificationOpen(false);
    if (notification.href) {
      navigate(notification.href);
    }
  }

  async function markAllNotificationsRead() {
    await markAllNotificationsReadMutation.mutateAsync().catch(() => null);
  }

  return (
    <div className={`app-shell grid min-h-screen w-full overflow-x-hidden transition-[grid-template-columns] duration-200 max-[980px]:grid-cols-1 min-[981px]:h-screen min-[981px]:overflow-hidden ${isSidebarCollapsed ? 'grid-cols-[82px_minmax(0,1fr)]' : 'grid-cols-[280px_minmax(0,1fr)]'}`}>
      <aside className={`app-sidebar flex h-screen flex-col overflow-y-auto overscroll-contain border-r border-[#e4e4e7] px-4 py-5 shadow-[1px_0_0_rgba(24,24,27,0.03)] max-[980px]:static max-[980px]:h-auto max-[980px]:overflow-visible max-[980px]:border-b max-[980px]:border-r-0 max-[980px]:p-4 ${isSidebarCollapsed ? 'items-center gap-5 px-3.5 max-[980px]:items-stretch max-[980px]:gap-4' : 'gap-5 max-[980px]:gap-4'}`}>
        <div className={`flex min-w-0 items-center gap-2.5 ${isSidebarCollapsed ? 'grid justify-items-center' : 'justify-between'} max-[980px]:flex max-[980px]:justify-between`}>
          <Brand compact={isSidebarCollapsed} />
          <button
            aria-label={isSidebarCollapsed ? 'Mở rộng thanh menu' : 'Thu gọn thanh menu'}
            className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border border-[#e5e5e5] bg-white text-[#333333] shadow-[0_1px_2px_rgba(24,24,27,0.05)] hover:border-[#e4e4e7] hover:bg-[#f4f4f5] hover:text-[#18181b] max-[980px]:hidden"
            onClick={() => setIsSidebarCollapsed((current) => !current)}
            title={isSidebarCollapsed ? 'Mở rộng' : 'Thu gọn'}
            type="button"
          >
            {isSidebarCollapsed ? <ChevronsRight size={17} /> : <ChevronsLeft size={17} />}
          </button>
        </div>

        <nav className={`${isSidebarCollapsed ? 'grid w-full justify-items-center gap-2' : 'grid gap-4'} max-[980px]:flex max-[980px]:justify-start max-[980px]:gap-2.5 max-[980px]:overflow-x-auto`}>
          {visibleNavGroups.map((group) => (
            <div className={`${isSidebarCollapsed ? 'contents' : 'grid gap-1.5'} max-[980px]:contents`} key={group.label}>
              <span className={`${isSidebarCollapsed ? 'hidden' : 'px-3 text-[12px] font-medium text-[#8a8a8a]'} max-[980px]:hidden`}>{group.label}</span>
              <div className={`${isSidebarCollapsed ? 'contents' : 'grid gap-1'} max-[980px]:flex max-[980px]:gap-2`}>
                {group.items.map((item) => {
                  const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
                  return (
                    <Link
                      className={`relative flex min-h-[42px] items-center rounded-lg text-[14px] font-medium text-[#71717a] transition hover:bg-[#f4f4f5] hover:text-[#18181b] max-[980px]:shrink-0 max-[980px]:gap-2.5 max-[980px]:px-3 ${
                        isActive ? 'bg-[#f4f4f5] text-[#18181b] shadow-[inset_0_0_0_1px_rgba(228,228,231,0.95),0_8px_22px_rgba(24,24,27,0.05)] before:absolute before:left-0 before:h-[18px] before:w-[3px] before:rounded-full before:bg-[#18181b]' : ''
                      } ${isSidebarCollapsed ? 'h-[42px] w-[42px] justify-center gap-0 px-0 max-[980px]:w-auto max-[980px]:justify-start max-[980px]:px-3' : 'gap-2.5 px-3'}`}
                      key={item.path}
                      title={item.label}
                      to={item.path}
                    >
                      {item.icon}
                      <span className={`transition ${isSidebarCollapsed ? 'w-0 overflow-hidden opacity-0 max-[980px]:w-auto max-[980px]:opacity-100' : ''}`}>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className={`mt-auto grid gap-2 border-t border-[#e5e5e5] pt-[18px] max-[980px]:hidden ${isSidebarCollapsed ? 'w-full justify-items-center' : ''}`}>
          <Link className={`grid items-center gap-2.5 rounded-lg p-1.5 hover:bg-white ${isSidebarCollapsed ? 'flex h-[42px] w-[42px] justify-center p-0' : 'grid-cols-[40px_minmax(0,1fr)]'}`} title="Thiết lập tài khoản" to="/account-settings">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e5e5e5] bg-white text-[13px] font-medium text-[#1f1f1f]">{initials(user.fullName || user.email)}</div>
            <div>
              <strong className={`block overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-[#1f1f1f] ${isSidebarCollapsed ? 'w-0 opacity-0' : ''}`}>{user.fullName || user.email}</strong>
              <span className={`block overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-medium text-[#666666] ${isSidebarCollapsed ? 'w-0 opacity-0' : ''}`}>{roleLabel(role)}</span>
            </div>
          </Link>
          <button className={`inline-flex min-h-10 items-center justify-center rounded-lg bg-transparent px-2.5 text-[14px] font-medium text-[#555555] hover:bg-white hover:text-[#18181b] ${isSidebarCollapsed ? 'h-[42px] w-[42px] px-0' : 'gap-2'}`} onClick={logout} title="Đăng xuất" type="button">
            <LogOut size={17} />
            <span className={`transition ${isSidebarCollapsed ? 'w-0 overflow-hidden opacity-0' : ''}`}>Đăng xuất</span>
          </button>
        </div>
      </aside>

      <main ref={mainRef} id="main-content" className="min-w-0 overflow-x-hidden overscroll-contain bg-transparent [&>*]:min-w-0 min-[981px]:h-screen min-[981px]:overflow-y-auto">
        <header className="app-header sticky top-0 z-[2] flex min-h-[66px] items-center justify-between border-b border-[#e4e4e7] px-6 backdrop-blur-md backdrop-saturate-150 [transform:translateZ(0)] [will-change:transform] max-sm:flex-col max-sm:items-start max-sm:gap-3 max-sm:p-4">
          <div className="min-w-0">
            <span className="block text-[12px] font-medium text-[#666666]">VietMed Kỹ Thuật</span>
            <strong className="block text-[18px] leading-tight text-[#1f1f1f]">{pageTitle}</strong>
          </div>
          <div className="flex items-center gap-2.5 max-sm:w-full max-sm:flex-wrap">
            <Link
              className="inline-flex min-h-[38px] items-center justify-center gap-2 rounded-lg bg-[#18212f] px-3.5 text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(24,24,27,0.14)] transition hover:-translate-y-px hover:bg-[#18181b]"
              to="/service-tickets/create"
            >
              <Plus size={16} />
              Tạo phiếu
            </Link>
            <span className="inline-flex min-h-[34px] items-center whitespace-nowrap rounded-lg border border-[#b9dfc9] bg-[#edf8f2] px-2.5 py-[7px] text-[12px] font-medium text-[#1b7a4c] before:mr-[7px] before:h-[7px] before:w-[7px] before:rounded-full before:bg-[#1b7a4c] before:content-['']" title={getApiBaseUrl()}>
              Kết nối ổn định
            </span>
            <span className="min-h-[34px] rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-2.5 py-[7px] text-[12px] font-medium text-[#333333]">{roleLabel(role)}</span>
            <div className="relative" ref={notificationRef}>
              <button
                aria-label="Thông báo"
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#e5e5e5] bg-white text-[#333333] shadow-[0_1px_2px_rgba(24,24,27,0.05)] hover:-translate-y-px hover:border-[#e4e4e7] hover:bg-[#f4f4f5] hover:text-[#18181b]"
                onClick={() => setIsNotificationOpen((value) => !value)}
                title="Thông báo"
                type="button"
              >
                <Bell size={18} />
                {unreadCount ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[#18181b] px-1.5 text-[11px] font-medium leading-5 text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                ) : null}
              </button>
              {isNotificationOpen ? (
                <div className="absolute right-0 top-[calc(100%+8px)] z-30 grid w-[360px] max-w-[calc(100vw-32px)] gap-2 rounded-lg border border-[#e5e5e5] bg-white p-3 shadow-[0_18px_46px_rgba(24,24,27,0.16)]">
                  <div className="flex items-center justify-between gap-3 border-b border-[#eeeeee] pb-2">
                    <strong className="text-sm text-[#1f1f1f]">Thông báo</strong>
                    <button className="text-xs font-medium text-[#18181b]" onClick={markAllNotificationsRead} type="button">
                      Đã đọc tất cả
                    </button>
                  </div>
                  <div className="grid max-h-[360px] gap-1 overflow-y-auto">
                    {notifications.map((notification) => (
                      <button
                        className={`grid gap-1 rounded-lg p-3 text-left hover:bg-[#f4f4f5] ${notification.readAt ? 'bg-white' : 'bg-[#f4f4f5]'}`}
                        key={notification.id}
                        onClick={() => void openNotification(notification)}
                        type="button"
                      >
                        <span className="text-sm font-medium text-[#1f1f1f]">{notification.title}</span>
                        <span className="text-[13px] leading-snug text-[#666666]">{notification.message}</span>
                        <span className="text-xs font-medium text-[#8a8a8a]">{formatNotificationDate(notification.createdAt)}</span>
                      </button>
                    ))}
                    {notifications.length === 0 ? (
                      <div className="grid min-h-24 place-items-center rounded-lg bg-[#fafafa] text-sm text-[#666666]">
                        Chưa có thông báo.
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
            <Link
              className="inline-flex h-[38px] w-[38px] items-center justify-center overflow-hidden rounded-lg border border-[#e5e5e5] bg-white text-[#1f1f1f] shadow-[0_1px_2px_rgba(24,24,27,0.05)] hover:-translate-y-px hover:border-[#e4e4e7]"
              title="Tài khoản"
              to="/account-settings"
            >
              {user.engineerProfile?.photoUrl ? (
                <img alt={user.fullName || user.email} className="h-full w-full object-cover" src={user.engineerProfile.photoUrl} />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-[#fafafa] text-[12px] font-medium">
                  {initials(user.fullName || user.email)}
                </span>
              )}
            </Link>
          </div>
        </header>

        <Suspense fallback={<RouteLoadingState />}>
        <Routes>
          <Route path="/" element={<DashboardPage role={role} user={user} />} />
          <Route
            path="/technical-machines/:machineId/edit"
            element={
              <RequireRole
                allowedRoles={['admin']}
                currentRole={role}
                renderDenied={(message) => <AccessDeniedPage message={message} />}
              >
                <TechnicalMachinesPage currentRole={role} />
              </RequireRole>
            }
          />
          <Route
            path="/technical-machines/:machineId"
            element={
              <RequireRole
                allowedRoles={['admin', 'manager', 'engineer']}
                currentRole={role}
                renderDenied={(message) => <AccessDeniedPage message={message} />}
              >
                <TechnicalMachinesPage currentRole={role} />
              </RequireRole>
            }
          />
          <Route
            path="/technical-machines"
            element={
              <RequireRole
                allowedRoles={['admin', 'manager', 'engineer']}
                currentRole={role}
                renderDenied={(message) => <AccessDeniedPage message={message} />}
              >
                <TechnicalMachinesPage currentRole={role} />
              </RequireRole>
            }
          />
          <Route path="/account-settings" element={<AccountSettingsPage onUserUpdated={onUserUpdated} user={user} />} />
          <Route path="/daily-work" element={<DailyWorkCalendarPage currentRole={role} user={user} />} />
          <Route
            path="/daily-reports"
            element={
              <RequireRole
                allowedRoles={['admin', 'engineer']}
                currentRole={role}
                renderDenied={(message) => <AccessDeniedPage message={message} />}
              >
                <DailyReportsPage currentRole={role} user={user} />
              </RequireRole>
            }
          />
          <Route
            path="/weekly-reports"
            element={
              <RequireRole
                allowedRoles={resources.repairs.roles}
                currentRole={role}
                renderDenied={(message) => <AccessDeniedPage message={message} />}
              >
                <WeeklyReportsPage currentRole={role} user={user} />
              </RequireRole>
            }
          />
          <Route
            path="/my-reports"
            element={
              <RequireRole
                allowedRoles={['engineer']}
                currentRole={role}
                renderDenied={(message) => <AccessDeniedPage message={message} />}
              >
                <EngineerPerformancePage currentRole={role} user={user} />
              </RequireRole>
            }
          />
          <Route
            path="/engineer-performance"
            element={
              <RequireRole
                allowedRoles={['admin', 'engineer']}
                currentRole={role}
                renderDenied={(message) => <AccessDeniedPage message={message} />}
              >
                <EngineerPerformancePage currentRole={role} user={user} />
              </RequireRole>
            }
          />
          <Route
            path="/technical-statistics"
            element={
              <RequireRole
                allowedRoles={['admin', 'engineer']}
                currentRole={role}
                renderDenied={(message) => <AccessDeniedPage message={message} />}
              >
                <TechnicalStatisticsPage currentRole={role} user={user} />
              </RequireRole>
            }
          />
          <Route
            path="/reports"
            element={
              <RequireRole
                allowedRoles={['admin', 'manager']}
                currentRole={role}
                renderDenied={(message) => <AccessDeniedPage message={message} />}
              >
                <ReportsPage />
              </RequireRole>
            }
          />
          <Route
            path="/my-tasks"
            element={
              role === 'admin' ? (
                <AdminWorkAssignmentPage />
              ) : role === 'engineer' ? (
                <EngineerTasksPage user={user} />
              ) : (
                <AccessDeniedPage message="Tài khoản quản lý không dùng màn việc cá nhân của kỹ sư." />
              )
            }
          />
          <Route
            path="/my-customers"
            element={
              <RequireRole
                allowedRoles={['admin', 'engineer']}
                currentRole={role}
                renderDenied={(message) => <AccessDeniedPage message={message} />}
              >
                <EngineerCustomersPage currentRole={role} user={user} />
              </RequireRole>
            }
          />
          <Route
            path="/customers/profile"
            element={
              <RequireRole
                allowedRoles={['admin', 'manager']}
                currentRole={role}
                renderDenied={(message) => <AccessDeniedPage message={message} />}
              >
                <EngineerCustomersPage currentRole={role} user={user} />
              </RequireRole>
            }
          />
          <Route path="/customer-profiles" element={<Navigate replace to={`/customers/profile${location.search}`} />} />
          <Route
            path="/knowledge-base"
            element={
              <RequireRole
                allowedRoles={['admin', 'manager', 'engineer']}
                currentRole={role}
                renderDenied={(message) => <AccessDeniedPage message={message} />}
              >
                <KnowledgeBasePage user={user} />
              </RequireRole>
            }
          />
          <Route
            path="/users/new"
            element={
              <RequireRole
                allowedRoles={resources.users.roles}
                currentRole={role}
                renderDenied={(message) => <AccessDeniedPage message={message} />}
              >
                <AdminUsersPage formMode="create" />
              </RequireRole>
            }
          />
          <Route
            path="/users/:userId/edit"
            element={
              <RequireRole
                allowedRoles={resources.users.roles}
                currentRole={role}
                renderDenied={(message) => <AccessDeniedPage message={message} />}
              >
                <AdminUsersPage formMode="edit" />
              </RequireRole>
            }
          />
          <Route
            path="/users"
            element={
              <RequireRole
                allowedRoles={resources.users.roles}
                currentRole={role}
                renderDenied={(message) => <AccessDeniedPage message={message} />}
              >
                <AdminUsersPage />
              </RequireRole>
            }
          />
          <Route
            path="/customers/new"
            element={
              <RequireRole
                allowedRoles={adminCrudConfigs.customers.roles}
                currentRole={role}
                renderDenied={(message) => <AccessDeniedPage message={message} />}
              >
                <AdminCrudFormPage config={adminCrudConfigs.customers} />
              </RequireRole>
            }
          />
          <Route
            path="/customers/:id/edit"
            element={
              <RequireRole
                allowedRoles={adminCrudConfigs.customers.roles}
                currentRole={role}
                renderDenied={(message) => <AccessDeniedPage message={message} />}
              >
                <AdminCrudFormPage config={adminCrudConfigs.customers} />
              </RequireRole>
            }
          />
          <Route
            path="/roles"
            element={
              <RequireRole
                allowedRoles={resources.roles.roles}
                currentRole={role}
                renderDenied={(message) => <AccessDeniedPage message={message} />}
              >
                <AdminRolesPage />
              </RequireRole>
            }
          />
          <Route
            path="/regions"
            element={
              <RequireRole
                allowedRoles={resources.regions.roles}
                currentRole={role}
                renderDenied={(message) => <AccessDeniedPage message={message} />}
              >
                <AdminRegionsPage />
              </RequireRole>
            }
          />
          <Route
            path="/business-lines/manage"
            element={
              <RequireRole
                allowedRoles={['admin']}
                currentRole={role}
                renderDenied={(message) => <AccessDeniedPage message={message} />}
              >
                <AdminCrudPage config={adminCrudConfigs['business-lines']} />
              </RequireRole>
            }
          />
          <Route
            path="/business-lines/add-product"
            element={
              <RequireRole
                allowedRoles={['admin', 'engineer']}
                currentRole={role}
                renderDenied={(message) => <AccessDeniedPage message={message} />}
              >
                <ProductAddPage user={user} />
              </RequireRole>
            }
          />
          <Route
            path="/product-catalog"
            element={
              <RequireRole
                allowedRoles={resources['business-lines'].roles}
                currentRole={role}
                renderDenied={(message) => <AccessDeniedPage message={message} />}
              >
                <ProductCatalogPortalPage user={user} />
              </RequireRole>
            }
          />
          <Route
            path="/product-catalog/industries/:industryId"
            element={
              <RequireRole
                allowedRoles={resources['business-lines'].roles}
                currentRole={role}
                renderDenied={(message) => <AccessDeniedPage message={message} />}
              >
                <ProductIndustryModelsPage user={user} />
              </RequireRole>
            }
          />
          <Route
            path="/business-lines/models/:modelId"
            element={
              <RequireRole
                allowedRoles={resources['business-lines'].roles}
                currentRole={role}
                renderDenied={(message) => <AccessDeniedPage message={message} />}
              >
                <ProductModelDetailPage user={user} />
              </RequireRole>
            }
          />
          <Route
            path="/service-tickets"
            element={
              <RequireRole
                allowedRoles={resources.repairs.roles}
                currentRole={role}
                renderDenied={(message) => <AccessDeniedPage message={message} />}
              >
                <ServiceTicketsPage user={user} />
              </RequireRole>
            }
          />
          <Route
            path="/service-tickets/create"
            element={
              <RequireRole
                allowedRoles={['admin', 'engineer']}
                currentRole={role}
                renderDenied={(message) => <AccessDeniedPage message={message} />}
              >
                <ServiceTicketCreatePage user={user} />
              </RequireRole>
            }
          />
          <Route
            path="/repairs/:id/update"
            element={
              <RequireRole
                allowedRoles={resources.repairs.roles}
                currentRole={role}
                renderDenied={(message) => <AccessDeniedPage message={message} />}
              >
                <RepairUpdatePage user={user} />
              </RequireRole>
            }
          />
          <Route
            path="/maintenance/:id/update"
            element={
              <RequireRole
                allowedRoles={['admin', 'engineer']}
                currentRole={role}
                renderDenied={(message) => <AccessDeniedPage message={message} />}
              >
                <MaintenanceUpdatePage user={user} />
              </RequireRole>
            }
          />
          <Route
            path="/installations/create"
            element={
              <RequireRole
                allowedRoles={resources.installations.roles}
                currentRole={role}
                renderDenied={(message) => <AccessDeniedPage message={message} />}
              >
                <ServiceTicketCreatePage fixedKind="installation" user={user} />
              </RequireRole>
            }
          />
          <Route
            path="/installations/:id/update"
            element={
              <RequireRole
                allowedRoles={resources.installations.roles}
                currentRole={role}
                renderDenied={(message) => <AccessDeniedPage message={message} />}
              >
                <InstallationUpdatePage user={user} />
              </RequireRole>
            }
          />
          <Route path="/repairs" element={<Navigate to="/service-tickets" replace />} />
          <Route path="/maintenance" element={<Navigate to="/service-tickets" replace />} />
          <Route path="/machines" element={<Navigate to="/business-lines" replace />} />
          <Route
            path="/inventory-movements"
            element={
              <RequireRole
                allowedRoles={resources['inventory-movements'].roles}
                currentRole={role}
                renderDenied={(message) => <AccessDeniedPage message={message} />}
              >
                <InventoryMovementsPage currentRole={role} />
              </RequireRole>
            }
          />
          {Object.keys(resources).map((key) => (
            ['users', 'roles', 'regions', 'repairs', 'maintenance', 'machines', 'inventory-movements'].includes(key) ? null :
            <Route
              key={key}
              path={`/${key}`}
              element={
                <RequireRole
                  allowedRoles={resources[key].roles}
                  currentRole={role}
                  renderDenied={(message) => <AccessDeniedPage message={message} />}
                >
                  {key === 'business-lines' ? (
                    <ProductCatalogPage user={user} />
                  ) : key === 'installations' ? (
                    <InstallationsPage user={user} />
                  ) : role === 'admin' && adminCrudConfigs[key] ? (
                    <AdminCrudPage config={adminCrudConfigs[key]} />
                  ) : (
                    <ResourcePage config={resources[key]} />
                  )}
                </RequireRole>
              }
            />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </main>
    </div>
  );
}

function RouteLoadingState() {
  return (
    <div className="grid min-h-[320px] place-items-center px-4">
      <div className="grid justify-items-center gap-3 rounded-lg border border-[#e5e5e5] bg-white px-6 py-5 text-sm font-medium text-[#666666] shadow-[0_8px_24px_rgba(24,24,27,0.06)]">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#e4e4e7] border-t-[#18181b]" />
        <span>Đang mở màn hình...</span>
      </div>
    </div>
  );
}

function formatNotificationDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}
