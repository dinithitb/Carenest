'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select } from '@/components/ui';
import DashboardHero from '@/components/layout/DashboardHero';
import { User, Lock, Bell, Globe, Save, MapPin } from 'lucide-react';

const LocationPickerMap = dynamic(
  () => import('@/components/maps/LocationPickerMap').then((mod) => mod.LocationPickerMap),
  { ssr: false }
);

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession();
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [profileSaving, setProfileSaving] = useState(false);
  const [securitySaving, setSecuritySaving] = useState(false);
  const [notificationSaving, setNotificationSaving] = useState(false);
  const [languageSaving, setLanguageSaving] = useState(false);
  const [locationSaving, setLocationSaving] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [locationUpdatedAt, setLocationUpdatedAt] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({
    name: '',
    profileImage: '',
    phone: '',
    address: '',
  });
  const [securityForm, setSecurityForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  const [language, setLanguage] = useState('en');
  const [notificationPrefs, setNotificationPrefs] = useState({
    visitReminders: true,
    vaccinationAlerts: true,
    chatMessages: true,
    systemUpdates: true,
  });

  const selectedLatitude = latitude ? Number(latitude) : null;
  const selectedLongitude = longitude ? Number(longitude) : null;
  const handleMapPick = (lat: number, lng: number) => {
    setLatitude(lat.toFixed(7));
    setLongitude(lng.toFixed(7));
  };

  const isMother = session?.user?.role === 'MOTHER';
  const hasGoogleMapsApiKey = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'language', label: 'Language', icon: Globe },
  ];

  useEffect(() => {
    if (!isMother) return;

    const fetchLocation = async () => {
      try {
        const res = await fetch('/api/mothers/location');
        if (!res.ok) return;
        const payload = await res.json();
        const loc = payload?.data;
        if (loc) {
          setLatitude(loc.latitude !== null && loc.latitude !== undefined ? String(loc.latitude) : '');
          setLongitude(loc.longitude !== null && loc.longitude !== undefined ? String(loc.longitude) : '');
          setLocationUpdatedAt(loc.locationUpdatedAt || null);
        }
      } catch (error) {
        console.error('Failed to fetch location:', error);
      }
    };

    fetchLocation();
  }, [isMother]);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!session?.user?.id) return;
      setSettingsLoading(true);
      try {
        const res = await fetch('/api/settings');
        if (!res.ok) return;
        const payload = await res.json();
        const data = payload?.data;
        if (data) {
          setProfileForm({
            name: data.name || '',
            profileImage: data.profileImage || '',
            phone: data.phone || '',
            address: data.address || '',
          });
          setPhotoChanged(false);
          setLanguage(data.language || 'en');
          setNotificationPrefs({
            visitReminders: data.notifyVisitReminders ?? true,
            vaccinationAlerts: data.notifyVaccinationAlerts ?? true,
            chatMessages: data.notifyChatMessages ?? true,
            systemUpdates: data.notifySystemUpdates ?? true,
          });
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      } finally {
        setSettingsLoading(false);
      }
    };

    fetchSettings();
  }, [session?.user?.id]);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
  };

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(7));
        setLongitude(position.coords.longitude.toFixed(7));
        setLocationLoading(false);
      },
      () => {
        setLocationLoading(false);
        alert('Unable to get current location. Please allow location access and try again.');
      }
    );
    };
  const handleSaveLocation = async () => {
    if (!isMother) return;

    setLocationSaving(true);
    try {
      const normalizedLatitude = latitude.trim() === '' ? null : Number(latitude);
      const normalizedLongitude = longitude.trim() === '' ? null : Number(longitude);

      const res = await fetch('/api/mothers/location', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: normalizedLatitude,
          longitude: normalizedLongitude,
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        alert(payload.error || 'Failed to update location');
        return;
      }

      setLocationUpdatedAt(payload?.data?.locationUpdatedAt || null);
      alert('Location updated successfully');
    } catch (error) {
      console.error('Failed to update location:', error);
      alert('Failed to update location');
    } finally {
      setLocationSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      // Upload new photo file first, if one was selected
      let newImageUrl: string | undefined;
      if (photoChanged && pendingPhotoFile) {
        const uploadForm = new FormData();
        uploadForm.append('image', pendingPhotoFile);
        const uploadRes = await fetch('/api/upload/profile-image', {
          method: 'POST',
          body: uploadForm,
        });
        const uploadPayload = await uploadRes.json();
        if (!uploadRes.ok) {
          alert(uploadPayload.error || 'Failed to upload photo');
          return;
        }
        newImageUrl = uploadPayload.url;
      }

      const payload: {
        phone: string;
        address: string;
        profileImage?: string | null;
      } = {
        phone: profileForm.phone,
        address: profileForm.address,
      };

      // Only send profileImage if we uploaded a new one, or if user removed their photo
      if (newImageUrl) {
        payload.profileImage = newImageUrl;
      } else if (photoChanged && !pendingPhotoFile) {
        // Photo was removed
        payload.profileImage = null;
      }

      const profileRes = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const profilePayload = await profileRes.json();
      if (!profileRes.ok) {
        alert(profilePayload.error || 'Failed to save profile');
        return;
      }

      if (profilePayload?.data) {
        setProfileForm({
          name: profilePayload.data.name || '',
          profileImage: profilePayload.data.profileImage || '',
          phone: profilePayload.data.phone || '',
          address: profilePayload.data.address || '',
        });
        // Clean up preview URL
        if (photoPreviewUrl) {
          URL.revokeObjectURL(photoPreviewUrl);
          setPhotoPreviewUrl(null);
        }
        setPendingPhotoFile(null);
        await updateSession({
          name: profilePayload.data.name || profileForm.name,
        });
      }
      setPhotoChanged(false);

      if (isMother) {
        const normalizedLatitude = latitude.trim() === '' ? null : Number(latitude);
        const normalizedLongitude = longitude.trim() === '' ? null : Number(longitude);
        const locationRes = await fetch('/api/mothers/location', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latitude: normalizedLatitude,
            longitude: normalizedLongitude,
          }),
        });
        const locationPayload = await locationRes.json();
        if (!locationRes.ok) {
          alert(locationPayload.error || 'Profile saved, but failed to save location');
          return;
        }
        setLocationUpdatedAt(locationPayload?.data?.locationUpdatedAt || null);
      }

      alert('Profile settings saved successfully');
    } catch (error) {
      console.error('Failed to save profile:', error);
      alert('Failed to save profile settings');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePhotoClick = () => {
    photoInputRef.current?.click();
  };

  const handlePhotoSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('Image is too large. Please choose an image smaller than 2MB.');
      return;
    }

    // Clean up previous preview URL
    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
    }

    // Store the File object for later upload, and create a lightweight preview URL
    setPendingPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
    setPhotoChanged(true);
    event.target.value = '';
  };

  const handleSaveLanguage = async () => {
    setLanguageSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language }),
      });
      const payload = await res.json();
      if (!res.ok) {
        alert(payload.error || 'Failed to save language');
        return;
      }

      alert('Language updated. Please sign in again to refresh session language.');
    } catch (error) {
      console.error('Failed to save language:', error);
      alert('Failed to save language');
    } finally {
      setLanguageSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!securityForm.currentPassword || !securityForm.newPassword || !securityForm.confirmNewPassword) {
      alert('Please fill all password fields');
      return;
    }

    if (securityForm.newPassword !== securityForm.confirmNewPassword) {
      alert('New password and confirm password do not match');
      return;
    }

    setSecuritySaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: securityForm.currentPassword,
          newPassword: securityForm.newPassword,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        alert(payload.error || 'Failed to update password');
        return;
      }

      setSecurityForm({
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      });
      alert('Password updated successfully. Please sign in again.');
      await signOut({ callbackUrl: '/login' });
    } catch (error) {
      console.error('Failed to update password:', error);
      alert('Failed to update password');
    } finally {
      setSecuritySaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setNotificationSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notifyVisitReminders: notificationPrefs.visitReminders,
          notifyVaccinationAlerts: notificationPrefs.vaccinationAlerts,
          notifyChatMessages: notificationPrefs.chatMessages,
          notifySystemUpdates: notificationPrefs.systemUpdates,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        alert(payload.error || 'Failed to save notification preferences');
        return;
      }
      alert('Notification preferences saved successfully');
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
      alert('Failed to save notification preferences');
    } finally {
      setNotificationSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Account Settings"
        subtitle="Manage your profile information, password security, notifications, and preferences"
        pillLabel="Preferences"
      />

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar */}
        <div className="w-full md:w-64 shrink-0">
          <Card>
            <CardContent className="p-2 space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-left transition-all cursor-pointer ${
                      isActive
                        ? 'bg-gray-900 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${isActive ? 'text-teal-400' : 'text-gray-400'}`} />
                    {tab.label}
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'profile' && (
            <Card>
              <CardHeader>
                <CardTitle>Profile Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-20 w-20 rounded-full bg-teal-100 flex items-center justify-center">
                    {(photoPreviewUrl || profileForm.profileImage) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photoPreviewUrl || profileForm.profileImage}
                        alt="Profile"
                        className="h-20 w-20 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl font-bold text-teal-600">
                        {(profileForm.name || session?.user?.name || 'U').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoSelected}
                    />
                    <Button variant="outline" size="sm" onClick={handleChangePhotoClick}>Change Photo</Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Full Name"
                    value={profileForm.name}
                    disabled
                    helperText="Full name is locked after account creation."
                  />
                  <Input label="Email" type="email" value={session?.user?.email || ''} disabled />
                </div>
                <Input
                  label="Phone Number"
                  placeholder="Enter your phone number"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  disabled={settingsLoading}
                />
                <Input
                  label="Address"
                  placeholder="Enter your address"
                  value={profileForm.address}
                  onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                  disabled={settingsLoading}
                />
                {isMother && (
                  <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-teal-600" />
                      <p className="font-medium text-gray-900">My Location (Optional)</p>
                    </div>
                    <p className="text-sm text-gray-600">
                      Add your location anytime so your assigned midwife can view it on Google Maps.
                    </p>
                    {!hasGoogleMapsApiKey && (
                      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                        Google map picker needs <strong>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</strong> in your .env file.
                        You can still use <strong>Use Current Location</strong> and save coordinates.
                      </p>
                    )}
                    {latitude && longitude && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex text-sm font-medium text-teal-700 hover:text-teal-800 underline"
                      >
                        Preview in Google Maps
                      </a>
                    )}
                    {locationUpdatedAt && (
                      <p className="text-xs text-gray-500">Last updated: {new Date(locationUpdatedAt).toLocaleString()}</p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowMapPicker(true)}
                        disabled={!hasGoogleMapsApiKey}
                      >
                        Open Map Picker
                      </Button>
                      <Button type="button" variant="outline" onClick={handleUseCurrentLocation} disabled={locationLoading}>
                        {locationLoading ? 'Getting location...' : 'Use Current Location'}
                      </Button>
                      <Button type="button" onClick={handleSaveLocation} disabled={locationSaving || settingsLoading}>
                        {locationSaving ? 'Saving...' : 'Save Location'}
                      </Button>
                    </div>
                  </div>
                )}
                <div className="flex justify-end">
                  <Button onClick={handleSaveProfile} disabled={profileSaving || settingsLoading}>
                    <Save className="h-4 w-4 mr-2" />
                    {profileSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'security' && (
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Current Password"
                  type="password"
                  value={securityForm.currentPassword}
                  onChange={(e) => setSecurityForm({ ...securityForm, currentPassword: e.target.value })}
                />
                <Input
                  label="New Password"
                  type="password"
                  value={securityForm.newPassword}
                  onChange={(e) => setSecurityForm({ ...securityForm, newPassword: e.target.value })}
                />
                <Input
                  label="Confirm New Password"
                  type="password"
                  value={securityForm.confirmNewPassword}
                  onChange={(e) => setSecurityForm({ ...securityForm, confirmNewPassword: e.target.value })}
                />
                <div className="flex justify-end">
                  <Button onClick={handleUpdatePassword} disabled={securitySaving}>
                    <Lock className="h-4 w-4 mr-2" />
                    {securitySaving ? 'Updating...' : 'Update Password'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'notifications' && (
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: 'Visit Reminders', description: 'Get notified about upcoming visits' },
                  { label: 'Vaccination Alerts', description: 'Get notified about upcoming vaccinations' },
                  { label: 'Chat Messages', description: 'Get notified about new messages' },
                  { label: 'System Updates', description: 'Get notified about system updates' },
                ].map((item) => {
                  const keyMap: Record<string, keyof typeof notificationPrefs> = {
                    'Visit Reminders': 'visitReminders',
                    'Vaccination Alerts': 'vaccinationAlerts',
                    'Chat Messages': 'chatMessages',
                    'System Updates': 'systemUpdates',
                  };
                  const prefKey = keyMap[item.label];
                  return (
                    <div key={item.label} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{item.label}</p>
                        <p className="text-sm text-gray-500">{item.description}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notificationPrefs[prefKey]}
                          onChange={(e) =>
                            setNotificationPrefs({
                              ...notificationPrefs,
                              [prefKey]: e.target.checked,
                            })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                      </label>
                    </div>
                  )
                })}
                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveNotifications}
                    variant="outline"
                    disabled={notificationSaving || settingsLoading}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {notificationSaving ? 'Saving...' : 'Save Notification Preferences'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'language' && (
            <Card>
              <CardHeader>
                <CardTitle>Language Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  label="Preferred Language"
                  options={[
                    { value: 'en', label: 'English' },
                    { value: 'si', label: 'සිංහල (Sinhala)' },
                    { value: 'ta', label: 'தமிழ் (Tamil)' },
                  ]}
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                />
                <p className="text-sm text-gray-500">
                  Select your preferred language for the interface. Some content may still appear in English.
                </p>
                <div className="flex justify-end">
                  <Button onClick={handleSaveLanguage} disabled={languageSaving || settingsLoading}>
                    <Save className="h-4 w-4 mr-2" />
                    {languageSaving ? 'Saving...' : 'Save Language'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {showMapPicker && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/80" onClick={() => setShowMapPicker(false)} />
          <div className="relative h-full w-full flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Select Location on Map</h3>
                <button onClick={() => setShowMapPicker(false)} className="text-gray-400 hover:text-gray-500">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-sm text-gray-600">
                  Click anywhere on the map to choose your location.
                </p>
                <LocationPickerMap
                  latitude={selectedLatitude}
                  longitude={selectedLongitude}
                  onPick={handleMapPick}
                />
                {selectedLatitude !== null && selectedLongitude !== null && (
                  <p className="text-sm text-gray-700">
                    Selected: <strong>{selectedLatitude.toFixed(6)}, {selectedLongitude.toFixed(6)}</strong>
                  </p>
                )}
                <div className="flex justify-end">
                  <Button onClick={() => setShowMapPicker(false)}>Done</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
