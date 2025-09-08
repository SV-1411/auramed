import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from './ThemeToggle';
import { PanelLeftOpen, PanelLeftClose } from 'lucide-react';

type NavbarProps = {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
};

const Navbar: React.FC<NavbarProps> = ({ isSidebarOpen, onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) {
    return (
      <nav className="bg-white/80 dark:bg-dark-surface/80 backdrop-blur-md shadow-sm border-b border-light-border dark:border-dark-border transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo - Left */}
            <div className="flex items-center flex-shrink-0">
              <div className="w-8 h-8 bg-gradient-to-br from-sapphire-500 to-sapphire-700 rounded-lg flex items-center justify-center mr-3">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <Link to="/" className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary hover:text-sapphire-600 dark:hover:text-sapphire-400 transition-colors">
                AuraMed
              </Link>
            </div>

            {/* Center space */}
            <div className="flex-1"></div>

            {/* Auth buttons - Right */}
            <div className="flex items-center space-x-3 flex-shrink-0">
              <ThemeToggle />
              <button
                onClick={() => navigate('/login')}
                className="text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary hover:bg-matte-blue-100 dark:hover:bg-matte-blue-800 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200"
              >
                Login
              </button>
              <button
                onClick={() => navigate('/register')}
                className="bg-gradient-to-r from-sapphire-600 to-sapphire-700 hover:from-sapphire-700 hover:to-sapphire-800 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Register
              </button>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-white/80 dark:bg-dark-surface/80 backdrop-blur-md shadow-sm border-b border-light-border dark:border-dark-border transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Hamburger + Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onToggleSidebar}
              className="text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary hover:bg-matte-blue-100 dark:hover:bg-matte-blue-800 p-2 rounded-xl transition-colors"
              aria-label="Toggle sidebar"
            >
              {isSidebarOpen ? (
                <PanelLeftClose className="w-5 h-5" aria-hidden="true" />
              ) : (
                <PanelLeftOpen className="w-5 h-5" aria-hidden="true" />
              )}
            </button>
            <div className="w-8 h-8 bg-gradient-to-br from-sapphire-500 to-sapphire-700 rounded-lg flex items-center justify-center mr-3">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <Link to="/dashboard" className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary hover:text-sapphire-600 dark:hover:text-sapphire-400 transition-colors">
              AuraMed
            </Link>
          </div>

          {/* Center spacer to push right content */}
          <div className="flex-1" />

          {/* User menu - Right */}
          <div className="flex items-center space-x-3 flex-shrink-0">
            <div className="hidden md:flex items-center space-x-3">
              <ThemeToggle />
              <div className="flex items-center space-x-2 text-sm text-light-text-secondary dark:text-dark-text-secondary bg-matte-blue-100/50 dark:bg-matte-blue-800/50 px-3 py-2 rounded-xl backdrop-blur-sm">
                <div className="w-6 h-6 bg-gradient-to-br from-sapphire-500 to-sapphire-700 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">
                    {user.profile.firstName?.[0]}{user.profile.lastName?.[0]}
                  </span>
                </div>
                {/* Show name only, no icons */}
                <span className="whitespace-nowrap font-medium">{user.profile.firstName} {user.profile.lastName}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <span>Logout</span>
              </button>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
