import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  CalendarDaysIcon,
  ClockIcon,
  UserIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  VideoCameraIcon,
  ChatBubbleLeftRightIcon,
  PhoneIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/LoadingSpinner';

interface Doctor {
  id: string;
  doctorProfile: {
    firstName: string;
    lastName: string;
    specialization: string[];
    consultationFee: number;
    qualityScore: number;
    experience: number;
    languages: string[];
  };
}

interface Appointment {
  id: string;
  scheduledAt: string;
  duration: number;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  type: 'VIDEO' | 'CHAT' | 'EMERGENCY';
  symptoms: string[];
  riskLevel: string;
  riskScore: number;
  paymentAmount: number;
  consultationNotes?: string;
  doctor: {
    doctorProfile: {
      firstName: string;
      lastName: string;
      specialization: string[];
    };
  };
  patient?: {
    patientProfile: {
      firstName: string;
      lastName: string;
    };
  };
}

const Appointments: React.FC = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [availableDoctors, setAvailableDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [bookingForm, setBookingForm] = useState({
    symptoms: '',
    preferredDate: '',
    preferredTime: '',
    consultationType: 'VIDEO' as 'VIDEO' | 'CHAT' | 'EMERGENCY'
  });
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadAppointments();
    if (user?.role === 'PATIENT') {
      loadAvailableDoctors();
    }
  }, [user]);

  const loadAppointments = async () => {
    try {
      const response = await axios.get('/api/appointments');
      setAppointments(response.data.data.appointments || []);
    } catch (error) {
      console.error('Failed to load appointments:', error);
      toast.error('Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableDoctors = async () => {
    try {
      const response = await axios.get('/api/appointments/doctors/available');
      setAvailableDoctors(response.data.data.doctors || []);
    } catch (error) {
      console.error('Failed to load doctors:', error);
    }
  };

  const handleBookAppointment = async () => {
    if (!selectedDoctor || !bookingForm.symptoms || !bookingForm.preferredDate || !bookingForm.preferredTime) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      const scheduledAt = new Date(`${bookingForm.preferredDate}T${bookingForm.preferredTime}`);
      const symptoms = bookingForm.symptoms.split(',').map(s => s.trim()).filter(s => s);

      const response = await axios.post('/api/appointments', {
        doctorId: selectedDoctor.id,
        scheduledAt: scheduledAt.toISOString(),
        symptoms,
        type: bookingForm.consultationType,
        duration: 30
      });

      toast.success('Appointment booked successfully!');
      setShowBookingModal(false);
      setBookingForm({
        symptoms: '',
        preferredDate: '',
        preferredTime: '',
        consultationType: 'VIDEO'
      });
      setSelectedDoctor(null);
      loadAppointments();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to book appointment');
    }
  };

  const updateAppointmentStatus = async (appointmentId: string, status: string) => {
    try {
      await axios.patch(`/api/appointments/${appointmentId}/status`, { status });
      toast.success('Appointment status updated');
      loadAppointments();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update appointment');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'IN_PROGRESS': return 'bg-green-50 text-green-700 border-green-200';
      case 'COMPLETED': return 'bg-gray-50 text-gray-700 border-gray-200';
      case 'CANCELLED': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
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

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'VIDEO': return <VideoCameraIcon className="h-5 w-5" />;
      case 'CHAT': return <ChatBubbleLeftRightIcon className="h-5 w-5" />;
      case 'EMERGENCY': return <PhoneIcon className="h-5 w-5" />;
      default: return <VideoCameraIcon className="h-5 w-5" />;
    }
  };

  const filteredAppointments = appointments.filter(apt => {
    const matchesStatus = filterStatus === 'all' || apt.status === filterStatus;
    const matchesSearch = searchTerm === '' || 
      apt.doctor.doctorProfile.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      apt.doctor.doctorProfile.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      apt.symptoms.some(symptom => symptom.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  if (loading) {
    return <LoadingSpinner text="Loading appointments..." />;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-800 to-blue-900 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Appointments</h1>
            <p className="text-blue-100">
              {user?.role === 'PATIENT' 
                ? 'Manage your healthcare appointments and book new consultations'
                : 'View and manage your patient appointments'
              }
            </p>
          </div>
          {user?.role === 'PATIENT' && (
            <button
              onClick={() => setShowBookingModal(true)}
              className="bg-white text-blue-800 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors flex items-center space-x-2"
            >
              <PlusIcon className="h-5 w-5" />
              <span>Book Appointment</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search appointments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center space-x-2">
              <FunnelIcon className="h-5 w-5 text-gray-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>
          <div className="text-sm text-gray-600">
            {filteredAppointments.length} appointment{filteredAppointments.length !== 1 ? 's' : ''} found
          </div>
        </div>
      </div>

      {/* Appointments List */}
      <div className="bg-white rounded-xl border border-gray-200">
        {filteredAppointments.length === 0 ? (
          <div className="text-center py-12">
            <CalendarDaysIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No appointments found</h3>
            <p className="text-gray-500 mb-6">
              {user?.role === 'PATIENT' 
                ? "You don't have any appointments yet. Book your first consultation!"
                : "No appointments match your current filters."
              }
            </p>
            {user?.role === 'PATIENT' && (
              <button
                onClick={() => setShowBookingModal(true)}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Book Your First Appointment
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredAppointments.map((appointment) => (
              <div key={appointment.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        {getTypeIcon(appointment.type)}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {user?.role === 'PATIENT' 
                            ? `Dr. ${appointment.doctor.doctorProfile.firstName} ${appointment.doctor.doctorProfile.lastName}`
                            : `${appointment.patient?.patientProfile.firstName} ${appointment.patient?.patientProfile.lastName}`
                          }
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(appointment.status)}`}>
                          {appointment.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                        <div className="flex items-center space-x-1">
                          <CalendarDaysIcon className="h-4 w-4" />
                          <span>{new Date(appointment.scheduledAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <ClockIcon className="h-4 w-4" />
                          <span>{new Date(appointment.scheduledAt).toLocaleTimeString()}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span>Duration: {appointment.duration} min</span>
                        </div>
                      </div>
                      {user?.role === 'PATIENT' && (
                        <div className="text-sm text-gray-600 mb-2">
                          <span className="font-medium">Specialization:</span> {appointment.doctor.doctorProfile.specialization.join(', ')}
                        </div>
                      )}
                      {appointment.symptoms.length > 0 && (
                        <div className="text-sm text-gray-600 mb-2">
                          <span className="font-medium">Symptoms:</span> {appointment.symptoms.join(', ')}
                        </div>
                      )}
                      {appointment.riskLevel && (
                        <div className="flex items-center space-x-2">
                          <ExclamationTriangleIcon className={`h-4 w-4 ${getRiskColor(appointment.riskLevel)}`} />
                          <span className={`text-sm font-medium ${getRiskColor(appointment.riskLevel)}`}>
                            {appointment.riskLevel} Risk (Score: {appointment.riskScore})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    <div className="text-lg font-semibold text-gray-900">
                      ₹{appointment.paymentAmount}
                    </div>
                    {user?.role === 'DOCTOR' && appointment.status === 'SCHEDULED' && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => updateAppointmentStatus(appointment.id, 'IN_PROGRESS')}
                          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                        >
                          Start
                        </button>
                        <button
                          onClick={() => updateAppointmentStatus(appointment.id, 'CANCELLED')}
                          className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    {user?.role === 'DOCTOR' && appointment.status === 'IN_PROGRESS' && (
                      <button
                        onClick={() => updateAppointmentStatus(appointment.id, 'COMPLETED')}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                      >
                        Complete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Book Appointment</h2>
                <button
                  onClick={() => setShowBookingModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {!selectedDoctor ? (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Choose a Doctor</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {availableDoctors.map((doctor) => (
                      <div
                        key={doctor.id}
                        onClick={() => setSelectedDoctor(doctor)}
                        className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-semibold text-gray-900">
                              Dr. {doctor.doctorProfile.firstName} {doctor.doctorProfile.lastName}
                            </h4>
                            <p className="text-sm text-gray-600">
                              {doctor.doctorProfile.specialization.join(', ')}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold text-blue-600">
                              ₹{doctor.doctorProfile.consultationFee}
                            </div>
                            <div className="flex items-center space-x-1">
                              <span className="text-sm text-gray-600">Quality:</span>
                              <span className="text-sm font-medium text-green-600">
                                {doctor.doctorProfile.qualityScore}/100
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm text-gray-600">
                          <span>{doctor.doctorProfile.experience} years experience</span>
                          <span>Languages: {doctor.doctorProfile.languages.join(', ')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                    <h3 className="font-semibold text-blue-900 mb-2">
                      Selected Doctor: Dr. {selectedDoctor.doctorProfile.firstName} {selectedDoctor.doctorProfile.lastName}
                    </h3>
                    <p className="text-blue-700 text-sm">
                      {selectedDoctor.doctorProfile.specialization.join(', ')} • ₹{selectedDoctor.doctorProfile.consultationFee}
                    </p>
                    <button
                      onClick={() => setSelectedDoctor(null)}
                      className="text-blue-600 text-sm hover:text-blue-800 mt-2"
                    >
                      Change Doctor
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Symptoms (separate with commas) *
                      </label>
                      <textarea
                        value={bookingForm.symptoms}
                        onChange={(e) => setBookingForm({...bookingForm, symptoms: e.target.value})}
                        placeholder="e.g., headache, fever, cough"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Preferred Date *
                        </label>
                        <input
                          type="date"
                          value={bookingForm.preferredDate}
                          onChange={(e) => setBookingForm({...bookingForm, preferredDate: e.target.value})}
                          min={new Date().toISOString().split('T')[0]}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Preferred Time *
                        </label>
                        <input
                          type="time"
                          value={bookingForm.preferredTime}
                          onChange={(e) => setBookingForm({...bookingForm, preferredTime: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Consultation Type
                      </label>
                      <div className="grid grid-cols-3 gap-4">
                        {['VIDEO', 'CHAT', 'EMERGENCY'].map((type) => (
                          <label key={type} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="radio"
                              name="consultationType"
                              value={type}
                              checked={bookingForm.consultationType === type}
                              onChange={(e) => setBookingForm({...bookingForm, consultationType: e.target.value as any})}
                              className="text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium">{type}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-4 mt-6 pt-6 border-t border-gray-200">
                    <button
                      onClick={() => setShowBookingModal(false)}
                      className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleBookAppointment}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Book Appointment
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Appointments;
