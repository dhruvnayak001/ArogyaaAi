/**
 * layouts/RootLayout.jsx
 * Wrapper for public-facing pages (Landing, etc.)
 * Includes the marketing Navbar and Footer.
 *
 * NOTE: initialize() is intentionally NOT called here.
 * It is called once in main.jsx (Root) to avoid triple-call issues.
 * We do NOT gate rendering on isLoading here because unauthenticated
 * visitors should see the landing page immediately — not a blank screen.
 */

import React from 'react';
import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import Navbar  from '@components/navigation/Navbar';
import Footer  from '@components/navigation/Footer';

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

function RootLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-dark-950">
      <Navbar />
      <motion.main
        className="flex-1"
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        <Outlet />
      </motion.main>
      <Footer />
    </div>
  );
}

export default RootLayout;
