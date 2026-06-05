import { NavLink } from 'react-router-dom';
import { useUIStore } from '../../stores/uiStore';
import { Icons } from '../../config/icons';
import clsx from 'clsx';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<any>;
  section?: string;
}

const navItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: Icons.dashboard, section: 'Research' },
  { path: '/sources', label: 'Sources', icon: Icons.sources, section: 'Research' },
  { path: '/discover', label: 'Discover', icon: Icons.discover, section: 'Research' },
  { path: '/interviews', label: 'Interviews', icon: Icons.interviews, section: 'Research' },
  { path: '/themes', label: 'Themes', icon: Icons.themes, section: 'Analysis' },
  { path: '/data', label: 'Data', icon: Icons.data, section: 'Analysis' },
  { path: '/drafts', label: 'Drafts', icon: Icons.drafts, section: 'Analysis' },
  { path: '/planning', label: 'Planning', icon: Icons.planning, section: 'Planning' },
  { path: '/settings', label: 'Settings', icon: Icons.settings },
];

export const Sidebar = () => {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const ChevronLeft = Icons.next;
  const ChevronRight = Icons.next;

  // Group items by section
  const groupedItems = navItems.reduce((acc, item) => {
    const section = item.section || 'Other';
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {} as Record<string, NavItem[]>);

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 h-full bg-bg-surface border-r border-border-light',
        'transition-all duration-300 z-40',
        sidebarCollapsed ? 'w-16' : 'w-[240px]'
      )}
    >
      <div className="flex flex-col h-full">
        {/* Logo area */}
        <div className="px-5 py-6 border-b border-border-light">
          {!sidebarCollapsed && (
            <div>
              <h1 className="font-playfair text-[18px] font-bold text-text-primary">
                Thesis Manager
              </h1>
              <p className="text-[10px] uppercase tracking-[0.12em] text-text-muted mt-0.5">
                Research Workspace
              </p>
            </div>
          )}
          {sidebarCollapsed && (
            <div className="flex justify-center">
              <div className="w-2 h-2 rounded-full bg-accent"></div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto">
          {!sidebarCollapsed && Object.entries(groupedItems).map(([section, items]) => (
            <div key={section}>
              {/* Section label */}
              <div className="px-5 pt-5 pb-1.5">
                <div className="text-[10px] uppercase tracking-[0.12em] text-text-placeholder font-medium">
                  {section}
                </div>
              </div>
              <div className="px-2 space-y-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) =>
                        clsx(
                          'mx-2 px-3 py-2.5 rounded-input flex items-center gap-3',
                          'text-secondary font-medium text-text-secondary',
                          'transition-all duration-150',
                          'hover:bg-bg-hover hover:text-text-primary',
                          isActive && 'bg-accent-soft text-text-primary font-semibold'
                        )
                      }
                      title={sidebarCollapsed ? item.label : undefined}
                      aria-label={item.label}
                    >
                      {({ isActive }) => (
                        <>
                          <Icon 
                            size={16} 
                            className="flex-shrink-0"
                            style={{ 
                              color: isActive ? '#E8C96A' : '#C5BFB8'
                            }}
                          />
                          <span>{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
          
          {sidebarCollapsed && (
            <div className="px-2 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center justify-center p-2.5 rounded-input transition-all duration-150',
                        'text-text-muted',
                        'hover:bg-bg-hover hover:text-text-primary',
                        isActive && 'bg-accent-soft text-accent'
                      )
                    }
                    title={item.label}
                    aria-label={item.label}
                  >
                    {({ isActive }) => (
                      <Icon 
                        size={16}
                        style={{ color: isActive ? '#E8C96A' : '#C5BFB8' }}
                      />
                    )}
                  </NavLink>
                );
              })}
            </div>
          )}
        </nav>

        {/* Footer */}
        {!sidebarCollapsed && (
          <div className="px-5 py-4 border-t border-border-light mt-auto">
            <p className="text-[11px] text-text-muted">
              © 2024 Thesis Manager
            </p>
          </div>
        )}

        {/* Collapse button */}
        <div className="px-5 py-2 border-t border-border-light">
          <button
            onClick={toggleSidebar}
            className="btn-ghost w-full"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <ChevronRight size={18} />
            ) : (
              <ChevronLeft size={18} className="rotate-180" />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};
