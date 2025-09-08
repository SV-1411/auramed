import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  UserGroupIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CalendarDaysIcon,
  HeartIcon,
  ShieldCheckIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/LoadingSpinner';

interface FamilyMember {
  id: string;
  firstName: string;
  lastName: string;
  relationship: string;
  dateOfBirth: string;
  gender: string;
  phone?: string;
  emergencyContact?: string;
  medicalHistory?: string[];
  allergies?: string[];
  currentMedications?: string[];
  isActive: boolean;
}

const FamilyProfile: React.FC = () => {
  const { user } = useAuth();
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const [newMember, setNewMember] = useState({
    firstName: '',
    lastName: '',
    relationship: '',
    dateOfBirth: '',
    gender: '',
    phone: '',
    emergencyContact: '',
    medicalHistory: [] as string[],
    allergies: [] as string[],
    currentMedications: [] as string[]
  });

  useEffect(() => {
    loadFamilyMembers();
  }, []);

  const loadFamilyMembers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/family-members');
      setFamilyMembers(response.data.data.familyMembers || []);
    } catch (error) {
      toast.error('Failed to load family members');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFamilyMember = async () => {
    if (!newMember.firstName || !newMember.lastName || !newMember.relationship) {
      toast.error('Please fill required fields');
      return;
    }

    try {
      const response = await axios.post('/api/family-members', {
        ...newMember,
        isActive: true
      });
      setFamilyMembers([...familyMembers, response.data.data.familyMember]);
      setShowAddModal(false);
      resetForm();
      toast.success('Family member added successfully!');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add family member');
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    try {
      await axios.delete(`/api/family-members/${memberId}`);
      setFamilyMembers(familyMembers.filter(member => member.id !== memberId));
      toast.success('Family member removed successfully!');
    } catch (error: any) {
      toast.error('Failed to remove family member');
    }
  };

  const resetForm = () => {
    setNewMember({
      firstName: '',
      lastName: '',
      relationship: '',
      dateOfBirth: '',
      gender: '',
      phone: '',
      emergencyContact: '',
      medicalHistory: [],
      allergies: [],
      currentMedications: []
    });
  };

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const getRelationshipColor = (relationship: string) => {
    switch (relationship.toLowerCase()) {
      case 'spouse': return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300';
      case 'child': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'parent': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'sibling': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const tabs = [
    { id: 'overview', name: 'Overview', icon: UserGroupIcon },
    { id: 'medical', name: 'Medical Records', icon: HeartIcon },
    { id: 'emergency', name: 'Emergency Info', icon: ShieldCheckIcon }
  ];

  if (loading) {
    return <LoadingSpinner text="Loading family profiles..." />;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-sapphire-600 via-sapphire-700 to-sapphire-800 dark:from-sapphire-700 dark:via-sapphire-800 dark:to-sapphire-900 rounded-2xl p-8 text-white shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Family Health Management</h1>
            <p className="text-sapphire-100">Manage health profiles for your entire family</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-white/20 hover:bg-white/30 backdrop-blur-sm px-6 py-3 rounded-xl font-semibold transition-all flex items-center space-x-2"
          >
            <PlusIcon className="h-5 w-5" />
            <span>Add Family Member</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl p-6 border border-light-border dark:border-dark-border">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-sapphire-100 dark:bg-sapphire-900 rounded-xl">
              <UserGroupIcon className="h-6 w-6 text-sapphire-700 dark:text-sapphire-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">{familyMembers.length}</p>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Family Members</p>
            </div>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl p-6 border border-light-border dark:border-dark-border">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900 rounded-xl">
              <HeartIcon className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">
                {familyMembers.reduce((acc, member) => acc + (member.medicalHistory?.length || 0), 0)}
              </p>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Medical Records</p>
            </div>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl p-6 border border-light-border dark:border-dark-border">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-xl">
              <ShieldCheckIcon className="h-6 w-6 text-orange-700 dark:text-orange-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">
                {familyMembers.reduce((acc, member) => acc + (member.allergies?.length || 0), 0)}
              </p>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Allergies Tracked</p>
            </div>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl p-6 border border-light-border dark:border-dark-border">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-xl">
              <CheckCircleIcon className="h-6 w-6 text-blue-700 dark:text-blue-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">
                {familyMembers.reduce((acc, member) => acc + (member.currentMedications?.length || 0), 0)}
              </p>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Medications</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
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
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {familyMembers.length === 0 ? (
                <div className="text-center py-12">
                  <UserGroupIcon className="h-16 w-16 text-light-text-secondary dark:text-dark-text-secondary mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-light-text-primary dark:text-dark-text-primary mb-2">No family members added</h3>
                  <p className="text-light-text-secondary dark:text-dark-text-secondary mb-6">Start by adding family members to manage their health profiles</p>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-gradient-to-r from-sapphire-600 to-sapphire-700 hover:from-sapphire-700 hover:to-sapphire-800 text-white px-8 py-4 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl"
                  >
                    Add First Family Member
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {familyMembers.map((member) => (
                    <div key={member.id} className="bg-white/60 dark:bg-dark-surface/60 backdrop-blur-sm rounded-2xl p-6 border border-light-border dark:border-dark-border hover:shadow-lg transition-all">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-sapphire-500 to-sapphire-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-bold text-lg">
                              {member.firstName[0]}{member.lastName[0]}
                            </span>
                          </div>
                          <div>
                            <h3 className="font-bold text-light-text-primary dark:text-dark-text-primary">
                              {member.firstName} {member.lastName}
                            </h3>
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getRelationshipColor(member.relationship)}`}>
                              {member.relationship}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteMember(member.id)}
                          className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex items-center space-x-2">
                          <CalendarDaysIcon className="h-4 w-4 text-light-text-secondary dark:text-dark-text-secondary" />
                          <span className="text-light-text-secondary dark:text-dark-text-secondary">
                            Age: {calculateAge(member.dateOfBirth)} years
                          </span>
                        </div>
                        {member.phone && (
                          <div className="text-light-text-secondary dark:text-dark-text-secondary">
                            Phone: {member.phone}
                          </div>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {member.medicalHistory && member.medicalHistory.length > 0 && (
                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 rounded-full text-xs">
                              {member.medicalHistory.length} conditions
                            </span>
                          )}
                          {member.allergies && member.allergies.length > 0 && (
                            <span className="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300 rounded-full text-xs">
                              {member.allergies.length} allergies
                            </span>
                          )}
                          {member.currentMedications && member.currentMedications.length > 0 && (
                            <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 rounded-full text-xs">
                              {member.currentMedications.length} medications
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'medical' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">Medical Records Overview</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {familyMembers.map((member) => (
                  <div key={member.id} className="bg-white/60 dark:bg-dark-surface/60 backdrop-blur-sm rounded-xl p-6 border border-light-border dark:border-dark-border">
                    <h4 className="font-semibold text-light-text-primary dark:text-dark-text-primary mb-4">
                      {member.firstName} {member.lastName}
                    </h4>

                    <div className="space-y-4">
                      <div>
                        <h5 className="font-medium text-light-text-primary dark:text-dark-text-primary mb-2">Medical History</h5>
                        {member.medicalHistory && member.medicalHistory.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {member.medicalHistory.map((condition, idx) => (
                              <span key={idx} className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 rounded-full text-xs">
                                {condition}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm">No medical history recorded</p>
                        )}
                      </div>

                      <div>
                        <h5 className="font-medium text-light-text-primary dark:text-dark-text-primary mb-2">Allergies</h5>
                        {member.allergies && member.allergies.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {member.allergies.map((allergy, idx) => (
                              <span key={idx} className="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300 rounded-full text-xs">
                                {allergy}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm">No allergies recorded</p>
                        )}
                      </div>

                      <div>
                        <h5 className="font-medium text-light-text-primary dark:text-dark-text-primary mb-2">Current Medications</h5>
                        {member.currentMedications && member.currentMedications.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {member.currentMedications.map((medication, idx) => (
                              <span key={idx} className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 rounded-full text-xs">
                                {medication}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm">No current medications</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'emergency' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">Emergency Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {familyMembers.map((member) => (
                  <div key={member.id} className="bg-white/60 dark:bg-dark-surface/60 backdrop-blur-sm rounded-xl p-6 border border-light-border dark:border-dark-border">
                    <h4 className="font-semibold text-light-text-primary dark:text-dark-text-primary mb-4">
                      {member.firstName} {member.lastName}
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">Phone Number</label>
                        <p className="text-light-text-primary dark:text-dark-text-primary">{member.phone || 'Not provided'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">Emergency Contact</label>
                        <p className="text-light-text-primary dark:text-dark-text-primary">{member.emergencyContact || 'Not provided'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">Blood Type</label>
                        <p className="text-light-text-primary dark:text-dark-text-primary">Not specified</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Family Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 dark:bg-dark-card/95 backdrop-blur-md rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-light-border dark:border-dark-border">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">Add Family Member</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">First Name *</label>
                  <input
                    type="text"
                    value={newMember.firstName}
                    onChange={(e) => setNewMember({ ...newMember, firstName: e.target.value })}
                    className="w-full px-4 py-3 border border-light-border dark:border-dark-border rounded-xl bg-white/50 dark:bg-dark-surface/50 backdrop-blur-sm focus:ring-2 focus:ring-sapphire-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">Last Name *</label>
                  <input
                    type="text"
                    value={newMember.lastName}
                    onChange={(e) => setNewMember({ ...newMember, lastName: e.target.value })}
                    className="w-full px-4 py-3 border border-light-border dark:border-dark-border rounded-xl bg-white/50 dark:bg-dark-surface/50 backdrop-blur-sm focus:ring-2 focus:ring-sapphire-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">Relationship *</label>
                  <select
                    value={newMember.relationship}
                    onChange={(e) => setNewMember({ ...newMember, relationship: e.target.value })}
                    className="w-full px-4 py-3 border border-light-border dark:border-dark-border rounded-xl bg-white/50 dark:bg-dark-surface/50 backdrop-blur-sm focus:ring-2 focus:ring-sapphire-500 focus:border-transparent transition-all"
                  >
                    <option value="">Select Relationship</option>
                    <option value="spouse">Spouse</option>
                    <option value="child">Child</option>
                    <option value="parent">Parent</option>
                    <option value="sibling">Sibling</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">Date of Birth</label>
                  <input
                    type="date"
                    value={newMember.dateOfBirth}
                    onChange={(e) => setNewMember({ ...newMember, dateOfBirth: e.target.value })}
                    className="w-full px-4 py-3 border border-light-border dark:border-dark-border rounded-xl bg-white/50 dark:bg-dark-surface/50 backdrop-blur-sm focus:ring-2 focus:ring-sapphire-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">Gender</label>
                  <select
                    value={newMember.gender}
                    onChange={(e) => setNewMember({ ...newMember, gender: e.target.value })}
                    className="w-full px-4 py-3 border border-light-border dark:border-dark-border rounded-xl bg-white/50 dark:bg-dark-surface/50 backdrop-blur-sm focus:ring-2 focus:ring-sapphire-500 focus:border-transparent transition-all"
                  >
                    <option value="">Select Gender</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">Phone Number</label>
                  <input
                    type="tel"
                    value={newMember.phone}
                    onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
                    className="w-full px-4 py-3 border border-light-border dark:border-dark-border rounded-xl bg-white/50 dark:bg-dark-surface/50 backdrop-blur-sm focus:ring-2 focus:ring-sapphire-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">Emergency Contact</label>
                <input
                  type="tel"
                  value={newMember.emergencyContact}
                  onChange={(e) => setNewMember({ ...newMember, emergencyContact: e.target.value })}
                  className="w-full px-4 py-3 border border-light-border dark:border-dark-border rounded-xl bg-white/50 dark:bg-dark-surface/50 backdrop-blur-sm focus:ring-2 focus:ring-sapphire-500 focus:border-transparent transition-all"
                />
              </div>

              <div className="flex justify-end space-x-4 pt-6 border-t border-light-border dark:border-dark-border">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-6 py-3 border border-light-border dark:border-dark-border rounded-xl text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface dark:hover:bg-dark-surface transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddFamilyMember}
                  className="px-6 py-3 bg-gradient-to-r from-sapphire-600 to-sapphire-700 hover:from-sapphire-700 hover:to-sapphire-800 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl"
                >
                  Add Family Member
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FamilyProfile;
