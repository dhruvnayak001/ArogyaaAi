/**
 * pages/LandingPage.jsx
 * Public marketing landing page
 * Sections: Hero | Features | How it Works | Testimonials | CTA
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Activity, MessageSquare, Calendar, Shield,
  Mic, FileText, ArrowRight, Star, Zap,
} from 'lucide-react';

/* ── Animation variants ── */
const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-50px' },
  transition: { duration: 0.55, ease: 'easeOut' },
};

const staggerContainer = {
  initial: {},
  whileInView: { transition: { staggerChildren: 0.1 } },
};

/* ── Feature cards data ── */
const FEATURES = [
  {
    icon:        MessageSquare,
    color:       'from-primary-500 to-primary-700',
    glow:        'glow-primary',
    title:       'AI Healthcare Chatbot',
    description: 'Get instant, accurate health guidance powered by Google Gemini. Understands symptoms, medications, and medical history.',
  },
  {
    icon:        Shield,
    color:       'from-danger-600 to-danger-800',
    glow:        'glow-danger',
    title:       'Emergency Detection',
    description: 'Real-time emergency triage system that detects critical symptoms and connects you with emergency services instantly.',
  },
  {
    icon:        Mic,
    color:       'from-accent-600 to-accent-800',
    glow:        'glow-accent',
    title:       'Voice Assistant',
    description: 'Hands-free healthcare support with natural speech recognition. Describe symptoms by speaking naturally.',
  },
  {
    icon:        Calendar,
    color:       'from-success-500 to-success-700',
    glow:        '',
    title:       'Smart Appointments',
    description: 'Book appointments with the right specialist instantly. AI suggests the best available doctor based on your needs.',
  },
  {
    icon:        FileText,
    color:       'from-warning-500 to-warning-700',
    glow:        '',
    title:       'Health Records',
    description: 'Securely store and manage all your medical records, prescriptions, and test results in one encrypted vault.',
  },
  {
    icon:        Zap,
    color:       'from-primary-600 to-accent-700',
    glow:        '',
    title:       'AI Medical Summaries',
    description: 'Gemini AI generates comprehensible summaries of complex medical reports for both patients and doctors.',
  },
];

function LandingPage() {
  return (
    <div className="overflow-x-hidden">
      {/* ════ HERO SECTION ════ */}
      <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-noise opacity-30 pointer-events-none" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/15  rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-600/15  rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-900/10 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/25 text-primary-400 text-sm font-medium mb-8"
          >
            <Activity className="w-4 h-4" />
            Powered by Google Gemini AI
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-display font-black text-white mb-6 text-balance"
          >
            Your Intelligent{' '}
            <span className="gradient-text">AI Health</span>
            <br />
            Companion
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.2 }}
            className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 text-pretty"
          >
            ArogyaAI combines the power of Gemini AI with cutting-edge healthcare technology to provide emergency detection, smart appointments, AI-powered health insights, and 24/7 support.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              id="hero-get-started"
              to="/register"
              className="btn-primary text-base px-8 py-4 shadow-glow-primary"
            >
              Get Started Free <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              id="hero-learn-more"
              to="/login"
              className="btn-ghost text-base px-8 py-4"
            >
              Sign In
            </Link>
          </motion.div>

          {/* Social proof */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500"
          >
            <div className="flex items-center gap-1.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 text-warning-400 fill-warning-400" />
              ))}
              <span className="ml-1">4.9/5 rating</span>
            </div>
            <span>•</span>
            <span>50,000+ users</span>
            <span>•</span>
            <span>HIPAA Compliant</span>
            <span>•</span>
            <span>24/7 AI Support</span>
          </motion.div>
        </div>
      </section>

      {/* ════ FEATURES SECTION ════ */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-16">
            <p className="text-sm font-semibold text-primary-400 tracking-widest uppercase mb-3">Features</p>
            <h2 className="text-4xl font-display font-bold text-white mb-4">
              Everything you need for{' '}
              <span className="gradient-text">smarter healthcare</span>
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              From emergency detection to AI-powered medical summaries — ArogyaAI is the complete healthcare platform built for the modern world.
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {FEATURES.map((feature) => (
              <motion.div
                key={feature.title}
                variants={{
                  initial: { opacity: 0, y: 24 },
                  whileInView: { opacity: 1, y: 0, transition: { duration: 0.45 } },
                }}
                className="glass-card-hover p-6"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 shadow-${feature.glow}`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ════ HOW IT WORKS ════ */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 bg-white/2">
        <div className="max-w-4xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-16">
            <p className="text-sm font-semibold text-accent-400 tracking-widest uppercase mb-3">How it Works</p>
            <h2 className="text-4xl font-display font-bold text-white mb-4">
              Healthcare support in <span className="gradient-text">3 simple steps</span>
            </h2>
          </motion.div>

          <div className="space-y-8">
            {[
              { step: '01', title: 'Create Your Account', desc: 'Sign up in seconds. Set up your health profile, medical history, and preferences.' },
              { step: '02', title: 'Chat with ArogyaAI', desc: 'Describe your symptoms via text or voice. Our Gemini-powered AI understands context and provides personalized guidance.' },
              { step: '03', title: 'Take Action', desc: 'Book appointments, review AI medical summaries, share records with doctors, or get emergency help instantly.' },
            ].map((item, idx) => (
              <motion.div
                key={item.step}
                {...fadeUp}
                transition={{ duration: 0.5, delay: idx * 0.15 }}
                className="flex gap-6 glass-card p-6"
              >
                <div className="text-4xl font-display font-black gradient-text flex-shrink-0">{item.step}</div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">{item.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════ CTA SECTION ════ */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <motion.div
            {...fadeUp}
            className="glass-card p-12 text-center relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(6,148,162,0.15) 0%, rgba(91,33,182,0.15) 100%)' }}
          >
            <div className="absolute -top-16 -right-16 w-48 h-48 bg-primary-500/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-accent-600/10  rounded-full blur-2xl" />
            <div className="relative z-10">
              <Activity className="w-12 h-12 text-primary-400 mx-auto mb-6" />
              <h2 className="text-3xl font-display font-bold text-white mb-4">
                Ready to take control of your health?
              </h2>
              <p className="text-slate-400 mb-8">
                Join 50,000+ users already using ArogyaAI for smarter, faster healthcare support.
              </p>
              <Link
                id="cta-get-started"
                to="/register"
                className="btn-primary text-base px-10 py-4 shadow-glow-primary"
              >
                Get Started — It's Free <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

export default LandingPage;
