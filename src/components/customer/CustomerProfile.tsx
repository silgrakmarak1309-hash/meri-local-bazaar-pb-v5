import React, { useState, useEffect } from 'react';
import {
  User,
  MapPin,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  Store,
  Bike,
  Shield,
  LogOut,
  Save,
  Phone,
  Mail,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Address, VillageDeliveryRate } from '../../types';
import { db } from '../../firebase';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { supabase } from '../../supabase';
import { fetchVillageDeliveryRates } from '../../services/dbService';

interface CustomerProfileProps {
  onOpenSellerRegistration?: () => void;
  onOpenDeliveryRegistration: () => void;
  onOpenAuth?: (mode?: 'signin' | 'register') => void;
  onNavigateToPartnerHub?: () => void;
}

export const CustomerProfile: React.FC<CustomerProfileProps> = ({
  onOpenSellerRegistration,
  onOpenDeliveryRegistration,
  onOpenAuth,
  onNavigateToPartnerHub,
}) => {
  const {
    user,
    updateUserProfile,
    logout,
    switchRole,
    hasRegisteredShop,
    hasRegisteredDelivery,
    registeredShop,
    registeredDeliveryPartner,
  } = useAuth();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

  // Address form fields
  const [addrName, setAddrName] = useState('');
  const [addrPhone, setAddrPhone] = useState('');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrState, setAddrState] = useState('');
  const [addrPin, setAddrPin] = useState('');
  const [addrVillage, setAddrVillage] = useState('');
  const [addrType, setAddrType] = useState<'home' | 'work' | 'other'>('home');
  const [formVillages, setFormVillages] = useState<VillageDeliveryRate[]>([]);
  const [isLoadingVillages, setIsLoadingVillages] = useState(false);

  // Dynamically fetch villages/localities when user enters or edits pincode
  useEffect(() => {
    const cleanPin = addrPin.trim();
    if (!cleanPin || cleanPin.length < 3) {
      setFormVillages([]);
      return;
    }

    let isMounted = true;
    setIsLoadingVillages(true);

    fetchVillageDeliveryRates(cleanPin)
      .then((rates) => {
        if (!isMounted) return;
        setFormVillages(rates);
        if (rates.length > 0 && !addrVillage) {
          setAddrVillage(rates[0].villageName);
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch villages in profile:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingVillages(false);
      });

    return () => {
      isMounted = false;
    };
  }, [addrPin]);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName || '');
    setPhoneNumber(user.phoneNumber || '');

    const isDemoMockAddress = (a: { streetAddress?: string; city?: string; postalCode?: string }) => {
      const street = (a.streetAddress || '').toLowerCase();
      const city = (a.city || '').toLowerCase();
      const pin = (a.postalCode || '').trim();
      return (
        street.includes('green glen') ||
        street.includes('flat 402') ||
        street.includes('bellandur') ||
        city.includes('bengaluru') ||
        city.includes('bangalore') ||
        pin === '123456'
      );
    };

    const fetchAddresses = async () => {
      // 1. Primary Supabase fetch
      try {
        const { data, error } = await supabase
          .from('addresses')
          .select('*')
          .eq('user_id', user.uid)
          .order('created_at', { ascending: true });
        if (!error && data && data.length > 0) {
          const list: Address[] = [];
          for (const a of data) {
            let village = a.village;
            let landmark = a.landmark;
            if (!village && a.landmark && a.landmark.startsWith('Village: ')) {
              const parts = a.landmark.split(' | ');
              village = parts[0].replace('Village: ', '').trim();
              landmark = parts[1] || undefined;
            }
            const addrObj: Address = {
              id: a.id,
              userId: a.user_id,
              fullName: a.full_name,
              phoneNumber: a.phone_number,
              streetAddress: a.street_address,
              city: a.city,
              state: a.state,
              postalCode: a.postal_code,
              village: village || undefined,
              landmark: landmark || undefined,
              isDefault: Boolean(a.is_default),
              addressType: a.address_type || 'home',
            };
            if (isDemoMockAddress(addrObj)) {
              supabase.from('addresses').delete().eq('id', a.id).then(() => {});
              deleteDoc(doc(db, 'addresses', a.id)).catch(() => {});
            } else {
              list.push(addrObj);
            }
          }
          if (list.length > 0) {
            setAddresses(list);
            return;
          }
        }
      } catch (err) {
        // Fallback
      }

      // 2. Firestore fallback
      try {
        const q = query(collection(db, 'addresses'), where('userId', '==', user.uid));
        const snap = await getDocs(q);
        const list: Address[] = [];
        snap.forEach((d) => {
          const addr = d.data() as Address;
          if (isDemoMockAddress(addr)) {
            deleteDoc(doc(db, 'addresses', addr.id || d.id)).catch(() => {});
          } else {
            list.push(addr);
          }
        });
        setAddresses(list);
      } catch (e) {
        console.warn('Error fetching addresses:', e);
      }
    };
    fetchAddresses();
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-md mx-auto p-6 text-center bg-white rounded-2xl shadow-2xs border border-slate-200 mt-8 space-y-4">
        <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
          <User className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800">Account Access Required</h2>
          <p className="text-xs text-slate-500 mt-1">Sign in or create an account to view your profile, orders, and saved addresses.</p>
        </div>
        <div className="flex gap-2.5 justify-center pt-1">
          <button
            onClick={() => onOpenAuth && onOpenAuth('signin')}
            className="flex-1 max-w-[140px] py-2.5 bg-[#2874f0] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            Sign In
          </button>
          <button
            onClick={() => onOpenAuth && onOpenAuth('register')}
            className="flex-1 max-w-[140px] py-2.5 bg-[#fb641b] hover:bg-[#e85b17] text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            Create Account
          </button>
        </div>
      </div>
    );
  }

  const handleSaveProfile = async () => {
    await updateUserProfile({ displayName, phoneNumber });
    setIsEditingProfile(false);
  };

  const resetAddressForm = () => {
    setIsAddingAddress(false);
    setEditingAddressId(null);
    setAddrName('');
    setAddrPhone('');
    setAddrStreet('');
    setAddrCity('');
    setAddrState('');
    setAddrPin('');
    setAddrVillage('');
    setAddrType('home');
    setFormVillages([]);
  };

  const handleEditAddress = (addr: Address) => {
    setEditingAddressId(addr.id);
    setAddrName(addr.fullName);
    setAddrPhone(addr.phoneNumber);
    setAddrStreet(addr.streetAddress);
    setAddrCity(addr.city);
    setAddrState(addr.state);
    setAddrPin(addr.postalCode);
    setAddrVillage(addr.village || '');
    setAddrType(addr.addressType);
    setIsAddingAddress(true);
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = editingAddressId || 'addr_' + Date.now();
    const newAddr: Address = {
      id,
      userId: user.uid,
      fullName: addrName || displayName,
      phoneNumber: addrPhone || phoneNumber,
      streetAddress: addrStreet,
      city: addrCity,
      state: addrState,
      postalCode: addrPin,
      village: addrVillage.trim() || undefined,
      isDefault: addresses.length === 0,
      addressType: addrType,
    };

    const compositeLandmark = newAddr.village ? `Village: ${newAddr.village}` : null;

    // 1. Save in Supabase
    try {
      await supabase.from('addresses').upsert({
        id: newAddr.id,
        user_id: newAddr.userId,
        full_name: newAddr.fullName,
        phone_number: newAddr.phoneNumber,
        street_address: newAddr.streetAddress,
        city: newAddr.city,
        state: newAddr.state,
        postal_code: newAddr.postalCode,
        landmark: compositeLandmark,
        is_default: newAddr.isDefault,
        address_type: newAddr.addressType,
      });
    } catch (e) {
      console.warn('Supabase add address notice:', e);
    }

    // 2. Mirror in Firestore
    try {
      await setDoc(doc(db, 'addresses', id), newAddr, { merge: true });
      if (editingAddressId) {
        setAddresses(addresses.map((a) => (a.id === id ? newAddr : a)));
      } else {
        setAddresses([...addresses, newAddr]);
      }
      resetAddressForm();
    } catch (e) {
      console.error('Error adding address:', e);
    }
  };

  const handleDeleteAddress = async (addrId: string) => {
    // 1. Delete from Supabase
    try {
      await supabase.from('addresses').delete().eq('id', addrId);
    } catch (e) {
      console.warn('Supabase delete address notice:', e);
    }

    // 2. Delete from Firestore
    try {
      await deleteDoc(doc(db, 'addresses', addrId));
      setAddresses(addresses.filter((a) => a.id !== addrId));
    } catch (e) {
      console.error('Error deleting address:', e);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6 space-y-6 pb-20">
      {/* Profile Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="bg-[#2874f0] p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName}
                className="w-14 h-14 rounded-full border-2 border-white object-cover"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold border-2 border-white">
                {user.displayName.charAt(0)}
              </div>
            )}
            <div>
              <h2 className="text-base sm:text-lg font-black">{user.displayName}</h2>
              <div className="text-xs text-blue-100 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" />
                <span>{user.email}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsEditingProfile(!isEditingProfile)}
            className="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>{isEditingProfile ? 'Cancel' : 'Edit'}</span>
          </button>
        </div>

        {/* Profile Edit or Info */}
        <div className="p-4 sm:p-5">
          {isEditingProfile ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full p-2 text-xs border border-slate-300 rounded focus:border-[#2874f0] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full p-2 text-xs border border-slate-300 rounded focus:border-[#2874f0] outline-none"
                />
              </div>
              <button
                onClick={handleSaveProfile}
                className="px-4 py-2 bg-[#2874f0] text-white text-xs font-bold rounded shadow hover:bg-blue-700 flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Profile Changes</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-400 block mb-0.5">Mobile Number</span>
                <span className="font-bold text-slate-800">{user.phoneNumber || '+91 Not Linked'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-400 block mb-0.5">Account Role</span>
                <span className="font-bold text-slate-800 uppercase">{user.role}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Address Management Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#2874f0]" />
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              Manage Delivery Addresses ({addresses.length})
            </h3>
          </div>
          {!isAddingAddress && (
            <button
              onClick={() => setIsAddingAddress(true)}
              className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold rounded-lg flex items-center gap-1 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add New</span>
            </button>
          )}
        </div>

        {isAddingAddress && (
          <form onSubmit={handleAddAddress} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800">
                {editingAddressId ? 'Edit Delivery Address' : 'Add New Address'}
              </h4>
              <span className="text-[11px] text-slate-500">
                Pincode-based village delivery charging
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-500 mb-1">Recipient Name *</label>
                <input
                  type="text"
                  required
                  value={addrName}
                  onChange={(e) => setAddrName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full p-2 border border-slate-300 rounded bg-white outline-none focus:border-[#2874f0]"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Mobile Number *</label>
                <input
                  type="tel"
                  required
                  value={addrPhone}
                  onChange={(e) => setAddrPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full p-2 border border-slate-300 rounded bg-white outline-none focus:border-[#2874f0]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-slate-500 mb-1">Flat / House / Street Address *</label>
                <input
                  type="text"
                  required
                  value={addrStreet}
                  onChange={(e) => setAddrStreet(e.target.value)}
                  placeholder="Building, street, colony"
                  className="w-full p-2 border border-slate-300 rounded bg-white outline-none focus:border-[#2874f0]"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">City *</label>
                <input
                  type="text"
                  required
                  value={addrCity}
                  onChange={(e) => setAddrCity(e.target.value)}
                  placeholder="e.g. Resubelpara"
                  className="w-full p-2 border border-slate-300 rounded bg-white outline-none focus:border-[#2874f0]"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">State *</label>
                <input
                  type="text"
                  required
                  value={addrState}
                  onChange={(e) => setAddrState(e.target.value)}
                  placeholder="e.g. Meghalaya"
                  className="w-full p-2 border border-slate-300 rounded bg-white outline-none focus:border-[#2874f0]"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">PIN Code *</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={addrPin}
                  onChange={(e) => setAddrPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 794114"
                  className="w-full p-2 border border-slate-300 rounded bg-white outline-none focus:border-[#2874f0] font-semibold text-slate-800"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-500 font-medium">Village / Locality *</label>
                  {isLoadingVillages && (
                    <span className="text-[10px] text-blue-600 font-semibold animate-pulse">
                      Fetching villages...
                    </span>
                  )}
                </div>
                {formVillages.length > 0 ? (
                  <select
                    required
                    value={addrVillage}
                    onChange={(e) => setAddrVillage(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded bg-white outline-none focus:border-[#2874f0] text-slate-800 font-semibold cursor-pointer"
                  >
                    <option value="">-- Select Village / Locality --</option>
                    {formVillages.map((v, i) => (
                      <option key={v.id || i} value={v.villageName}>
                        {v.villageName} (₹{v.deliveryCharge} delivery fee)
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-1">
                    <input
                      type="text"
                      required
                      value={addrVillage}
                      onChange={(e) => setAddrVillage(e.target.value)}
                      placeholder={
                        addrPin.length >= 6
                          ? 'Enter Village / Locality name'
                          : 'Enter PIN Code first to see villages'
                      }
                      className="w-full p-2 border border-slate-300 rounded bg-white outline-none focus:border-[#2874f0]"
                    />
                    {addrPin.length >= 6 && formVillages.length === 0 && !isLoadingVillages && (
                      <span className="text-[10px] text-slate-400 block">
                        No registered villages found for PIN {addrPin}. Enter your locality name above.
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-slate-500 mb-1">Address Type</label>
                <select
                  value={addrType}
                  onChange={(e: any) => setAddrType(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded bg-white outline-none focus:border-[#2874f0]"
                >
                  <option value="home">Home (All Day Delivery)</option>
                  <option value="work">Work (10 AM - 6 PM)</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={resetAddressForm}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#2874f0] text-white text-xs font-bold rounded shadow hover:bg-blue-700 cursor-pointer"
              >
                {editingAddressId ? 'Update Address' : 'Save Address'}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2.5">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className="p-3 bg-white border border-slate-200 rounded-lg flex items-start justify-between gap-3 text-xs shadow-2xs hover:border-blue-200 transition"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{addr.fullName}</span>
                  <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-1.5 py-0.2 rounded uppercase">
                    {addr.addressType}
                  </span>
                  <span className="text-slate-500 font-medium">{addr.phoneNumber}</span>
                </div>
                <p className="text-slate-600">
                  {addr.streetAddress}, {addr.city}, {addr.state} -{' '}
                  <span className="font-bold">{addr.postalCode}</span>
                </p>
                {addr.village && (
                  <div className="pt-0.5">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      <MapPin className="w-3 h-3 text-emerald-600" />
                      Village / Locality: {addr.village}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleEditAddress(addr)}
                  className="text-slate-500 hover:text-[#2874f0] p-1.5 rounded hover:bg-blue-50 transition cursor-pointer"
                  title="Edit Address"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteAddress(addr.id)}
                  className="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50 transition cursor-pointer"
                  title="Delete Address"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Partner Registration Shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                <Store className="w-5 h-5 text-emerald-600" />
                <span>{hasRegisteredShop ? 'Your Seller Hub' : 'Sell on BazaarX'}</span>
              </div>
              {hasRegisteredShop && (
                <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-1.5 py-0.5 rounded">
                  Shop Active
                </span>
              )}
            </div>
            <p className="text-xs text-emerald-700 leading-relaxed">
              {hasRegisteredShop
                ? `Active shop: ${registeredShop?.shopName || 'Retail Shop'}. Manage catalog, live orders and earnings.`
                : 'Vendor registration is strictly managed and provisioned by administrators inside the Partner Hub.'}
            </p>
          </div>
          {hasRegisteredShop ? (
            <button
              onClick={() => switchRole('seller')}
              className="mt-3 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs transition cursor-pointer"
            >
              Open Seller Dashboard
            </button>
          ) : (
            <div className="mt-3 px-3 py-2 bg-emerald-100/80 border border-emerald-300 text-emerald-950 rounded-lg text-[11px] flex items-center justify-between font-medium">
              <span>Managed in Partner Hub</span>
              <span className="text-[10px] bg-emerald-700 text-white font-bold px-1.5 py-0.5 rounded uppercase">
                Admin Only
              </span>
            </div>
          )}
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                <Bike className="w-5 h-5 text-amber-600" />
                <span>{hasRegisteredDelivery ? 'Your Delivery Fleet Hub' : 'Become a Delivery Partner'}</span>
              </div>
              {hasRegisteredDelivery && (
                <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-1.5 py-0.5 rounded">
                  Partner Active
                </span>
              )}
            </div>
            <p className="text-xs text-amber-700 leading-relaxed">
              {hasRegisteredDelivery
                ? `Registered rider: ${registeredDeliveryPartner?.fullName || user?.displayName}. Accept trips and cash out.`
                : 'Earn on every delivery trip with flexible hours and fast UPI payouts.'}
            </p>
          </div>
          {hasRegisteredDelivery ? (
            <button
              onClick={() => switchRole('delivery_partner')}
              className="mt-3 w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg shadow-xs transition cursor-pointer"
            >
              Open Delivery Dashboard
            </button>
          ) : (
            <button
              onClick={onOpenDeliveryRegistration}
              className="mt-3 w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg shadow-xs transition cursor-pointer"
            >
              Join Delivery Fleet
            </button>
          )}
        </div>
      </div>

      {/* Sign Out */}
      <div className="pt-2">
        <button
          onClick={logout}
          className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs sm:text-sm rounded-xl border border-red-200 flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out from BazaarX</span>
        </button>
      </div>

      {/* Discreet Administrator Portal Access */}
      <div className="pt-4 pb-2 text-center">
        <a
          href="/partner-hub"
          onClick={(e) => {
            e.preventDefault();
            if (onNavigateToPartnerHub) {
              onNavigateToPartnerHub();
            } else {
              window.history.pushState({}, '', '/partner-hub');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }
          }}
          className="text-[11px] text-slate-400 hover:text-indigo-600 transition cursor-pointer inline-block"
        >
          Partner Hub Admin Portal
        </a>
      </div>
    </div>
  );
};
