import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  UserIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  PhoneIcon,
  EnvelopeIcon,
  HeartIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  PlusIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/LoadingSpinner';

interface FamilyMember {
  id: string;
  firstName: string;
  lastName: string;
  relationship: string;
  dateOfBirth: string;
  gender: string;
}

interface ProfileData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  emergencyContact: string;
  address?: string;
  preferredLanguage: string;
  medicalHistory?: string[];
  allergies?: string[];
  currentMedications?: string[];
  familyMembers?: FamilyMember[];
}

const Profile: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const [profileData, setProfileData] = useState<ProfileData>({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    phone: '',
    emergencyContact: '',
    address: '',
    preferredLanguage: 'en',
    medicalHistory: [],
    allergies: [],
    currentMedications: [],
    familyMembers: []
  });

  useEffect(() => {
    if (user?.profile) {
      setProfileData({
        firstName: user.profile.firstName || '',
        lastName: user.profile.lastName || '',
        dateOfBirth: user.profile.dateOfBirth || '',
        gender: user.profile.gender || '',
        phone: user.phone || '',
        emergencyContact: user.profile.emergencyContact || '',
        address: user.profile.address || '',
        preferredLanguage: user.profile.preferredLanguage || 'en',
        medicalHistory: user.profile.medicalHistory || [],
        allergies: user.profile.allergies || [],
        currentMedications: user.profile.currentMedications || [],
        familyMembers: user.profile.familyMembers || []
      });
    }
  }, [user]);

  const handleSaveProfile = async () => {
    try {
      setLoading(true);
      await updateProfile(profileData);
      setEditMode(false);
      toast.success('Profile updated successfully!');
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const addToList = (field: 'medicalHistory' | 'allergies' | 'currentMedications', value: string) => {
    if (value.trim()) {
      const currentList = profileData[field] || [];
      setProfileData({
        ...profileData,
        [field]: [...currentList, value.trim()]
      });
    }
  };

  const removeFromList = (field: 'medicalHistory' | 'allergies' | 'currentMedications', index: number) => {
    const currentList = profileData[field] || [];
    setProfileData({
      ...profileData,
      [field]: currentList.filter((_, i) => i !== index)
    });
  };

  const calculateAge = (dateOfBirth: string) => {
    if (!dateOfBirth) return 0;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const tabs = [
    { id: 'personal', name: 'Personal Info', icon: UserIcon },
    { id: 'medical', name: 'Medical Info', icon: HeartIcon },
    { id: 'family', name: 'Family Members', icon: UserGroupIcon },
    { id: 'security', name: 'Security', icon: ShieldCheckIcon }
  ];

  if (loading && !user) {
    return <LoadingSpinner text="Loading profile..." />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-800 to-blue-900 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <UserIcon className="h-10 w-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-2">
                {profileData.firstName} {profileData.lastName}
              </h1>
              <p className="text-blue-100 flex items-center space-x-4">
                <span className="flex items-center space-x-1">
                  <EnvelopeIcon className="h-4 w-4" />
                  <span>{user?.email}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <PhoneIcon className="h-4 w-4" />
                  <span>{profileData.phone}</span>
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={() => setEditMode(!editMode)}
            className="bg-white text-blue-800 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors flex items-center space-x-2"
          >
            {editMode ? (
              <>
                <XMarkIcon className="h-5 w-5" />
                <span>Cancel</span>
              </>
            ) : (
              <>
                <PencilIcon className="h-5 w-5" />
                <span>Edit Profile</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
          {/* Personal Info Tab */}
          {activeTab === 'personal' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                  <input
                    type="text"
                    value={profileData.firstName}
                    onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                    disabled={!editMode}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                  <input
                    type="text"
                    value={profileData.lastName}
                    onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                    disabled={!editMode}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                  <input
                    type="date"
                    value={profileData.dateOfBirth}
                    onChange={(e) => setProfileData({ ...profileData, dateOfBirth: e.target.value })}
                    disabled={!editMode}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                  />
                  {profileData.dateOfBirth && (
                    <p className="text-sm text-gray-500 mt-1">Age: {calculateAge(profileData.dateOfBirth)} years</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                  <select
                    value={profileData.gender}
                    onChange={(e) => setProfileData({ ...profileData, gender: e.target.value })}
                    disabled={!editMode}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                  >
                    <option value="">Select Gender</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                  <input
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                    disabled={!editMode}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Emergency Contact</label>
                  <input
                    type="tel"
                    value={profileData.emergencyContact}
                    onChange={(e) => setProfileData({ ...profileData, emergencyContact: e.target.value })}
                    disabled={!editMode}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                <textarea
                  value={profileData.address}
                  onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                  disabled={!editMode}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Language</label>
                <select
                  value={profileData.preferredLanguage}
                  onChange={(e) => setProfileData({ ...profileData, preferredLanguage: e.target.value })}
                  disabled={!editMode}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                </select>
              </div>

              {editMode && (
                <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => setEditMode(false)}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={loading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                  >
                    <CheckIcon className="h-5 w-5" />
                    <span>Save Changes</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Medical Info Tab */}
          {activeTab === 'medical' && (
            <div className="space-y-8">
              {/* Medical History */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Medical History</h3>
                <div className="space-y-2">
                  {profileData.medicalHistory?.map((condition, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg">
                      <span>{condition}</span>
                      {editMode && (
                        <button
                          onClick={() => removeFromList('medicalHistory', index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {editMode && (
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        placeholder="Add medical condition"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            addToList('medicalHistory', e.currentTarget.value);
                            e.currentTarget.value = '';
                          }
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Allergies */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Allergies</h3>
                <div className="space-y-2">
                  {profileData.allergies?.map((allergy, index) => (
                    <div key={index} className="flex items-center justify-between bg-red-50 px-3 py-2 rounded-lg">
                      <span className="text-red-800">{allergy}</span>
                      {editMode && (
                        <button
                          onClick={() => removeFromList('allergies', index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {editMode && (
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        placeholder="Add allergy"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            addToList('allergies', e.currentTarget.value);
                            e.currentTarget.value = '';
                          }
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Current Medications */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Medications</h3>
                <div className="space-y-2">
                  {profileData.currentMedications?.map((medication, index) => (
                    <div key={index} className="flex items-center justify-between bg-blue-50 px-3 py-2 rounded-lg">
                      <span className="text-blue-800">{medication}</span>
                      {editMode && (
                        <button
                          onClick={() => removeFromList('currentMedications', index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {editMode && (
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        placeholder="Add medication"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            addToList('currentMedications', e.currentTarget.value);
                            e.currentTarget.value = '';
                          }
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  )}
                </div>
              </div>

              {editMode && (
                <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => setEditMode(false)}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={loading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                  >
                    <CheckIcon className="h-5 w-5" />
                    <span>Save Changes</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Family Members Tab */}
          {activeTab === 'family' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Family Members</h3>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2">
                  <PlusIcon className="h-5 w-5" />
                  <span>Add Family Member</span>
                </button>
              </div>

              <div className="text-center py-12">
                <UserGroupIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Family Management Coming Soon</h3>
                <p className="text-gray-500">This feature will allow you to manage family member profiles</p>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Security</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900">Password</h4>
                      <p className="text-sm text-gray-600">Last updated: Never</p>
                    </div>
                    <button className="text-blue-600 hover:text-blue-800 font-medium">
                      Change Password
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900">Two-Factor Authentication</h4>
                      <p className="text-sm text-gray-600">Add an extra layer of security</p>
                    </div>
                    <button className="text-blue-600 hover:text-blue-800 font-medium">
                      Enable 2FA
                    </button>
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

export default Profile;
