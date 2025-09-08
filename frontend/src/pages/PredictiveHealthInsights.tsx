import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  ArrowUpIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ClockIcon,
  MapPinIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/LoadingSpinner';

interface HealthInsight {
  id: string;
  type: 'preventive' | 'risk' | 'trend' | 'emergency';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  predictedDate?: string;
  affectedRegion?: string;
  recommendations: string[];
  riskFactors: string[];
  aiGenerated: boolean;
  createdAt: string;
}

interface PredictiveMetric {
  id: string;
  metric: string;
  currentValue: number;
  predictedValue: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  timeframe: string;
  confidence: number;
}

const PredictiveHealthInsights: React.FC = () => {
  const [insights, setInsights] = useState<HealthInsight[]>([]);
  const [metrics, setMetrics] = useState<PredictiveMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('insights');

  useEffect(() => {
    loadPredictiveData();
  }, []);

  const loadPredictiveData = async () => {
    try {
      setLoading(true);
      const [insightsRes, metricsRes] = await Promise.all([
        axios.get('/api/predictive-insights'),
        axios.get('/api/predictive-metrics')
      ]);

      setInsights(insightsRes.data.data.insights || []);
      setMetrics(metricsRes.data.data.metrics || []);
    } catch (error) {
      toast.error('Failed to load predictive health insights');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-700 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700';
      case 'high': return 'text-orange-700 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700';
      case 'medium': return 'text-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700';
      case 'low': return 'text-blue-700 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700';
      default: return 'text-gray-700 bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />;
      case 'high': return <ExclamationTriangleIcon className="h-5 w-5 text-orange-600" />;
      default: return <InformationCircleIcon className="h-5 w-5 text-blue-600" />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return <ArrowTrendingUpIcon className="h-4 w-4 text-red-600" />;
      case 'decreasing': return <ArrowTrendingDownIcon className="h-4 w-4 text-green-600" />;
      default: return <ClockIcon className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'preventive': return 'text-green-700 bg-green-50 dark:bg-green-900/20';
      case 'risk': return 'text-red-700 bg-red-50 dark:bg-red-900/20';
      case 'trend': return 'text-blue-700 bg-blue-50 dark:bg-blue-900/20';
      case 'emergency': return 'text-purple-700 bg-purple-50 dark:bg-purple-900/20';
      default: return 'text-gray-700 bg-gray-50 dark:bg-gray-900/20';
    }
  };

  const tabs = [
    { id: 'insights', name: 'Health Insights', icon: ArrowUpIcon },
    { id: 'metrics', name: 'Predictive Metrics', icon: ChartBarIcon },
    { id: 'trends', name: 'Regional Trends', icon: MapPinIcon }
  ];

  if (loading) {
    return <LoadingSpinner text="Analyzing health trends..." />;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-sapphire-600 via-sapphire-700 to-sapphire-800 dark:from-sapphire-700 dark:via-sapphire-800 dark:to-sapphire-900 rounded-2xl p-8 text-white shadow-2xl">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-white/20 rounded-xl">
            <ArrowUpIcon className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-2">Predictive Health Insights</h1>
            <p className="text-sapphire-100">AI-powered analysis for preventive healthcare and early disease detection</p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl p-6 border border-light-border dark:border-dark-border">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-sapphire-100 dark:bg-sapphire-900 rounded-xl">
              <ArrowUpIcon className="h-6 w-6 text-sapphire-700 dark:text-sapphire-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">{insights.length}</p>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Active Insights</p>
            </div>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl p-6 border border-light-border dark:border-dark-border">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-red-100 dark:bg-red-900 rounded-xl">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-700 dark:text-red-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">
                {insights.filter(i => i.severity === 'high' || i.severity === 'critical').length}
              </p>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">High Risk Alerts</p>
            </div>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl p-6 border border-light-border dark:border-dark-border">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900 rounded-xl">
              <ChartBarIcon className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">{metrics.length}</p>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Tracked Metrics</p>
            </div>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl p-6 border border-light-border dark:border-dark-border">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-xl">
              <InformationCircleIcon className="h-6 w-6 text-blue-700 dark:text-blue-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">
                {Math.round(insights.reduce((acc, i) => acc + i.confidence, 0) / insights.length || 0)}%
              </p>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">AI Confidence</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl border border-light-border dark:border-dark-border">
        <div className="border-b border-light-border dark:border-dark-border">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-sapphire-600 text-sapphire-700 dark:text-sapphire-300'
                      : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Health Insights Tab */}
          {activeTab === 'insights' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">AI Health Insights</h3>
                <button
                  onClick={loadPredictiveData}
                  className="text-sm text-sapphire-600 dark:text-sapphire-400 hover:text-sapphire-700 dark:hover:text-sapphire-300 font-medium"
                >
                  Refresh Insights
                </button>
              </div>

              {insights.length === 0 ? (
                <div className="text-center py-12">
                  <ArrowUpIcon className="h-16 w-16 text-light-text-secondary dark:text-dark-text-secondary mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-light-text-primary dark:text-dark-text-primary mb-2">No insights available</h3>
                  <p className="text-light-text-secondary dark:text-dark-text-secondary">AI analysis in progress. Check back later for preventive insights.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {insights.map((insight) => (
                    <div key={insight.id} className={`rounded-2xl p-6 border-2 ${getSeverityColor(insight.severity)}`}>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          {getSeverityIcon(insight.severity)}
                          <div>
                            <h4 className="font-bold text-light-text-primary dark:text-dark-text-primary">{insight.title}</h4>
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(insight.type)}`}>
                              {insight.type}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary">
                            {Math.round(insight.confidence * 100)}% confidence
                          </span>
                          {insight.predictedDate && (
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                              By {new Date(insight.predictedDate).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>

                      <p className="text-light-text-primary dark:text-dark-text-primary mb-4">{insight.description}</p>

                      {insight.riskFactors.length > 0 && (
                        <div className="mb-4">
                          <h5 className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">Risk Factors:</h5>
                          <div className="flex flex-wrap gap-2">
                            {insight.riskFactors.map((factor, idx) => (
                              <span key={idx} className="px-2 py-1 bg-white/50 dark:bg-dark-surface/50 rounded-full text-xs">
                                {factor}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {insight.recommendations.length > 0 && (
                        <div>
                          <h5 className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">Recommendations:</h5>
                          <ul className="space-y-1">
                            {insight.recommendations.map((rec, idx) => (
                              <li key={idx} className="text-sm text-light-text-primary dark:text-dark-text-primary flex items-start space-x-2">
                                <span className="text-sapphire-600 dark:text-sapphire-400 mt-1">•</span>
                                <span>{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {insight.affectedRegion && (
                        <div className="mt-4 pt-4 border-t border-light-border dark:border-dark-border">
                          <div className="flex items-center space-x-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            <MapPinIcon className="h-4 w-4" />
                            <span>Regional impact: {insight.affectedRegion}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Predictive Metrics Tab */}
          {activeTab === 'metrics' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">Predictive Health Metrics</h3>
              <p className="text-light-text-secondary dark:text-dark-text-secondary">AI-driven predictions for your health indicators</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {metrics.map((metric) => (
                  <div key={metric.id} className="bg-white/60 dark:bg-dark-surface/60 backdrop-blur-sm rounded-xl p-6 border border-light-border dark:border-dark-border">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-light-text-primary dark:text-dark-text-primary">{metric.metric}</h4>
                      <div className="flex items-center space-x-2">
                        {getTrendIcon(metric.trend)}
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          metric.trend === 'increasing' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' :
                          metric.trend === 'decreasing' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {metric.trend}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Current Value</span>
                        <span className="font-bold text-light-text-primary dark:text-dark-text-primary">{metric.currentValue}</span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Predicted ({metric.timeframe})</span>
                        <span className={`font-bold ${
                          metric.trend === 'increasing' ? 'text-red-600 dark:text-red-400' :
                          metric.trend === 'decreasing' ? 'text-green-600 dark:text-green-400' :
                          'text-light-text-primary dark:text-dark-text-primary'
                        }`}>
                          {metric.predictedValue}
                        </span>
                      </div>

                      <div className="w-full bg-light-border dark:bg-dark-border rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            metric.trend === 'increasing' ? 'bg-gradient-to-r from-yellow-400 to-red-500' :
                            metric.trend === 'decreasing' ? 'bg-gradient-to-r from-green-400 to-green-600' :
                            'bg-gray-400'
                          }`}
                          style={{ width: `${Math.min(metric.confidence, 100)}%` }}
                        ></div>
                      </div>

                      <div className="flex justify-between items-center text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        <span>AI Confidence: {Math.round(metric.confidence)}%</span>
                        <span>{metric.timeframe}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Regional Trends Tab */}
          {activeTab === 'trends' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">Regional Health Trends</h3>
              <p className="text-light-text-secondary dark:text-dark-text-secondary">AI analysis of health trends in your region</p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white/60 dark:bg-dark-surface/60 backdrop-blur-sm rounded-xl p-6 border border-light-border dark:border-dark-border">
                  <h4 className="font-semibold text-light-text-primary dark:text-dark-text-primary mb-4">Disease Outbreak Predictions</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <div>
                        <p className="font-medium text-red-900 dark:text-red-200">Seasonal Flu</p>
                        <p className="text-sm text-red-700 dark:text-red-300">High risk in 2 weeks</p>
                      </div>
                      <span className="px-2 py-1 bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-300 rounded-full text-xs">
                        85% confidence
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <div>
                        <p className="font-medium text-yellow-900 dark:text-yellow-200">Allergies</p>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300">Peak season approaching</p>
                      </div>
                      <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-300 rounded-full text-xs">
                        72% confidence
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div>
                        <p className="font-medium text-blue-900 dark:text-blue-200">Respiratory Issues</p>
                        <p className="text-sm text-blue-700 dark:text-blue-300">Stable conditions</p>
                      </div>
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-300 rounded-full text-xs">
                        60% confidence
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white/60 dark:bg-dark-surface/60 backdrop-blur-sm rounded-xl p-6 border border-light-border dark:border-dark-border">
                  <h4 className="font-semibold text-light-text-primary dark:text-dark-text-primary mb-4">Preventive Recommendations</h4>
                  <div className="space-y-3">
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                      <p className="font-medium text-emerald-900 dark:text-emerald-200 mb-1">Vaccination Reminder</p>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300">Flu vaccine recommended for high-risk individuals</p>
                    </div>

                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="font-medium text-blue-900 dark:text-blue-200 mb-1">Air Quality Alert</p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">Consider indoor activities during peak pollution hours</p>
                    </div>

                    <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <p className="font-medium text-purple-900 dark:text-purple-200 mb-1">Mental Health</p>
                      <p className="text-sm text-purple-700 dark:text-purple-300">Seasonal affective disorder awareness in your region</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PredictiveHealthInsights;
