import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { useI18n } from '../contexts/I18nContext';
import {
  UsersIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  BellIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/LoadingSpinner';

interface SystemAlert {
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  isResolved: boolean;
  createdAt: string;
}

interface PlatformStats {
  totalUsers: number;
  totalDoctors: number;
  totalPatients: number;
  pendingVerifications: number;
  activeConsultations: number;
  systemUptime: number;
}

interface FraudAlert {
  id: string;
  type: string;
  description: string;
  riskScore: number;
  status: string;
  createdAt: string;
}

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { t, language } = useI18n();
  const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>([]);
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [alertsRes, statsRes, fraudRes] = await Promise.all([
        axios.get('/api/admin/system-alerts?limit=10'),
        axios.get('/api/admin/platform-stats'),
        axios.get('/api/admin/fraud-alerts?limit=5')
      ]);

      setSystemAlerts(alertsRes.data.data.alerts || []);
      setPlatformStats(statsRes.data.data || null);
      setFraudAlerts(fraudRes.data.data.alerts || []);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />;
      case 'high': return <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" />;
      case 'medium': return <BellIcon className="h-5 w-5 text-yellow-500" />;
      default: return <BellIcon className="h-5 w-5 text-blue-500" />;
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 80) return 'text-red-600 bg-red-50';
    if (score >= 60) return 'text-orange-600 bg-orange-50';
    if (score >= 40) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  if (loading) {
    return <LoadingSpinner text={t('loading.admin_dashboard')} />;
  }

  const criticalAlerts = systemAlerts.filter(alert => alert.severity === 'critical' && !alert.isResolved);
  const pendingFraud = fraudAlerts.filter(alert => alert.status === 'pending');

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">
          {t('admin.title', { name: user?.profile.firstName || '' })}
        </h1>
        <p className="text-purple-100">
          {t('admin.subtitle')}
        </p>
      </div>

      {/* Critical Alerts Banner */}
      {criticalAlerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-600 mr-3" />
            <div>
              <h3 className="text-red-800 font-medium">{t('admin.critical_alerts_title')}</h3>
              <p className="text-red-700 text-sm">
                {t('admin.critical_alerts_subtitle', {
                  count: criticalAlerts.length,
                  plural: language === 'en' && criticalAlerts.length !== 1 ? 's' : ''
                })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Platform Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <UsersIcon className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">{platformStats?.totalUsers || 0}</p>
              <p className="text-sm text-gray-600">{t('admin.total_users')}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <ShieldCheckIcon className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">{platformStats?.totalDoctors || 0}</p>
              <p className="text-sm text-gray-600">{t('admin.verified_doctors')}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <ClockIcon className="h-8 w-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">{platformStats?.pendingVerifications || 0}</p>
              <p className="text-sm text-gray-600">{t('admin.pending_verifications')}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <ChartBarIcon className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">{platformStats?.systemUptime?.toFixed(1) || '99.9'}%</p>
              <p className="text-sm text-gray-600">{t('admin.system_uptime')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Alerts */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{t('admin.system_alerts')}</h2>
              <button className="text-sm text-blue-600 hover:text-blue-700">
                {t('admin.view_all')}
              </button>
            </div>
          </div>
          
          <div className="p-6">
            {systemAlerts.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircleIcon className="h-12 w-12 text-green-300 mx-auto mb-4" />
                <p className="text-gray-500">{t('admin.all_systems_operational')}</p>
                <p className="text-sm text-gray-400">{t('admin.no_alerts')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {systemAlerts.slice(0, 5).map((alert) => (
                  <div key={alert.id} className={`p-4 rounded-lg border ${getSeverityColor(alert.severity)}`}>
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        {alert.isResolved ? (
                          <CheckCircleIcon className="h-5 w-5 text-green-500" />
                        ) : (
                          getSeverityIcon(alert.severity)
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-gray-900">{alert.title}</h4>
                          <span className="text-xs text-gray-500">
                            {new Date(alert.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{alert.description}</p>
                        <div className="flex items-center space-x-2 mt-2">
                          <span className="text-xs font-medium capitalize">{alert.type}</span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs capitalize">{alert.severity}</span>
                          {alert.isResolved && (
                            <>
                              <span className="text-xs text-gray-400">•</span>
                              <span className="text-xs text-green-600">{t('admin.resolved')}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Fraud Detection */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{t('admin.fraud_detection')}</h2>
              <button className="text-sm text-blue-600 hover:text-blue-700">
                {t('admin.view_all')}
              </button>
            </div>
          </div>
          
          <div className="p-6">
            {fraudAlerts.length === 0 ? (
              <div className="text-center py-8">
                <ShieldCheckIcon className="h-12 w-12 text-green-300 mx-auto mb-4" />
                <p className="text-gray-500">{t('admin.no_fraud_alerts')}</p>
                <p className="text-sm text-gray-400">{t('admin.system_secure')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {fraudAlerts.map((alert) => (
                  <div key={alert.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium text-gray-900 capitalize">{alert.type}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskColor(alert.riskScore)}`}>
                            Risk: {alert.riskScore}%
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{alert.description}</p>
                        <div className="flex items-center space-x-2 mt-2">
                          <span className="text-xs text-gray-500">
                            {new Date(alert.createdAt).toLocaleDateString()}
                          </span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className={`text-xs font-medium ${
                            alert.status === 'pending' ? 'text-yellow-600' : 
                            alert.status === 'resolved' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {alert.status}
                          </span>
                        </div>
                      </div>
                      {alert.status === 'pending' && (
                        <div className="flex space-x-2 ml-4">
                          <button className="p-1 text-green-600 hover:bg-green-50 rounded">
                            <CheckCircleIcon className="h-4 w-4" />
                          </button>
                          <button className="p-1 text-red-600 hover:bg-red-50 rounded">
                            <XCircleIcon className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Admin Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button className="flex items-center p-4 border rounded-lg hover:shadow-md transition-shadow">
            <UsersIcon className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <h3 className="font-medium text-gray-900">Manage Users</h3>
              <p className="text-sm text-gray-600">View and edit user accounts</p>
            </div>
          </button>

          <button className="flex items-center p-4 border rounded-lg hover:shadow-md transition-shadow">
            <ShieldCheckIcon className="h-8 w-8 text-green-600 mr-3" />
            <div>
              <h3 className="font-medium text-gray-900">Doctor Verification</h3>
              <p className="text-sm text-gray-600">Review pending applications</p>
            </div>
          </button>

          <button className="flex items-center p-4 border rounded-lg hover:shadow-md transition-shadow">
            <ChartBarIcon className="h-8 w-8 text-purple-600 mr-3" />
            <div>
              <h3 className="font-medium text-gray-900">Analytics</h3>
              <p className="text-sm text-gray-600">Platform performance metrics</p>
            </div>
          </button>

          <Link
            to="/ai-chat"
            className="flex items-center p-4 border rounded-lg hover:shadow-md transition-shadow"
          >
            <BellIcon className="h-8 w-8 text-orange-600 mr-3" />
            <div>
              <h3 className="font-medium text-gray-900">AI Assistant</h3>
              <p className="text-sm text-gray-600">System management help</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
        </div>
        
        <div className="p-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-3 text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-gray-600">System backup completed successfully</span>
              <span className="text-gray-400">2 hours ago</span>
            </div>
            <div className="flex items-center space-x-3 text-sm">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-gray-600">New doctor verification request received</span>
              <span className="text-gray-400">4 hours ago</span>
            </div>
            <div className="flex items-center space-x-3 text-sm">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <span className="text-gray-600">High traffic detected - auto-scaling activated</span>
              <span className="text-gray-400">6 hours ago</span>
            </div>
            <div className="flex items-center space-x-3 text-sm">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span className="text-gray-600">Monthly compliance report generated</span>
              <span className="text-gray-400">1 day ago</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
