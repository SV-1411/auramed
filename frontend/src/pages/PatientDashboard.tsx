import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import {
  ChatBubbleLeftRightIcon,
  CalendarDaysIcon,
  HeartIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CheckCircleIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/LoadingSpinner';

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

const PatientDashboard: React.FC = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [healthInsights, setHealthInsights] = useState<HealthInsight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [appointmentsRes, insightsRes] = await Promise.all([
        axios.get('/api/appointments?limit=5'),
        axios.get('/api/health-insights?limit=5')
      ]);

      setAppointments(appointmentsRes.data.data.appointments || []);
      setHealthInsights(insightsRes.data.data.insights || []);
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
      default: return <HeartIcon className="h-5 w-5 text-blue-500" />;
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading your dashboard..." />;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">
          Welcome back, {user?.profile.firstName}!
        </h1>
        <p className="text-blue-100">
          Your AI-powered health assistant is here to help you manage your wellness journey.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/ai-chat"
          className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center space-x-3">
            <ChatBubbleLeftRightIcon className="h-8 w-8 text-blue-600 group-hover:text-blue-700" />
            <div>
              <h3 className="font-semibold text-gray-900">AI Health Chat</h3>
              <p className="text-sm text-gray-600">Get instant health guidance</p>
            </div>
          </div>
        </Link>

        <Link
          to="/appointments"
          className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center space-x-3">
            <CalendarDaysIcon className="h-8 w-8 text-green-600 group-hover:text-green-700" />
            <div>
              <h3 className="font-semibold text-gray-900">Book Appointment</h3>
              <p className="text-sm text-gray-600">Schedule with top doctors</p>
            </div>
          </div>
        </Link>

        <button className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow group">
          <div className="flex items-center space-x-3">
            <PlusIcon className="h-8 w-8 text-purple-600 group-hover:text-purple-700" />
            <div>
              <h3 className="font-semibold text-gray-900">Emergency</h3>
              <p className="text-sm text-gray-600">Urgent consultation</p>
            </div>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Appointments */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Recent Appointments</h2>
              <Link
                to="/appointments"
                className="text-sm text-blue-600 hover:text-blue-700"
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
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Book your first appointment
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {appointments.map((appointment) => (
                  <div key={appointment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
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
                        <p className="text-xs text-gray-500">
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
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Health Insights</h2>
              <button className="text-sm text-blue-600 hover:text-blue-700">
                View all
              </button>
            </div>
          </div>
          
          <div className="p-6">
            {healthInsights.length === 0 ? (
              <div className="text-center py-8">
                <HeartIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No health insights yet</p>
                <p className="text-sm text-gray-400">
                  Start chatting with AI to get personalized insights
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {healthInsights.map((insight) => (
                  <div key={insight.id} className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0">
                      {getSeverityIcon(insight.severity)}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{insight.title}</h4>
                      <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
                      <div className="flex items-center space-x-2 mt-2">
                        <span className="text-xs text-gray-500 capitalize">{insight.type}</span>
                        {!insight.isRead && (
                          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Health Stats */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Health Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">0</div>
            <div className="text-sm text-gray-600">Active Conditions</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{appointments.filter(a => a.status === 'completed').length}</div>
            <div className="text-sm text-gray-600">Completed Visits</div>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{appointments.filter(a => a.status === 'scheduled').length}</div>
            <div className="text-sm text-gray-600">Upcoming Visits</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">0</div>
            <div className="text-sm text-gray-600">Medications</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientDashboard;
