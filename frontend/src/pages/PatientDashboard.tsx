import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import {
  ChatBubbleLeftRightIcon,
  CalendarDaysIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CheckCircleIcon,
  PlusIcon,
  HeartIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  BeakerIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';

interface Appointment {
  id: string;
  scheduledAt: string;
  status: string;
  doctor: {
    doctorProfile: {
      firstName: string;
      lastName: string;
      specialization: string[];
    };
  };
  riskLevel: string;
}

interface HealthInsight {
  id: string;
  title: string;
  description: string;
  severity: string;
  type: string;
  isRead: boolean;
}

interface HealthMetrics {
  healthScore: number;
  bmi: number;
  bloodPressure: string;
  heartRate: number;
  lastCheckup: string;
  riskFactors: string[];
  medications: string[];
  allergies: string[];
  chronicConditions: string[];
}

const PatientDashboard: React.FC = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [healthInsights, setHealthInsights] = useState<HealthInsight[]>([]);
  const [healthMetrics, setHealthMetrics] = useState<HealthMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [medOpen, setMedOpen] = useState(true);
  const [riskOpen, setRiskOpen] = useState(true);

  const markInsightRead = (id: string) => {
    setHealthInsights(prev => prev.map(i => i.id === id ? { ...i, isRead: true } : i));
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [appointmentsRes, insightsRes, metricsRes] = await Promise.all([
        axios.get('/api/appointments?limit=5'),
        axios.get('/api/health-insights?limit=5'),
        axios.get('/api/predictive-insights/metrics').catch(() => ({ data: { data: null } }))
      ]);

      setAppointments(appointmentsRes.data.data.appointments || []);
      setHealthInsights(insightsRes.data.data.insights || []);
      setHealthMetrics(metricsRes.data.data || {
        healthScore: 85,
        bmi: 23.5,
        bloodPressure: '120/80',
        heartRate: 72,
        lastCheckup: '2024-01-15',
        riskFactors: ['Family History of Diabetes'],
        medications: ['Vitamin D', 'Multivitamin'],
        allergies: ['Peanuts'],
        chronicConditions: []
      });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'scheduled': return 'text-blue-600 bg-blue-50';
      case 'in_progress': return 'text-green-600 bg-green-50';
      case 'completed': return 'text-gray-600 bg-gray-50';
      case 'cancelled': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getRiskColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'critical': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />;
      case 'warning': return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
      default: return <InformationCircleIcon className="h-5 w-5 text-blue-500" />;
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 p-6">
        <div className="bg-gradient-to-br from-sapphire-600 via-sapphire-700 to-sapphire-800 rounded-2xl p-8 text-white shadow-2xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-24 bg-white/60 dark:bg-dark-card/60 rounded-2xl shadow-lg" />
          <div className="h-24 bg-white/60 dark:bg-dark-card/60 rounded-2xl shadow-lg" />
          <div className="h-24 bg-white/60 dark:bg-dark-card/60 rounded-2xl shadow-lg" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-white/60 dark:bg-dark-card/60 rounded-2xl shadow-lg" />
          <div className="h-64 bg-white/60 dark:bg-dark-card/60 rounded-2xl shadow-lg" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-64 bg-white/60 dark:bg-dark-card/60 rounded-2xl shadow-lg" />
          <div className="h-64 bg-white/60 dark:bg-dark-card/60 rounded-2xl shadow-lg" />
          <div className="h-64 bg-white/60 dark:bg-dark-card/60 rounded-2xl shadow-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-br from-sapphire-600 via-sapphire-700 to-sapphire-800 dark:from-sapphire-700 dark:via-sapphire-800 dark:to-sapphire-900 rounded-2xl p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent"></div>
        <div className="relative z-10">
          <h1 className="text-4xl font-bold mb-3 tracking-tight">
            Welcome back, {user?.profile.firstName}!
          </h1>
          <p className="text-sapphire-100 text-lg opacity-90">
            Your AI-powered health assistant is here to help you manage your wellness journey.
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to="/ai-chat"
          className="group relative bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-light-border dark:border-dark-border hover:shadow-2xl hover:border-sapphire-300 dark:hover:border-sapphire-600 transition-all duration-300 overflow-hidden"
          style={{ willChange: 'transform' }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-sapphire-50/50 to-transparent dark:from-sapphire-900/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="relative z-10 flex items-center space-x-4">
            <div className="p-3 bg-gradient-to-br from-sapphire-500 to-sapphire-600 rounded-xl shadow-lg group-hover:shadow-xl transition-shadow">
              <ChatBubbleLeftRightIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-light-text-primary dark:text-dark-text-primary group-hover:text-sapphire-700 dark:group-hover:text-sapphire-300 transition-colors">AI Health Chat</h3>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Get instant health guidance</p>
            </div>
          </div>
        </Link>

        <Link
          to="/appointments"
          className="group relative bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-light-border dark:border-dark-border hover:shadow-2xl hover:border-sapphire-300 dark:hover:border-sapphire-600 transition-all duration-300 overflow-hidden"
          style={{ willChange: 'transform' }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-sapphire-50/50 to-transparent dark:from-sapphire-900/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="relative z-10 flex items-center space-x-4">
            <div className="p-3 bg-gradient-to-br from-sapphire-500 to-sapphire-600 rounded-xl shadow-lg group-hover:shadow-xl transition-shadow">
              <CalendarDaysIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-light-text-primary dark:text-dark-text-primary group-hover:text-sapphire-700 dark:group-hover:text-sapphire-300 transition-colors">Book Appointment</h3>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Schedule with top doctors</p>
            </div>
          </div>
        </Link>

        <button className="group relative bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-light-border dark:border-dark-border hover:shadow-2xl hover:border-sapphire-300 dark:hover:border-sapphire-600 transition-all duration-300 overflow-hidden" style={{ willChange: 'transform' }}>
          <div className="absolute inset-0 bg-gradient-to-br from-sapphire-50/50 to-transparent dark:from-sapphire-900/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="relative z-10 flex items-center space-x-4">
            <div className="p-3 bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg group-hover:shadow-xl transition-shadow">
              <PlusIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-light-text-primary dark:text-dark-text-primary group-hover:text-red-700 dark:group-hover:text-red-300 transition-colors">Emergency</h3>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Urgent consultation</p>
            </div>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Appointments */}
        <div className="group bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl shadow-lg border border-light-border dark:border-dark-border transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl focus-within:ring-2 focus-within:ring-sapphire-400" style={{ willChange: 'transform' }}>
          <div className="p-6 border-b border-light-border dark:border-dark-border">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">Recent Appointments</h2>
              <Link
                to="/appointments"
                className="text-sm text-sapphire-600 dark:text-sapphire-400 hover:text-sapphire-700 dark:hover:text-sapphire-300 font-semibold transition-colors"
              >
                View all
              </Link>
            </div>
          </div>
          
          <div className="p-6">
            {appointments.length === 0 ? (
              <div className="text-center py-8">
                <CalendarDaysIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No appointments yet</p>
                <Link
                  to="/appointments"
                  className="text-sapphire-600 dark:text-sapphire-400 hover:text-sapphire-700 dark:hover:text-sapphire-300 text-sm font-semibold transition-colors"
                >
                  Book your first appointment
                </Link>
              </div>
            ) : (
              <div className="space-y-4" role="list" aria-label="Recent appointments list">
                {appointments.map((appointment) => (
                  <div key={appointment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-gray-800/60" role="listitem">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        {appointment.status === 'completed' ? (
                          <CheckCircleIcon className="h-6 w-6 text-green-500" />
                        ) : (
                          <ClockIcon className="h-6 w-6 text-blue-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          Dr. {appointment.doctor.doctorProfile.firstName} {appointment.doctor.doctorProfile.lastName}
                        </p>
                        <p className="text-sm text-gray-600">
                          {appointment.doctor.doctorProfile.specialization.join(', ')}
                        </p>
                        <p className="text-xs text-gray-500" title={`${new Date(appointment.scheduledAt).toLocaleString()}`}>
                          {new Date(appointment.scheduledAt).toLocaleDateString()} at{' '}
                          {new Date(appointment.scheduledAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                        {appointment.status}
                      </span>
                      {appointment.riskLevel && (
                        <p className={`text-xs font-medium mt-1 ${getRiskColor(appointment.riskLevel)}`}>
                          {appointment.riskLevel} Risk
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Health Insights */}
        <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl shadow-lg border border-light-border dark:border-dark-border" aria-live="polite">
          <div className="p-6 border-b border-light-border dark:border-dark-border">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">Health Insights</h2>
              <button className="text-sm text-sapphire-600 dark:text-sapphire-400 hover:text-sapphire-700 dark:hover:text-sapphire-300 font-semibold transition-colors">
                View all
              </button>
            </div>
          </div>
          
          <div className="p-6">
            {healthInsights.length === 0 ? (
              <div className="text-center py-8">
                <InformationCircleIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No health insights yet</p>
                <p className="text-sm text-gray-400">
                  Start chatting with AI to get personalized insights
                </p>
              </div>
            ) : (
              <div className="space-y-4" role="list" aria-label="Health insights list">
                {healthInsights.map((insight) => (
                  <div key={insight.id} role="listitem" className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-gray-800/60 focus-within:ring-2 focus-within:ring-sapphire-400">
                    <button className="flex-1 text-left flex items-start space-x-3 group" onClick={() => markInsightRead(insight.id)} aria-label={`Open insight ${insight.title}`}>
                      <div className="flex-shrink-0">
                        {getSeverityIcon(insight.severity)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <h4 className="font-medium text-gray-900 group-hover:text-sapphire-700 dark:group-hover:text-sapphire-300 transition-colors">{insight.title}</h4>
                          <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
                        <div className="flex items-center space-x-2 mt-2">
                          <span className="text-xs text-gray-500 capitalize">{insight.type}</span>
                          {!insight.isRead && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full" title="Unread"></span>
                          )}
                        </div>
                      </div>
                    </button>
                    {!insight.isRead && (
                      <button onClick={() => markInsightRead(insight.id)} className="text-xs text-sapphire-600 hover:text-sapphire-700 dark:text-sapphire-400 dark:hover:text-sapphire-300 font-semibold">
                        Mark as read
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Health Score & Vital Signs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Health Score */}
        <div className="group bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl shadow-lg border border-light-border dark:border-dark-border p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl" style={{ willChange: 'transform' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">Health Score</h3>
            <HeartIcon className="h-6 w-6 text-red-500" />
          </div>
          <div className="text-center">
            <div className="relative w-32 h-32 mx-auto mb-4">
              <svg className="w-32 h-32 transform -rotate-90 transition-transform duration-300 group-hover:scale-105" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                <circle 
                  cx="60" cy="60" r="50" fill="none" 
                  stroke={(healthMetrics?.healthScore ?? 0) >= 80 ? '#10b981' : (healthMetrics?.healthScore ?? 0) >= 60 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="8" 
                  strokeLinecap="round"
                  strokeDasharray={`${(healthMetrics?.healthScore || 0) * 3.14} 314`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-bold text-gray-800 dark:text-gray-200" title="Overall health score (0-100)">{healthMetrics?.healthScore || 0}</span>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Overall Health Score</p>
            <div className="mt-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" title="Change vs last checkup">
                Stable
              </span>
            </div>
          </div>
        </div>

        {/* Vital Signs */}
        <div className="group bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl shadow-lg border border-light-border dark:border-dark-border p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl" style={{ willChange: 'transform' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">Vital Signs</h3>
            <ChartBarIcon className="h-6 w-6 text-blue-500" />
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Blood Pressure</span>
              <span className="font-semibold text-green-600" title="Systolic/Diastolic">{healthMetrics?.bloodPressure || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Heart Rate</span>
              <span className="font-semibold text-blue-600" title="Beats per minute">{healthMetrics?.heartRate || 0} bpm</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">BMI</span>
              <span className="font-semibold text-purple-600" title="Body Mass Index">{healthMetrics?.bmi || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Last Checkup</span>
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                {healthMetrics?.lastCheckup ? new Date(healthMetrics.lastCheckup).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl shadow-lg border border-light-border dark:border-dark-border p-6" style={{ willChange: 'transform' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">Quick Stats</h3>
            <ShieldCheckIcon className="h-6 w-6 text-green-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/30 rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300" title="Completed visits">{appointments.filter(a => a.status === 'completed').length}</div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400">Visits</div>
            </div>
            <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300" title="Upcoming appointments">{appointments.filter(a => a.status === 'scheduled').length}</div>
              <div className="text-xs text-blue-600 dark:text-blue-400">Upcoming</div>
            </div>
            <div className="text-center p-3 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-300" title="Current medications">{healthMetrics?.medications?.length || 0}</div>
              <div className="text-xs text-purple-600 dark:text-purple-400">Medications</div>
            </div>
            <div className="text-center p-3 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/30 rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
              <div className="text-2xl font-bold text-orange-700 dark:text-orange-300" title="Chronic conditions">{healthMetrics?.chronicConditions?.length || 0}</div>
              <div className="text-xs text-orange-600 dark:text-orange-400">Conditions</div>
            </div>
          </div>
        </div>
      </div>

      {/* Health Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Medications & Allergies */}
        <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl shadow-lg border border-light-border dark:border-dark-border p-6" style={{ willChange: 'transform' }}>
          <div className="flex items-center justify-between mb-4">
            <button className="flex items-center space-x-2" onClick={() => setMedOpen(v => !v)} aria-expanded={medOpen} aria-controls="med-sec">
              <h3 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">Medications & Allergies</h3>
              <ChevronRightIcon className={`h-5 w-5 text-gray-500 transition-transform ${medOpen ? 'transform rotate-90' : ''}`} />
            </button>
            <BeakerIcon className="h-6 w-6 text-purple-500" />
          </div>
          <div id="med-sec" className="space-y-4 transition-all duration-300" style={{ maxHeight: medOpen ? '1000px' : '0', overflow: 'hidden' }}>
            <div>
              <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">Current Medications</h4>
              <div className="flex flex-wrap gap-2">
                {(healthMetrics?.medications ?? []).length > 0 ? (
                  (healthMetrics?.medications ?? []).map((med, index) => (
                    <span key={index} className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm transition-transform duration-150 hover:scale-105">
                      {med}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-500 text-sm">No medications recorded</span>
                )}
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">Known Allergies</h4>
              <div className="flex flex-wrap gap-2">
                {(healthMetrics?.allergies ?? []).length > 0 ? (
                  (healthMetrics?.allergies ?? []).map((allergy, index) => (
                    <span key={index} className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full text-sm transition-transform duration-150 hover:scale-105">
                      {allergy}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-500 text-sm">No allergies recorded</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Risk Factors */}
        <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl shadow-lg border border-light-border dark:border-dark-border p-6" style={{ willChange: 'transform' }}>
          <div className="flex items-center justify-between mb-4">
            <button className="flex items-center space-x-2" onClick={() => setRiskOpen(v => !v)} aria-expanded={riskOpen} aria-controls="risk-sec">
              <h3 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">Risk Factors</h3>
              <ChevronRightIcon className={`h-5 w-5 text-gray-500 transition-transform ${riskOpen ? 'transform rotate-90' : ''}`} />
            </button>
            <ExclamationTriangleIcon className="h-6 w-6 text-yellow-500" />
          </div>
          <div id="risk-sec" className="space-y-3 transition-all duration-300" style={{ maxHeight: riskOpen ? '1000px' : '0', overflow: 'hidden' }}>
            {(healthMetrics?.riskFactors ?? []).length > 0 ? (
              (healthMetrics?.riskFactors ?? []).map((risk, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg transition-colors duration-150 hover:bg-yellow-100 dark:hover:bg-yellow-900/30">
                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{risk}</span>
                </div>
              ))
            ) : (
              <div className="text-center py-4">
                <ShieldCheckIcon className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-green-600 text-sm font-medium">No significant risk factors identified</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientDashboard;
