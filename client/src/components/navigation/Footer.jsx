/**
 * components/navigation/Footer.jsx
 * Marketing footer with links and branding
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, Heart } from 'lucide-react';

const FOOTER_LINKS = {
  Product:  ['Features', 'How it Works', 'Pricing', 'Changelog'],
  Company:  ['About', 'Blog', 'Careers', 'Press'],
  Legal:    ['Privacy Policy', 'Terms of Service', 'Cookie Policy', 'HIPAA Compliance'],
  Support:  ['Help Center', 'Contact Us', 'Status', 'Community'],
};

function Footer() {
  return (
    <footer className="border-t border-white/5 bg-dark-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-display font-bold text-white">ArogyaAI</span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
              Intelligent AI healthcare support, helping you make better health decisions with confidence.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([category, links]) => (
            <div key={category}>
              <p className="text-xs font-semibold text-white uppercase tracking-wider mb-4">{category}</p>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-slate-400 hover:text-white transition-colors duration-150"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} ArogyaAI. All rights reserved.
          </p>
          <p className="text-sm text-slate-500 flex items-center gap-1.5">
            Made with <Heart className="w-3.5 h-3.5 text-danger-400 fill-danger-400" /> for better healthcare
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
