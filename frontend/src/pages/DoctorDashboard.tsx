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
  BellIcon
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

const DoctorDashboard: React.FC = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [appointmentsRes, metricsRes] = await Promise.all([
        axios.get('/api/appointments?limit=10'),
        axios.get('/api/doctor/quality-metrics')
      ]);

      setAppointments(appointmentsRes.data.data.appointments || []);
      setQualityMetrics(metricsRes.data.data || null);
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
      <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">
          Good morning, Dr. {user?.profile.firstName}!
        </h1>
        <p className="text-green-100">
          You have {todayAppointments.length} appointments today. Your AI assistant is ready to help.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <CalendarDaysIcon className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">{todayAppointments.length}</p>
              <p className="text-sm text-gray-600">Today's Appointments</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <UserGroupIcon className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">{qualityMetrics?.totalConsultations || 0}</p>
              <p className="text-sm text-gray-600">Total Patients</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <StarIcon className="h-8 w-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">
                {qualityMetrics?.patientSatisfactionScore?.toFixed(1) || '0.0'}
              </p>
              <p className="text-sm text-gray-600">Satisfaction Score</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <ChartBarIcon className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">
                {qualityMetrics?.treatmentSuccessRate?.toFixed(0) || '0'}%
              </p>
              <p className="text-sm text-gray-600">Success Rate</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Appointments */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Today's Schedule</h2>
              <Link
                to="/appointments"
                className="text-sm text-blue-600 hover:text-blue-700"
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
                  <div key={appointment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
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
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
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
                      className="bg-green-600 h-2 rounded-full" 
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
                      className="bg-purple-600 h-2 rounded-full" 
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
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Upcoming Appointments</h2>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingAppointments.slice(0, 6).map((appointment) => (
                <div key={appointment.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
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
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/ai-chat"
            className="flex items-center p-4 border rounded-lg hover:shadow-md transition-shadow"
          >
            <BellIcon className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <h3 className="font-medium text-gray-900">AI Assistant</h3>
              <p className="text-sm text-gray-600">Get AI-powered insights</p>
            </div>
          </Link>

          <button className="flex items-center p-4 border rounded-lg hover:shadow-md transition-shadow">
            <CalendarDaysIcon className="h-8 w-8 text-green-600 mr-3" />
            <div>
              <h3 className="font-medium text-gray-900">Manage Schedule</h3>
              <p className="text-sm text-gray-600">Update availability</p>
            </div>
          </button>

          <button className="flex items-center p-4 border rounded-lg hover:shadow-md transition-shadow">
            <ChartBarIcon className="h-8 w-8 text-purple-600 mr-3" />
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
