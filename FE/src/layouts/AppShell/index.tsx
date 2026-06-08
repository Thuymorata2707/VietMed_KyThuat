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
import { AdminCrudPage } from '../../pages/AdminCrudPage';
import { AdminRegionsPage } from '../../pages/AdminRegionsPage';
import { AdminRolesPage } from '../../pages/AdminRolesPage';
import { AdminUsersPage } from '../../pages/AdminUsersPage';
import { AdminWorkAssignmentPage } from '../../pages/AdminWorkAssignmentPage';
import { DashboardPage } from '../../pages/DashboardPage';
import { EngineerTasksPage } from '../../pages/EngineerTasksPage';
import { ProductCatalogPage } from '../../pages/ProductCatalogPage';
import { ResourcePage } from '../../pages/ResourcePage';
import { ServiceTicketsPage } from '../../pages/ServiceTicketsPage';
import { initials } from '../../utils/format';
import './styles.css';

type AppShellProps = {
  user: ApiUser;
  onLogout: () => void;
};

export function AppShell({ user, onLogout }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const role = getRoleName(user);
  const visibleNavItems = navItemsForRole(role);
  const visibleNavGroups = navGroupsForRole(role);
  const activeNavItem = visibleNavItems.find((item) =>
    item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path),
  );

  function logout() {
    clearToken();
    onLogout();
    navigate('/login');
  }

  return (
    <div className={isSidebarCollapsed ? 'app-shell sidebar-collapsed' : 'app-shell'}>
      <aside className="sidebar">
        <div className="sidebar-brand-row">
          <Brand compact={isSidebarCollapsed} />
          <button
            aria-label={isSidebarCollapsed ? 'Mở rộng thanh menu' : 'Thu gọn thanh menu'}
            className="sidebar-toggle"
            onClick={() => setIsSidebarCollapsed((current) => !current)}
            title={isSidebarCollapsed ? 'Mở rộng' : 'Thu gọn'}
            type="button"
          >
            {isSidebarCollapsed ? <ChevronsRight size={17} /> : <ChevronsLeft size={17} />}
          </button>
        </div>

        <nav className="nav-list">
          {visibleNavGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <span className="nav-group-label">{group.label}</span>
              <div className="nav-group-items">
                {group.items.map((item) => {
                  const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
                  return (
                    <Link className={isActive ? 'nav-item active' : 'nav-item'} key={item.path} title={item.label} to={item.path}>
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="avatar">{initials(user.fullName || user.email)}</div>
            <div>
              <strong>{user.fullName || user.email}</strong>
              <span>{roleLabel(role)}</span>
            </div>
          </div>
          <button className="icon-text" onClick={logout} title="Đăng xuất" type="button">
            <LogOut size={17} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div className="topbar-title">
            <span className="eyebrow">VietMed Kỹ Thuật</span>
            <strong>{activeNavItem?.label || 'Tổng quan'}</strong>
          </div>
          <div className="topbar-actions">
            <span className="api-status" title={getApiBaseUrl()}>
              API sẵn sàng
            </span>
            <span className="role-badge">{roleLabel(role)}</span>
            <button className="icon-only" title="Thiết lập" type="button">
              <Settings2 size={18} />
            </button>
          </div>
        </header>

        <Routes>
          <Route path="/" element={<DashboardPage role={role} />} />
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
          {Object.keys(resources).map((key) => (
            ['users', 'roles', 'regions', 'repairs', 'maintenance'].includes(key) ? null :
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
