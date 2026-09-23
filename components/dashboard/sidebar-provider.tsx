'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const SidebarContext = createContext({
  collapsed: false,
  toggle: () => {},
  mobileOpen: false,
  openMobile: () => {},
  closeMobile: () => {},
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved === 'true') setCollapsed(true);
  }, []);

  function toggle() {
    setCollapsed((c) => {
      localStorage.setItem('sidebar-collapsed', String(!c));
      return !c;
    });
  }

  return (
    <SidebarContext.Provider value={{ collapsed, toggle, mobileOpen, openMobile: () => setMobileOpen(true), closeMobile: () => setMobileOpen(false) }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
