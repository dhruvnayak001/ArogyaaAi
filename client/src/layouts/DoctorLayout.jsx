/**
 * layouts/DoctorLayout.jsx
 * Authenticated doctor dashboard layout:
 *  - Collapsible sidebar on desktop (lg+)
 *  - Slide-over drawer on tablet (md)
 *  - Bottom navigation bar on mobile (<lg)
 */

import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import DoctorSidebar   from '@components/navigation/DoctorSidebar';
import TopBar          from '@components/navigation/TopBar';
import DoctorMobileNav from '@components/navigation/DoctorMobileNav';
import ReminderBanner  from '@components/notifications/ReminderBanner';

const contentVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit:    { opacity: 0,        transition: { duration: 0.15 } },
};

function DoctorLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile]       = useState(window.innerWidth < 1024);
  const location = useLocation();

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(true);
    };
    if (window.innerWidth >= 1024) setSidebarOpen(true);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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

      {/* ── Doctor Sidebar ── */}
      <div className={`${isMobile ? 'fixed z-30' : 'relative z-30'}`}>
        <DoctorSidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen((p) => !p)}
          isMobile={isMobile}
        />
      </div>

      {/* ── Main content ── */}
      <div
        className="flex-1 flex flex-col min-w-0 transition-all duration-300"
        style={{
          marginLeft: isMobile ? 0 : (sidebarOpen ? '16rem' : '4.5rem'),
        }}
      >
        <TopBar
          onToggleSidebar={() => setSidebarOpen((p) => !p)}
          isDoctor
        />

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

      {/* ── Doctor mobile bottom nav ── */}
      <DoctorMobileNav />
    </div>
  );
}

export default DoctorLayout;
