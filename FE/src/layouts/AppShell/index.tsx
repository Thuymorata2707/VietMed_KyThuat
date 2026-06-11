import { ChevronsLeft, ChevronsRight, LogOut, Settings2 } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ApiUser, clearToken, getApiBaseUrl } from '../../api';
import { getRoleName, roleLabel } from '../../auth/roles';
import { Brand } from '../../components/Brand';
import { RequireRole } from '../../components/RequireRole';
import { navGroupsForRole, navItemsForRole } from '../../config/navigation';
import { resources } from '../../config/resources';
import { adminCrudConfigs } from '../../config/adminCrud';
import { AccessDeniedPage } from '../../pages/AccessDeniedPage';
import { AccountSettingsPage } from '../../pages/AccountSettingsPage';
import { AdminCrudPage } from '../../pages/AdminCrudPage';
import { AdminRegionsPage } from '../../pages/AdminRegionsPage';
import { AdminRolesPage } from '../../pages/AdminRolesPage';
import { AdminUsersPage } from '../../pages/AdminUsersPage';
import { AdminWorkAssignmentPage } from '../../pages/AdminWorkAssignmentPage';
import { DashboardPage } from '../../pages/DashboardPage';
import { DailyWorkCalendarPage } from '../../pages/DailyWorkCalendarPage';
import { EngineerTasksPage } from '../../pages/EngineerTasksPage';
import { ProductAddPage, ProductCatalogPage, ProductModelDetailPage } from '../../pages/ProductCatalogPage';
import { ResourcePage } from '../../pages/ResourcePage';
import { ServiceTicketsPage } from '../../pages/ServiceTicketsPage';
import { initials } from '../../utils/format';

type AppShellProps = {
  user: ApiUser;
  onLogout: () => void;
  onUserUpdated: (user: ApiUser) => void;
};

export function AppShell({ user, onLogout, onUserUpdated }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const role = getRoleName(user);
  const visibleNavItems = navItemsForRole(role);
  const visibleNavGroups = navGroupsForRole(role);
  const activeNavItem = visibleNavItems.find((item) =>
    item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path),
  );
  const pageTitle = location.pathname.startsWith('/account-settings')
    ? 'Thiết lập tài khoản'
    : activeNavItem?.label || 'Tổng quan';

  function logout() {
    clearToken();
    onLogout();
    navigate('/login');
  }

  return (
    <div className={`grid min-h-screen transition-[grid-template-columns] duration-200 max-[980px]:grid-cols-1 ${isSidebarCollapsed ? 'grid-cols-[82px_minmax(0,1fr)]' : 'grid-cols-[280px_minmax(0,1fr)]'}`}>
      <aside className={`sticky top-0 flex h-screen flex-col overflow-y-auto border-r border-[#e3eaf2] bg-white/95 px-4 py-[22px] max-[980px]:static max-[980px]:h-auto max-[980px]:border-b max-[980px]:border-r-0 max-[980px]:p-4 ${isSidebarCollapsed ? 'items-center gap-6 px-3.5 max-[980px]:items-stretch max-[980px]:gap-4' : 'gap-[22px] max-[980px]:gap-4'}`}>
        <div className={`flex min-w-0 items-center gap-2.5 ${isSidebarCollapsed ? 'grid justify-items-center' : 'justify-between'} max-[980px]:flex max-[980px]:justify-between`}>
          <Brand compact={isSidebarCollapsed} />
          <button
            aria-label={isSidebarCollapsed ? 'Mở rộng thanh menu' : 'Thu gọn thanh menu'}
            className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border border-[#e3eaf2] bg-white text-[#405064] hover:border-[#f0b7b1] hover:text-[#c92a1f] max-[980px]:hidden"
            onClick={() => setIsSidebarCollapsed((current) => !current)}
            title={isSidebarCollapsed ? 'Mở rộng' : 'Thu gọn'}
            type="button"
          >
            {isSidebarCollapsed ? <ChevronsRight size={17} /> : <ChevronsLeft size={17} />}
          </button>
        </div>

        <nav className={`${isSidebarCollapsed ? 'grid w-full gap-3' : 'grid gap-4'} max-[980px]:flex max-[980px]:gap-2.5 max-[980px]:overflow-x-auto`}>
          {visibleNavGroups.map((group) => (
            <div className={`grid gap-1.5 max-[980px]:contents ${isSidebarCollapsed ? 'gap-1.5' : ''}`} key={group.label}>
              <span className={`px-3 text-[11px] font-bold uppercase tracking-[0.04em] text-[#8a98aa] transition ${isSidebarCollapsed ? 'h-px overflow-hidden p-0 opacity-0' : ''} max-[980px]:hidden`}>{group.label}</span>
              <div className="grid gap-1 max-[980px]:flex max-[980px]:gap-2">
                {group.items.map((item) => {
                  const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
                  return (
                    <Link
                      className={`relative flex min-h-[42px] items-center rounded-lg text-[#405064] transition hover:translate-x-0.5 hover:bg-[#fff5f4] hover:text-[#c92a1f] max-[980px]:shrink-0 max-[980px]:gap-2.5 max-[980px]:px-3 ${
                        isActive ? 'bg-[#fff5f4] text-[#c92a1f] before:absolute before:left-0 before:h-[22px] before:w-[3px] before:rounded-full before:bg-[#c92a1f]' : ''
                      } ${isSidebarCollapsed ? 'justify-center gap-0 px-0 max-[980px]:justify-start' : 'gap-2.5 px-3'}`}
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

        <div className={`mt-auto grid gap-3 border-t border-[#e3eaf2] pt-[18px] max-[980px]:hidden ${isSidebarCollapsed ? 'w-full' : ''}`}>
          <Link className={`grid items-center gap-2.5 rounded-[10px] p-1.5 hover:bg-[#f8fafc] ${isSidebarCollapsed ? 'flex justify-center' : 'grid-cols-[40px_minmax(0,1fr)]'}`} title="Thiết lập tài khoản" to="/account-settings">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e4ebf3] bg-gradient-to-br from-[#fff5f4] to-[#eef4fb] text-[13px] font-extrabold text-[#253142]">{initials(user.fullName || user.email)}</div>
            <div>
              <strong className={`block overflow-hidden text-ellipsis whitespace-nowrap ${isSidebarCollapsed ? 'w-0 opacity-0' : ''}`}>{user.fullName || user.email}</strong>
              <span className={`block overflow-hidden text-ellipsis whitespace-nowrap text-[#657384] ${isSidebarCollapsed ? 'w-0 opacity-0' : ''}`}>{roleLabel(role)}</span>
            </div>
          </Link>
          <button className={`inline-flex min-h-10 items-center justify-center rounded-lg bg-transparent px-2.5 text-[#405064] hover:bg-[#f8fafc] ${isSidebarCollapsed ? 'w-full px-0' : 'gap-2'}`} onClick={logout} title="Đăng xuất" type="button">
            <LogOut size={17} />
            <span className={`transition ${isSidebarCollapsed ? 'w-0 overflow-hidden opacity-0' : ''}`}>Đăng xuất</span>
          </button>
        </div>
      </aside>

      <main className="min-w-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(255,255,255,0)_190px),#f5f7fb]">
        <header className="sticky top-0 z-[2] flex min-h-[68px] items-center justify-between border-b border-white/80 bg-white/70 px-[30px] shadow-[inset_0_-1px_0_rgba(227,234,242,0.46),0_10px_32px_rgba(15,23,42,0.026)] backdrop-blur-[22px] backdrop-saturate-150 max-sm:flex-col max-sm:items-start max-sm:gap-3 max-sm:p-4">
          <div className="min-w-0">
            <span className="block text-xs font-extrabold uppercase text-[#657384]">VietMed Kỹ Thuật</span>
            <strong className="block text-lg leading-tight text-[#17202a]">{pageTitle}</strong>
          </div>
          <div className="flex items-center gap-2.5 max-sm:w-full max-sm:flex-wrap">
            <span className="inline-flex min-h-[34px] items-center whitespace-nowrap rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-2.5 py-[7px] text-[13px] font-semibold text-[#027a48] before:mr-[7px] before:h-[7px] before:w-[7px] before:rounded-full before:bg-[#12b76a] before:content-['']" title={getApiBaseUrl()}>
              API sẵn sàng
            </span>
            <span className="min-h-[34px] rounded-lg border border-[#f0b7b1] bg-[#fff8f7] px-2.5 py-[7px] text-[13px] font-extrabold text-[#c92a1f]">{roleLabel(role)}</span>
            <button className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-[#e3eaf2] bg-white text-[#405064] hover:-translate-y-px hover:border-[#f3c3be] hover:text-[#c92a1f]" onClick={() => navigate('/account-settings')} title="Thiết lập tài khoản" type="button">
              <Settings2 size={18} />
            </button>
          </div>
        </header>

        <Routes>
          <Route path="/" element={<DashboardPage role={role} />} />
          <Route path="/account-settings" element={<AccountSettingsPage onUserUpdated={onUserUpdated} user={user} />} />
          <Route path="/daily-work" element={<DailyWorkCalendarPage currentRole={role} user={user} />} />
          <Route path="/my-tasks" element={role === 'admin' ? <AdminWorkAssignmentPage /> : <EngineerTasksPage user={user} />} />
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
          <Route path="/repairs" element={<Navigate to="/service-tickets" replace />} />
          <Route path="/maintenance" element={<Navigate to="/service-tickets" replace />} />
          <Route path="/machines" element={<Navigate to="/business-lines" replace />} />
          {Object.keys(resources).map((key) => (
            ['users', 'roles', 'regions', 'repairs', 'maintenance', 'machines'].includes(key) ? null :
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
      </main>
    </div>
  );
}
