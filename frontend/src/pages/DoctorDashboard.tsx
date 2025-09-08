import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import {
  CalendarDaysIcon,
  UserGroupIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  StarIcon,
  BellIcon,
  HeartIcon,
  ArrowTrendingUpIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/LoadingSpinner';

interface Appointment {
  id: string;
  scheduledAt: string;
  status: string;
  patient: {
    patientProfile: {
      firstName: string;
      lastName: string;
      dateOfBirth: string;
    };
  };
  riskLevel: string;
  symptoms?: string[];
}

interface QualityMetrics {
  patientSatisfactionScore: number;
  averageConsultationTime: number;
  totalConsultations: number;
  responseTimeScore: number;
  treatmentSuccessRate: number;
}

interface PatientInsights {
  totalPatients: number;
  newPatientsThisMonth: number;
  criticalCases: number;
  followUpRequired: number;
  patientAgeDistribution: { ageGroup: string; count: number }[];
  commonConditions: { condition: string; count: number }[];
}

const DoctorDashboard: React.FC = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetrics | null>(null);
  const [patientInsights, setPatientInsights] = useState<PatientInsights | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [appointmentsRes, metricsRes, insightsRes] = await Promise.all([
        axios.get('/api/appointments?limit=10'),
        axios.get('/api/doctor/quality-metrics').catch(() => ({ data: { data: null } })),
        axios.get('/api/doctor/patient-insights').catch(() => ({ data: { data: null } }))
      ]);

      setAppointments(appointmentsRes.data.data.appointments || []);
      // Use API data only; do not inject demo defaults
      setQualityMetrics(metricsRes.data.data || null);
      setPatientInsights(insightsRes.data.data || null);
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
      case 'critical': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getPatientAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  if (loading) {
    return <LoadingSpinner text="Loading your dashboard..." />;
  }

  const todayAppointments = appointments.filter(apt => 
    new Date(apt.scheduledAt).toDateString() === new Date().toDateString()
  );

  const upcomingAppointments = appointments.filter(apt => 
    new Date(apt.scheduledAt) > new Date() && 
    new Date(apt.scheduledAt).toDateString() !== new Date().toDateString()
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-800 to-blue-900 rounded-xl p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">
          Good morning, Dr. {user?.profile.firstName}!
        </h1>
        <p className="text-blue-100">
          You have {todayAppointments.length} appointments today. Your AI assistant is ready to help.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-light-border dark:border-dark-border transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">{todayAppointments.length}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Today's Appointments</p>
            </div>
            <CalendarDaysIcon className="h-12 w-12 text-blue-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-light-border dark:border-dark-border transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-green-700 dark:text-green-400">{patientInsights?.totalPatients || 0}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Patients</p>
            </div>
            <UserGroupIcon className="h-12 w-12 text-green-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-light-border dark:border-dark-border transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-yellow-700 dark:text-yellow-400">
                {qualityMetrics?.patientSatisfactionScore?.toFixed(1) || '0.0'}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Satisfaction Score</p>
            </div>
            <StarIcon className="h-12 w-12 text-yellow-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-light-border dark:border-dark-border transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-purple-700 dark:text-purple-400">
                {qualityMetrics?.treatmentSuccessRate?.toFixed(0) || '0'}%
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Success Rate</p>
            </div>
            <ArrowTrendingUpIcon className="h-12 w-12 text-purple-500 opacity-20" />
          </div>
        </div>
      </div>

      {/* Patient Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Patient Demographics */}
        <div className="group bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl shadow-lg border border-light-border dark:border-dark-border p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">Patient Demographics</h3>
            <UserIcon className="h-6 w-6 text-blue-500" />
          </div>
          <div className="space-y-4">
            {patientInsights?.patientAgeDistribution?.map((group, index) => (
              <div key={index} className="flex items-center justify-between transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-800/40 rounded-md px-2 py-1">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{group.ageGroup} years</span>
                <div className="flex items-center space-x-3">
                  <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-200 group-hover:brightness-110" 
                      style={{ width: `${(group.count / (patientInsights?.totalPatients || 1)) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100 w-8">{group.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Common Conditions */}
        <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl shadow-lg border border-light-border dark:border-dark-border p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">Common Conditions</h3>
            <HeartIcon className="h-6 w-6 text-red-500" />
          </div>
          <div className="space-y-4">
            {patientInsights?.commonConditions?.map((condition, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 rounded-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{condition.condition}</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-red-700 dark:text-red-400">{condition.count}</span>
                  <span className="text-xs text-gray-500">patients</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Critical Cases & Follow-ups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl shadow-lg border border-light-border dark:border-dark-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">Attention Required</h3>
            <ExclamationTriangleIcon className="h-6 w-6 text-orange-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
              <div className="text-3xl font-bold text-red-700 dark:text-red-300">{patientInsights?.criticalCases || 0}</div>
              <div className="text-sm text-red-600 dark:text-red-400">Critical Cases</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/30 rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
              <div className="text-3xl font-bold text-orange-700 dark:text-orange-300">{patientInsights?.followUpRequired || 0}</div>
              <div className="text-sm text-orange-600 dark:text-orange-400">Follow-ups</div>
            </div>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl shadow-lg border border-light-border dark:border-dark-border p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">Monthly Growth</h3>
            <ArrowTrendingUpIcon className="h-6 w-6 text-green-500" />
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-green-700 dark:text-green-300 mb-2">
              +{patientInsights?.newPatientsThisMonth || 0}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">New patients this month</p>
            <div className="mt-4 p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg">
              <p className="text-xs text-green-700 dark:text-green-400">📈 Growing patient base indicates excellent care quality</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Appointments */}
        <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl shadow-lg border border-light-border dark:border-dark-border transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Today's Schedule</h2>
              <Link
                to="/appointments"
                className="text-sm text-blue-700 hover:text-blue-800 font-medium"
              >
                View all
              </Link>
            </div>
          </div>
          
          <div className="p-6">
            {todayAppointments.length === 0 ? (
              <div className="text-center py-8">
                <CalendarDaysIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No appointments today</p>
                <p className="text-sm text-gray-400">Enjoy your day off!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {todayAppointments.map((appointment) => (
                  <div key={appointment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-gray-800/60">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        {appointment.status === 'completed' ? (
                          <CheckCircleIcon className="h-6 w-6 text-green-500" />
                        ) : appointment.riskLevel === 'critical' ? (
                          <ExclamationTriangleIcon className="h-6 w-6 text-red-500" />
                        ) : (
                          <ClockIcon className="h-6 w-6 text-blue-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {appointment.patient.patientProfile.firstName} {appointment.patient.patientProfile.lastName}
                        </p>
                        <p className="text-sm text-gray-600">
                          Age {getPatientAge(appointment.patient.patientProfile.dateOfBirth)} • {' '}
                          {new Date(appointment.scheduledAt).toLocaleTimeString()}
                        </p>
                        {appointment.symptoms && appointment.symptoms.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            Symptoms: {appointment.symptoms.slice(0, 2).join(', ')}
                            {appointment.symptoms.length > 2 && '...'}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                        {appointment.status}
                      </span>
                      {appointment.riskLevel && (
                        <p className={`text-xs font-medium mt-1 px-2 py-1 rounded-full ${getRiskColor(appointment.riskLevel)}`}>
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

        {/* Performance Metrics */}
        <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl shadow-lg border border-light-border dark:border-dark-border transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Performance Metrics</h2>
          </div>
          
          <div className="p-6">
            {qualityMetrics ? (
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Patient Satisfaction</span>
                    <span className="text-sm text-gray-900">{qualityMetrics.patientSatisfactionScore.toFixed(1)}/5.0</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${(qualityMetrics.patientSatisfactionScore / 5) * 100}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Response Time Score</span>
                    <span className="text-sm text-gray-900">{qualityMetrics.responseTimeScore.toFixed(1)}/5.0</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${(qualityMetrics.responseTimeScore / 5) * 100}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Treatment Success Rate</span>
                    <span className="text-sm text-gray-900">{qualityMetrics.treatmentSuccessRate.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${qualityMetrics.treatmentSuccessRate}%` }}
                    ></div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Avg. Consultation Time</span>
                    <span className="text-sm text-gray-900">{qualityMetrics.averageConsultationTime} min</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <ChartBarIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No metrics available yet</p>
                <p className="text-sm text-gray-400">Complete consultations to see your performance</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming Appointments */}
      {upcomingAppointments.length > 0 && (
        <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl shadow-lg border border-light-border dark:border-dark-border transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Upcoming Appointments</h2>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingAppointments.slice(0, 6).map((appointment) => (
                <div key={appointment.id} className="p-4 border border-gray-200 rounded-xl hover:shadow-md hover:border-blue-200 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">
                      {appointment.patient.patientProfile.firstName} {appointment.patient.patientProfile.lastName}
                    </h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskColor(appointment.riskLevel)}`}>
                      {appointment.riskLevel}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {new Date(appointment.scheduledAt).toLocaleDateString()} at{' '}
                    {new Date(appointment.scheduledAt).toLocaleTimeString()}
                  </p>
                  <p className="text-sm text-gray-500">
                    Age {getPatientAge(appointment.patient.patientProfile.dateOfBirth)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl shadow-lg border border-light-border dark:border-dark-border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/ai-chat"
            className="flex items-center p-4 border border-gray-200 rounded-xl hover:shadow-md hover:border-blue-200 transition-all"
          >
            <BellIcon className="h-8 w-8 text-blue-700 mr-3" />
            <div>
              <h3 className="font-medium text-gray-900">AI Assistant</h3>
              <p className="text-sm text-gray-600">Get AI-powered insights</p>
            </div>
          </Link>

          <button className="flex items-center p-4 border border-gray-200 rounded-xl hover:shadow-md hover:border-blue-200 transition-all">
            <CalendarDaysIcon className="h-8 w-8 text-blue-700 mr-3" />
            <div>
              <h3 className="font-medium text-gray-900">Manage Schedule</h3>
              <p className="text-sm text-gray-600">Update availability</p>
            </div>
          </button>

          <button className="flex items-center p-4 border border-gray-200 rounded-xl hover:shadow-md hover:border-blue-200 transition-all">
            <ChartBarIcon className="h-8 w-8 text-blue-700 mr-3" />
            <div>
              <h3 className="font-medium text-gray-900">View Reports</h3>
              <p className="text-sm text-gray-600">Performance analytics</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DoctorDashboard;
