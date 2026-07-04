/**
 * components/navigation/Navbar.jsx
 * Public marketing navbar with glassmorphism effect on scroll
 */

import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Menu, X } from 'lucide-react';
import { useAuthStore } from '@store/authStore';
import { clsx } from 'clsx';

const NAV_LINKS = [
  { label: 'Features',    href: '/#features' },
  { label: 'How it Works', href: '/#how-it-works' },
  { label: 'Doctors',     href: '/#doctors' },
  { label: 'Pricing',     href: '/#pricing' },
];

function Navbar() {
  const [scrolled,    setScrolled]    = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const { isAuthenticated, user }     = useAuthStore();
  const location                      = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => setMobileOpen(false), [location]);

  const dashboardHref = user?.role === 'doctor' ? '/doctor/dashboard' : '/dashboard';

  return (
    <>
      <header
        className={clsx(
          'fixed top-0 inset-x-0 z-40 transition-all duration-300',
          scrolled
            ? 'bg-dark-950/80 backdrop-blur-xl border-b border-white/5 shadow-glass-dark'
            : 'bg-transparent'
        )}
      >
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center group-hover:shadow-glow-primary transition-shadow duration-300">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-display font-bold text-white">ArogyaAI</span>
          </Link>

          {/* Desktop nav links */}
          <ul className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-150"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          {/* CTA buttons */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <Link to={dashboardHref} className="btn-primary text-sm px-5 py-2.5">
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login"    className="btn-ghost    text-sm px-5 py-2.5">Sign In</Link>
                <Link to="/register" className="btn-primary  text-sm px-5 py-2.5">Get Started</Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            id="mobile-menu-toggle"
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
            onClick={() => setMobileOpen((p) => !p)}
            aria-label="Toggle mobile menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </nav>
      </header>

      {/* Mobile menu drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{    opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="fixed top-16 inset-x-0 z-30 md:hidden bg-dark-900/95 backdrop-blur-xl border-b border-white/5 px-4 py-6 flex flex-col gap-3"
          >
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-4 py-3 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-all"
              >
                {link.label}
              </a>
            ))}
            <hr className="border-white/10 my-2" />
            {isAuthenticated ? (
              <Link to={dashboardHref} className="btn-primary text-sm">Dashboard</Link>
            ) : (
              <>
                <Link to="/login"    className="btn-ghost   text-sm">Sign In</Link>
                <Link to="/register" className="btn-primary text-sm">Get Started</Link>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default Navbar;
