import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import CardNav from '../components/CardNav';

const Landing: React.FC = () => {
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const features = [
    {
      title: 'AI Assistants',
      description: 'Converse with AI for quick triage and guidance, then seamlessly hand off to doctors.',
      emoji: '🤖'
    },
    {
      title: 'Appointments & Telehealth',
      description: 'Book and manage visits, and join secure video consultations from anywhere.',
      emoji: '📅'
    },
    {
      title: 'Family Profiles',
      description: 'Manage health for the whole family with shared profiles and unified records.',
      emoji: '👨‍👩‍👧‍👦'
    },
    {
      title: 'Predictive Insights',
      description: 'View health score, trends, and proactive alerts from predictive analytics.',
      emoji: '📈'
    },
    {
      title: 'Multilingual Experience',
      description: 'Interact in multiple languages for inclusive, accessible care.',
      emoji: '🌍'
    },
    {
      title: 'Privacy & Security',
      description: 'Enterprise-grade security and role-based access protect your data.',
      emoji: '🔒'
    }
  ];

  const navItems = [
    {
      label: 'Navigate',
      bgColor: '#0D0716',
      textColor: '#fff',
      links: [
        { label: 'Home', ariaLabel: 'Go to Home', href: '/' },
        { label: 'About', ariaLabel: 'About AuraMed', href: '/about' },
        { label: 'Login', ariaLabel: 'Login', href: '/login' },
        { label: 'Sign Up', ariaLabel: 'Register', href: '/register' }
      ]
    },
    {
      label: 'Explore',
      bgColor: '#170D27',
      textColor: '#fff',
      links: [
        { label: 'Features', ariaLabel: 'Features on Home', href: '/#features' },
        { label: 'Contact', ariaLabel: 'Email us', href: 'mailto:contact@auramed.example' }
      ]
    }
  ];

  // Use logo from public assets folder
  const logoUrl = '/assets/logo2.png';

  return (
    <div className="min-h-screen">
      {/* Hero Section with classy sapphire + black patches */}
      <section className="relative min-h-[92vh] auramed-overlay overflow-hidden">
        {/* Top Card Navigation */}
        <CardNav
          logo={logoUrl}
          logoAlt="AuraMed Logo"
          items={navItems}
          baseColor="#ffffff"
          menuColor="#000000"
          buttonBgColor="#111111"
          buttonTextColor="#ffffff"
          ease="power3.out"
        />
        {/* Floating dark patches */}
        <div className="auramed-blob b1" />
        <div className="auramed-blob b2" />
        <div className="auramed-blob b3" />
        <div className="auramed-blob b4" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 py-36 sm:py-40 text-center">
          <div className="inline-flex items-center justify-center mb-8">
            <span className="px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide bg-white/10 text-white/90 ring-1 ring-white/20 backdrop-blur-sm">
              AI-First Healthcare Platform
            </span>
          </div>
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-widest auramed-text mb-6">
            AURAMED
          </h1>
          <div className="mx-auto max-w-3xl">
            <p className="text-lg sm:text-xl text-slate-200/90 leading-relaxed">
              Your comprehensive healthcare platform powered by AI. Connect with doctors,
              manage your health, and get instant medical insights.
            </p>
          </div>
          {/* Sapphire glow under wordmark */}
          <div className="mt-6 flex justify-center">
            <div className="auramed-glow" />
          </div>
          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to={isAuthenticated ? '/dashboard' : '/register'}
              className="px-8 py-4 rounded-xl text-lg font-semibold shadow-lg bg-gradient-to-r from-sky-500 to-indigo-500 text-white hover:from-sky-600 hover:to-indigo-600 transition-all duration-200"
            >
              {isAuthenticated ? 'Go to Dashboard' : 'Get Started'}
            </Link>
            <Link
              to="/about"
              className="px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-200 bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/15 backdrop-blur-sm"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <div id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Why Choose AuraMed?
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              A unified, AI-first platform with real features you can use today
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="form-card text-center">
                <div className="text-4xl mb-4">
                  {feature.emoji}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-16" style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Transform Your Healthcare Experience?
          </h2>
          <p className="text-xl text-white opacity-90 mb-8 max-w-2xl mx-auto">
            Join thousands of patients and healthcare providers already using AuraMed
          </p>
          <Link
            to={isAuthenticated ? '/dashboard' : '/register'}
            className="bg-white hover:bg-gray-100 text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold transition-colors shadow-lg inline-block"
          >
            {isAuthenticated ? 'Go to Dashboard' : 'Start Your Journey'}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Landing;
