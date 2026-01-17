import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import {
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  MapPinIcon,
  StarIcon,
  UserIcon,
  CalendarIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

type SlotHold = {
  id: string;
  doctorId: string;
  patientId: string;
  scheduledAt: string;
  expiresAt: string;
  status: 'HELD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';
};

interface SymptomAnalysis {
  symptoms: string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number;
  urgency: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  recommendedSpecializations: string[];
  aiExplanation: string;
  confidence: number;
}

interface DoctorRecommendation {
  doctorId: string;
  doctor: {
    id: string;
    profile: any;
    name: string;
    specializations: string[];
    experience: number;
    rating: number;
    totalReviews: number;
  };
  matchScore: number;
  availableSlots: string[];
  distance?: number;
  consultationFee: number;
  reasonForRecommendation: string;
}

const AIAppointmentBooking: React.FC = () => {
  const { user } = useAuth();
  const [step, setStep] = useState<'symptoms' | 'analysis' | 'doctors' | 'booking' | 'confirmation'>('symptoms');
  const [loading, setLoading] = useState(false);
  
  // Symptom input
  const [symptoms, setSymptoms] = useState<string[]>(['']);
  const [urgency, setUrgency] = useState<'ROUTINE' | 'URGENT' | 'EMERGENCY'>('ROUTINE');
  const [location, setLocation] = useState<{latitude: number; longitude: number; address: string} | null>(null);
  const [maxDistance, setMaxDistance] = useState<number>(50);
  const [maxFee, setMaxFee] = useState<number>(0);
  const [preferredFee, setPreferredFee] = useState<number>(0);
  
  // Analysis results
  const [analysis, setAnalysis] = useState<SymptomAnalysis | null>(null);
  const [recommendations, setRecommendations] = useState<DoctorRecommendation[]>([]);
  
  // Booking
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorRecommendation | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [hold, setHold] = useState<SlotHold | null>(null);
  const [holdRemaining, setHoldRemaining] = useState<number>(0);
  const [appointment, setAppointment] = useState<any>(null);

  useEffect(() => {
    // Get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            address: 'Current Location'
          });
        },
        (error) => {
          console.log('Location access denied:', error);
        }
      );
    }
  }, []);

  const addSymptom = () => {
    setSymptoms([...symptoms, '']);
  };

  const removeSymptom = (index: number) => {
    if (symptoms.length > 1) {
      setSymptoms(symptoms.filter((_, i) => i !== index));
    }
  };

  const updateSymptom = (index: number, value: string) => {
    const updated = [...symptoms];
    updated[index] = value;
    setSymptoms(updated);
  };

  const analyzeSymptoms = async () => {
    const validSymptoms = symptoms.filter(s => s.trim());
    if (validSymptoms.length === 0) {
      toast.error('Please enter at least one symptom');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('/api/ai-appointments/analyze-symptoms', {
        symptoms: validSymptoms,
        patientLocation: location,
        urgency,
        maxDistance,
        maxFee: maxFee > 0 ? maxFee : undefined,
        preferredFee: preferredFee > 0 ? preferredFee : undefined
      });

      setAnalysis(response.data.data.analysis);
      setRecommendations(response.data.data.recommendations);
      
      if (response.data.data.analysis.severity === 'CRITICAL') {
        toast.success('Emergency appointment auto-booked! Check your appointments.');
        setStep('confirmation');
      } else {
        setStep('analysis');
      }
    } catch (error: any) {
      toast.error('Failed to analyze symptoms');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const selectDoctor = (doctor: DoctorRecommendation) => {
    setSelectedDoctor(doctor);
    setStep('booking');
    setSelectedSlot('');
    setHold(null);
    setAvailableSlots([]);
  };

  useEffect(() => {
    const loadSlots = async () => {
      if (!selectedDoctor) return;
      try {
        const res = await axios.get('/api/appointments/slots', {
          params: {
            doctorId: selectedDoctor.doctorId,
            days: 7,
            slotMinutes: 30
          }
        });
        setAvailableSlots(res.data.data.slots || []);
      } catch {
        setAvailableSlots([]);
      }
    };
    loadSlots();
  }, [selectedDoctor]);

  useEffect(() => {
    if (!hold) {
      setHoldRemaining(0);
      return;
    }
    const tick = () => {
      const ms = new Date(hold.expiresAt).getTime() - Date.now();
      const s = Math.max(0, Math.floor(ms / 1000));
      setHoldRemaining(s);
      if (s === 0) {
        setHold(null);
        setSelectedSlot('');
        toast.error('Slot hold expired');
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [hold]);

  const holdSlot = async (slotIso: string) => {
    if (!selectedDoctor) return;
    setLoading(true);
    try {
      const res = await axios.post('/api/appointments/slots/hold', {
        doctorId: selectedDoctor.doctorId,
        scheduledAt: slotIso,
        ttlSeconds: 180
      });
      setSelectedSlot(slotIso);
      setHold(res.data.data.hold);
      toast.success('Slot held for 3 minutes');

      const slotsRes = await axios.get('/api/appointments/slots', {
        params: {
          doctorId: selectedDoctor.doctorId,
          days: 7,
          slotMinutes: 30
        }
      });
      setAvailableSlots(slotsRes.data.data.slots || []);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to hold slot');
      setHold(null);
      setSelectedSlot('');
    } finally {
      setLoading(false);
    }
  };

  const bookAppointment = async () => {
    if (!selectedDoctor || !selectedSlot || !hold) {
      toast.error('Please select a time slot');
      return;
    }

    if (holdRemaining <= 0) {
      toast.error('Slot hold expired');
      setHold(null);
      setSelectedSlot('');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('/api/appointments/slots/confirm', {
        holdId: hold.id,
        type: 'VIDEO',
        symptoms: symptoms.filter((s) => s.trim())
      });

      setAppointment(response.data.data.appointment);
      setStep('confirmation');
      toast.success('Appointment booked successfully!');

      setHold(null);
      setSelectedSlot('');
    } catch (error: any) {
      toast.error('Failed to book appointment');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const groupedSlots = (() => {
    const byDay: Record<string, string[]> = {};
    for (const iso of availableSlots) {
      const d = new Date(iso);
      const key = d.toDateString();
      byDay[key] = byDay[key] || [];
      byDay[key].push(iso);
    }
    Object.values(byDay).forEach((arr) => arr.sort());
    return byDay;
  })();

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'text-red-600 bg-red-50 border-red-200';
      case 'HIGH': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'LOW': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const renderSymptomInput = () => (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Tell us about your symptoms</h2>
        
        <div className="space-y-4">
          {symptoms.map((symptom, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={symptom}
                onChange={(e) => updateSymptom(index, e.target.value)}
                placeholder={`Symptom ${index + 1}`}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {symptoms.length > 1 && (
                <button
                  onClick={() => removeSymptom(index)}
                  className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          
          <button
            onClick={addSymptom}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            + Add another symptom
          </button>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            How urgent do you feel this is?
          </label>
          <select
            value={urgency}
            onChange={(e) => setUrgency(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ROUTINE">Routine - Can wait a few days</option>
            <option value="URGENT">Urgent - Need to see doctor today</option>
            <option value="EMERGENCY">Emergency - Need immediate attention</option>
          </select>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Max distance (km)</label>
            <input
              type="number"
              min={1}
              max={200}
              value={maxDistance}
              onChange={(e) => setMaxDistance(Math.max(1, Math.min(200, parseInt(e.target.value || '50', 10))))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Max budget (₹)</label>
            <input
              type="number"
              min={0}
              value={maxFee}
              onChange={(e) => setMaxFee(Math.max(0, parseInt(e.target.value || '0', 10)))}
              placeholder="0 = no limit"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Preferred fee (₹)</label>
            <input
              type="number"
              min={0}
              value={preferredFee}
              onChange={(e) => setPreferredFee(Math.max(0, parseInt(e.target.value || '0', 10)))}
              placeholder="Optional"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <button
          onClick={analyzeSymptoms}
          disabled={loading}
          className="w-full mt-6 bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          ) : (
            <MagnifyingGlassIcon className="h-5 w-5" />
          )}
          {loading ? 'Analyzing...' : 'Find Doctors'}
        </button>
      </div>
    </div>
  );

  const renderAnalysis = () => (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">AI Analysis Results</h2>
        
        {analysis && (
          <div className="space-y-4">
            <div className={`p-4 rounded-lg border ${getSeverityColor(analysis.severity)}`}>
              <div className="flex items-center gap-2 mb-2">
                <ExclamationTriangleIcon className="h-5 w-5" />
                <span className="font-semibold">Risk Level: {analysis.severity}</span>
                <span className="text-sm">({analysis.riskScore}/100)</span>
              </div>
              <p className="text-sm">{analysis.aiExplanation}</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2">Recommended Specializations:</h4>
                <div className="flex flex-wrap gap-2">
                  {analysis.recommendedSpecializations.map((spec, index) => (
                    <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                      {spec}
                    </span>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Urgency Level:</h4>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  analysis.urgency === 'EMERGENCY' ? 'bg-red-100 text-red-800' :
                  analysis.urgency === 'URGENT' ? 'bg-orange-100 text-orange-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {analysis.urgency}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Recommended Doctors</h3>
        
        <div className="space-y-4">
          {recommendations.map((rec, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <UserIcon className="h-8 w-8 text-gray-400" />
                    <div>
                      <h4 className="font-semibold text-lg flex items-center gap-2">
                        {rec.doctor.name}
                        {analysis?.severity === 'CRITICAL' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">CRITICAL</span>
                        )}
                        {analysis?.severity === 'HIGH' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">HIGH</span>
                        )}
                      </h4>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <StarIcon className="h-4 w-4 text-yellow-400" />
                        <span>{rec.doctor.rating.toFixed(1)} ({rec.doctor.totalReviews} reviews)</span>
                        {rec.distance && (
                          <>
                            <MapPinIcon className="h-4 w-4 ml-2" />
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">{rec.distance.toFixed(1)} km</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-2">
                    <div className="flex flex-wrap gap-2 mb-2">
                      {rec.doctor.specializations.map((spec, i) => (
                        <span key={i} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                          {spec}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm text-gray-600">{rec.reasonForRecommendation}</p>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>Experience: {rec.doctor.experience} years</span>
                    <span>Fee: ₹{rec.consultationFee}</span>
                    <span className={`font-medium ${rec.matchScore >= 80 ? 'text-green-600' : rec.matchScore >= 60 ? 'text-orange-600' : 'text-gray-600'}`}>
                      Match: {rec.matchScore}%
                    </span>
                  </div>
                </div>
                
                <button
                  onClick={() => selectDoctor(rec)}
                  className="ml-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  Select Doctor
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderBooking = () => (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Book Appointment</h2>
        <p className="text-sm text-gray-600 mb-6">Pick a time slot. We’ll hold it for a short time like BookMyShow.</p>
        
        {selectedDoctor && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-lg mb-2">{selectedDoctor.doctor.name}</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Specializations: {selectedDoctor.doctor.specializations.join(', ')}</p>
              <p>Experience: {selectedDoctor.doctor.experience} years</p>
              <p>Consultation Fee: ₹{selectedDoctor.consultationFee}</p>
            </div>
          </div>
        )}

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Time Slot
          </label>
          {hold && holdRemaining > 0 ? (
            <div className="mb-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3 flex items-center justify-between">
              <span>Slot held. Complete booking within {holdRemaining}s</span>
              <span className="text-xs">Held slot: {new Date(hold.scheduledAt).toLocaleString()}</span>
            </div>
          ) : null}

          {Object.keys(groupedSlots).length === 0 ? (
            <div className="text-sm text-gray-600">No slots available right now.</div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedSlots).map(([day, slots]) => (
                <div key={day} className="border border-gray-200 rounded-lg p-3">
                  <div className="font-semibold text-gray-900 mb-2">{day}</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {slots.map((slotIso) => {
                      const label = new Date(slotIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      const active = selectedSlot === slotIso;
                      return (
                        <button
                          key={slotIso}
                          onClick={() => holdSlot(slotIso)}
                          disabled={loading}
                          className={`p-2 text-sm rounded-md border flex items-center justify-center gap-2 ${
                            active
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <CalendarIcon className="h-4 w-4" />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => setStep('analysis')}
            className="flex-1 bg-gray-200 text-gray-800 py-3 px-4 rounded-md hover:bg-gray-300"
          >
            Back to Doctors
          </button>
          <button
            onClick={bookAppointment}
            disabled={loading || !selectedSlot || !hold || holdRemaining <= 0}
            className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Booking...' : 'Book Appointment'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderConfirmation = () => (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6 text-center">
        <CheckCircleIcon className="h-16 w-16 text-green-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Appointment Confirmed!</h2>
        
        {appointment && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-semibold mb-2">Appointment Details:</h3>
            <div className="space-y-2 text-sm">
              <p><strong>Appointment ID:</strong> {appointment.id}</p>
              <p><strong>Doctor:</strong> Dr. {appointment.doctor.doctorProfile.firstName} {appointment.doctor.doctorProfile.lastName}</p>
              <p><strong>Date & Time:</strong> {new Date(appointment.scheduledAt).toLocaleString()}</p>
              <p><strong>Type:</strong> {appointment.type}</p>
              <p><strong>Fee:</strong> ₹{appointment.paymentAmount}</p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-gray-600">
            AI profiles have been generated for both you and your doctor. 
            A consultation chat will be available once your appointment starts.
          </p>
          
          <div className="flex gap-4">
            <button
              onClick={() => window.location.href = '/appointments'}
              className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700"
            >
              View Appointments
            </button>
            <button
              onClick={() => {
                setStep('symptoms');
                setSymptoms(['']);
                setAnalysis(null);
                setRecommendations([]);
                setSelectedDoctor(null);
                setAppointment(null);
              }}
              className="flex-1 bg-gray-200 text-gray-800 py-3 px-4 rounded-md hover:bg-gray-300"
            >
              Book Another
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI-Powered Appointment Booking</h1>
          <p className="text-gray-600">
            Describe your symptoms and let our AI find the best doctors for you
          </p>
        </div>

        {/* Progress indicator */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="flex items-center justify-between">
            {['symptoms', 'analysis', 'booking', 'confirmation'].map((stepName, index) => (
              <div key={stepName} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === stepName ? 'bg-blue-600 text-white' :
                  ['symptoms', 'analysis', 'booking', 'confirmation'].indexOf(step) > index ? 'bg-green-600 text-white' :
                  'bg-gray-300 text-gray-600'
                }`}>
                  {index + 1}
                </div>
                {index < 3 && (
                  <div className={`w-16 h-1 mx-2 ${
                    ['symptoms', 'analysis', 'booking', 'confirmation'].indexOf(step) > index ? 'bg-green-600' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {step === 'symptoms' && renderSymptomInput()}
        {step === 'analysis' && renderAnalysis()}
        {step === 'booking' && renderBooking()}
        {step === 'confirmation' && renderConfirmation()}
      </div>
    </div>
  );
};

export default AIAppointmentBooking;
