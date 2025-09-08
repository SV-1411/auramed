import React from 'react';
import { Link } from 'react-router-dom';
import CardNav from '../components/CardNav';

const About: React.FC = () => {
  // Use logo from public assets folder
  const logoUrl = '/assets/logo2.png';

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
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top navigation only */}
      <section className="relative auramed-overlay overflow-hidden">
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
        {/* Reserved space for CardNav height */}
        <div className="h-20 sm:h-24" />
      </section>

      {/* Content */}
      <section className="px-4 sm:px-6 lg:px-8 py-14">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Mission</h2>
            <p className="text-gray-700 leading-relaxed mb-6">
              AuraMed delivers accessible, intelligent healthcare experiences through conversational AI, predictive insights,
              and frictionless appointments, while maintaining enterprise-grade privacy and security.
            </p>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">What we offer</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>AI assistants for Patients, Doctors, and Admins</li>
              <li>Secure telemedicine and appointment workflows</li>
              <li>Predictive health metrics and proactive insights</li>
              <li>Family profiles and unified health records</li>
            </ul>
          </div>
          <aside className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Get Started</h3>
            <p className="text-gray-700 mb-4">Create an account to explore the full platform.</p>
            <div className="flex flex-col gap-3">
              <Link to="/register" className="px-5 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 text-center">
                Create Account
              </Link>
              <Link to="/login" className="px-5 py-3 rounded-xl font-semibold bg-white text-blue-600 ring-1 ring-blue-200 hover:bg-blue-50 text-center">
                Sign In
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
};

export default About;
