/**
 * layouts/DashboardLayout.jsx
 * Authenticated patient dashboard layout:
 *  - Collapsible sidebar on desktop (lg+)
 *  - Slide-over drawer on tablet (md)
 *  - Bottom navigation bar on mobile (<lg)
 *  - Top header bar with notifications + user menu
 *  - Animated page transitions
 */

import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar       from '@components/navigation/Sidebar';
import TopBar        from '@components/navigation/TopBar';
import MobileNav     from '@components/navigation/MobileNav';
import ReminderBanner from '@components/notifications/ReminderBanner';

const contentVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit:    { opacity: 0,        transition: { duration: 0.15 } },
};

function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false); // closed by default on mobile
  const [isMobile, setIsMobile]       = useState(window.innerWidth < 1024);
  const location = useLocation();

  // Track screen size to switch between desktop sidebar and mobile bottom nav
  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(true); // auto-open on desktop
    };
    // Set initial state correctly
    if (window.innerWidth >= 1024) setSidebarOpen(true);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location.pathname, isMobile]);

  return (
    <div className="min-h-screen flex bg-dark-950">
      {/* ── Mobile overlay backdrop ── */}
      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar (hidden on mobile unless drawer open) ── */}
      <div className={`${isMobile ? 'fixed z-30' : 'relative z-30'}`}>
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen((p) => !p)}
          isMobile={isMobile}
        />
      </div>

      {/* ── Main content area ── */}
      <div
        className="flex-1 flex flex-col min-w-0 transition-all duration-300"
        style={{
          marginLeft: isMobile ? 0 : (sidebarOpen ? '16rem' : '4.5rem'),
        }}
      >
        <TopBar onToggleSidebar={() => setSidebarOpen((p) => !p)} />

        {/* Floating appointment reminder banner */}
        <ReminderBanner />

        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto scrollable pb-24 lg:pb-8"
            variants={contentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <Outlet />
          </motion.main>
        </AnimatePresence>
      </div>

      {/* ── Mobile bottom nav (visible only on <lg) ── */}
      <MobileNav />
    </div>
  );
}

export default DashboardLayout;
