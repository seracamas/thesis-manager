import { useUIStore } from '../../stores/uiStore';

export const TopBar = () => {
  const { sidebarCollapsed } = useUIStore();

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-border-subtle">
      <div
        className="flex items-center justify-between px-6 py-4"
        style={{ marginLeft: sidebarCollapsed ? '64px' : '240px' }}
      >
        {/* TopBar content removed - search bar deleted */}
      </div>
    </header>
  );
};
