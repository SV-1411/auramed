import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import '../index.css';
import CardNav from '../components/CardNav';

const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    role: 'patient' as 'patient' | 'doctor' | 'ambulance' | 'admin',
    phoneNumber: '',
    dateOfBirth: '',
    gender: '',
    specialization: [] as string[],
    licenseNumber: '',
    experience: '',
    organization: '',
    vehicleNumber: '',
    driverName: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSpecializationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value && !formData.specialization.includes(value)) {
      setFormData(prev => ({
        ...prev,
        specialization: [...prev.specialization, value]
      }));
    }
  };

  const removeSpecialization = (spec: string) => {
    setFormData(prev => ({
      ...prev,
      specialization: prev.specialization.filter(s => s !== spec)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.email || !formData.password || !formData.firstName || !formData.lastName) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (formData.role === 'doctor' && (!formData.licenseNumber || formData.specialization.length === 0)) {
      toast.error('License number and specialization are required for doctors');
      return;
    }

    setLoading(true);
    try {
      await register(formData);
      navigate('/dashboard');
    } catch (error) {
      // Error is handled in AuthContext
    } finally {
      setLoading(false);
    }
  };

  const specializationOptions = [
    'Cardiology', 'Dermatology', 'Emergency Medicine', 'Family Medicine',
    'Internal Medicine', 'Neurology', 'Oncology', 'Orthopedics',
    'Pediatrics', 'Psychiatry', 'Radiology', 'Surgery'
  ];

  // Public logo and nav items for CardNav
  const logoUrl = '/assets/logo2.png';
  const navItems = [
    {
      label: 'About',
      bgColor: '#0D0716',
      textColor: '#fff',
      links: [
        { label: 'Company', ariaLabel: 'About Company', href: '/about' },
        { label: 'Careers', ariaLabel: 'Careers', href: '/about#careers' }
      ]
    },
    {
      label: 'Explore',
      bgColor: '#170D27',
      textColor: '#fff',
      links: [
        { label: 'Home', ariaLabel: 'Home', href: '/' },
        { label: 'Features', ariaLabel: 'Features', href: '/#features' }
      ]
    },
    {
      label: 'Contact',
      bgColor: '#271E37',
      textColor: '#fff',
      links: [
        { label: 'Email', ariaLabel: 'Email us', href: 'mailto:contact@auramed.example' },
        { label: 'LinkedIn', ariaLabel: 'LinkedIn', href: 'https://www.linkedin.com/' }
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

      {/* Form card */}
      <div className="px-4 sm:px-6 lg:px-8 pt-4 pb-14 flex items-start justify-center">
        <div className="max-w-3xl w-full">
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
            <div className="text-center mb-4">
              <h1 className="text-2xl font-extrabold text-gray-900">Join AuraMed</h1>
              <p className="text-sm text-gray-600">Create your account to access AI-powered healthcare</p>
            </div>

            <form className="form" onSubmit={handleSubmit}>
          {/* Role Selection */}
          <div className="form-group">
            <label className="form-label">I am a</label>
            <div className="role-selector">
              {(['patient', 'doctor', 'ambulance', 'admin'] as const).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, role }))}
                  className={`role-button ${formData.role === role ? 'active' : ''}`}
                >
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Basic Information */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="firstName" className="form-label">
                First Name *
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                required
                value={formData.firstName}
                onChange={handleInputChange}
                className="form-input"
                placeholder="Enter your first name"
              />
            </div>
            <div className="form-group">
              <label htmlFor="lastName" className="form-label">
                Last Name *
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                required
                value={formData.lastName}
                onChange={handleInputChange}
                className="form-input"
                placeholder="Enter your last name"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email Address *
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Enter your email address"
            />
          </div>

          <div className="form-group">
            <label htmlFor="phoneNumber" className="form-label">
              Phone Number
            </label>
            <input
              id="phoneNumber"
              name="phoneNumber"
              type="tel"
              value={formData.phoneNumber}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Enter your phone number"
            />
          </div>

          {/* Patient/Doctor specific fields */}
          {(formData.role === 'patient' || formData.role === 'doctor') && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="dateOfBirth" className="form-label">
                    Date of Birth
                  </label>
                  <input
                    id="dateOfBirth"
                    name="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="gender" className="form-label">
                    Gender
                  </label>
                  <select
                    id="gender"
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    className="form-select"
                  >
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Ambulance specific fields */}
          {formData.role === 'ambulance' && (
            <>
              <div className="form-group">
                <label htmlFor="organization" className="form-label">
                  Organization
                </label>
                <input
                  id="organization"
                  name="organization"
                  type="text"
                  value={formData.organization}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="Hospital / Provider / Self"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="vehicleNumber" className="form-label">
                    Vehicle Number
                  </label>
                  <input
                    id="vehicleNumber"
                    name="vehicleNumber"
                    type="text"
                    value={formData.vehicleNumber}
                    onChange={handleInputChange}
                    className="form-input"
                    placeholder="e.g., MH12AB1234"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="driverName" className="form-label">
                    Driver Name
                  </label>
                  <input
                    id="driverName"
                    name="driverName"
                    type="text"
                    value={formData.driverName}
                    onChange={handleInputChange}
                    className="form-input"
                    placeholder="Driver / Crew lead"
                  />
                </div>
              </div>
            </>
          )}

          {/* Doctor specific fields */}
          {formData.role === 'doctor' && (
            <>
              <div className="form-group">
                <label htmlFor="licenseNumber" className="form-label">
                  Medical License Number *
                </label>
                <input
                  id="licenseNumber"
                  name="licenseNumber"
                  type="text"
                  required
                  value={formData.licenseNumber}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="Enter your medical license number"
                />
              </div>

              <div className="form-group">
                <label htmlFor="specialization" className="form-label">
                  Specialization *
                </label>
                <select
                  id="specialization"
                  onChange={handleSpecializationChange}
                  className="form-select"
                >
                  <option value="">Add Specialization</option>
                  {specializationOptions.map(spec => (
                    <option key={spec} value={spec}>{spec}</option>
                  ))}
                </select>
                {formData.specialization.length > 0 && (
                  <div className="specialization-tags">
                    {formData.specialization.map(spec => (
                      <span key={spec} className="specialization-tag">
                        {spec}
                        <button
                          type="button"
                          onClick={() => removeSpecialization(spec)}
                          className="remove-tag"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="experience" className="form-label">
                  Years of Experience
                </label>
                <input
                  id="experience"
                  name="experience"
                  type="number"
                  min="0"
                  value={formData.experience}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="Enter years of experience"
                />
              </div>
            </>
          )}

          {/* Password fields */}
          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Password *
            </label>
            <div className="password-container">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={formData.password}
                onChange={handleInputChange}
                className="form-input"
                placeholder="Enter your password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeSlashIcon className="password-icon" />
                ) : (
                  <EyeIcon className="password-icon" />
                )}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword" className="form-label">
              Confirm Password *
            </label>
            <div className="password-container">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className="form-input"
                placeholder="Confirm your password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeSlashIcon className="password-icon" />
                ) : (
                  <EyeIcon className="password-icon" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="submit-button"
          >
            {loading ? (
              <>
                <div className="loading-spinner"></div>
                Creating account...
              </>
            ) : (
              'Create Account'
            )}
          </button>

            </form>

            <div className="form-footer">
              Already have an account?{' '}
              <Link to="/login" className="form-link">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
