import React, { useState } from 'react';
import {
  X,
  Bike,
  CreditCard,
  ShieldCheck,
  MapPin,
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  User,
  Phone,
  Mail,
  Lock,
  FileText,
} from 'lucide-react';
import { adminRegisterDeliveryPartner } from '../../services/dbService';
import { DeliveryPartner } from '../../types';

interface AdminRegisterDeliveryPartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPartnerRegistered: (partner: DeliveryPartner) => void;
}

export const AdminRegisterDeliveryPartnerModal: React.FC<AdminRegisterDeliveryPartnerModalProps> = ({
  isOpen,
  onClose,
  onPartnerRegistered,
}) => {
  // Personal & Auth Details
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('+91 ');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Area & Location
  const [pinCode, setPinCode] = useState('794114');
  const [serviceArea, setServiceArea] = useState('Rongara / Baghmara');
  const [address, setAddress] = useState('');

  // Vehicle Details
  const [vehicleType, setVehicleType] = useState<
    'Bike' | 'Scooter' | 'Bicycle' | 'Electric Vehicle' | 'Other'
  >('Bike');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [drivingLicenceNumber, setDrivingLicenceNumber] = useState('');

  // Bank & UPI Details
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [upiId, setUpiId] = useState('');

  // Status (Default: Approved under Admin Authority)
  const [status, setStatus] = useState<DeliveryPartner['status']>('approved');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (!fullName.trim()) {
      setErrorMsg('Please enter the delivery partner full name.');
      return;
    }

    if (!phoneNumber.trim() || phoneNumber.trim() === '+91') {
      setErrorMsg('Please enter a valid phone number.');
      return;
    }

    if (!password.trim() || password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long for app login.');
      return;
    }

    if (!pinCode.trim()) {
      setErrorMsg('Please enter the operating Area / Pincode.');
      return;
    }

    if (!vehicleNumber.trim()) {
      setErrorMsg('Please enter the vehicle registration number.');
      return;
    }

    if (!drivingLicenceNumber.trim()) {
      setErrorMsg('Please enter the driving license (DL) number.');
      return;
    }

    setLoading(true);

    try {
      const createdPartner = await adminRegisterDeliveryPartner({
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        email: cleanEmail,
        password: password.trim(),
        pinCode: pinCode.trim(),
        serviceArea: serviceArea.trim() || address.trim() || pinCode.trim(),
        vehicleType,
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        drivingLicenceNumber: drivingLicenceNumber.trim().toUpperCase(),
        bankDetails: {
          accountHolderName: accountHolderName.trim() || fullName.trim(),
          accountNumber: accountNumber.trim(),
          ifsc: ifsc.trim().toUpperCase(),
          upiId: upiId.trim(),
        },
        status,
      });

      onPartnerRegistered(createdPartner);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to register delivery partner.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Bike className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold">Partner Hub: Register Delivery Partner</h2>
                <span className="text-[10px] bg-emerald-500 text-slate-950 font-black px-2 py-0.5 rounded uppercase">
                  Admin Authority
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Directly onboard a delivery rider with login credentials and payout settlement details
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/20 transition cursor-pointer"
          >
            <X className="w-5 h-5 text-slate-300 hover:text-white" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Personal Details & App Login Credentials */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
            <h3 className="font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-4 h-4 text-emerald-600" />
              <span>Rider Profile & App Login Credentials</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Full Name *</label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sangma"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (!accountHolderName) setAccountHolderName(e.target.value);
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Phone Number *</label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="tel"
                    required
                    placeholder="+91 9876543210"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Email Address (Login ID) *</label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="email"
                    required
                    placeholder="rider@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Rider will use this email to log in</p>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Password (Login Password) *</label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-9 py-2 text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Password for rider app login</p>
              </div>
            </div>
          </div>

          {/* Section 2: Area & Operating Pincode */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
            <h3 className="font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>Operating Area & Location</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Area / Pincode *</label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="794114"
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 font-mono font-bold"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Primary delivery PIN code zone</p>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Service Area / Town</label>
                <input
                  type="text"
                  placeholder="e.g. Rongara / Baghmara Town"
                  value={serviceArea}
                  onChange={(e) => setServiceArea(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-600 font-medium mb-1">Full Residential Address / Hub</label>
                <input
                  type="text"
                  placeholder="e.g. Main Market, Near Rongara SBI Branch"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Vehicle & Driving License Details */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
            <h3 className="font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Bike className="w-4 h-4 text-emerald-600" />
              <span>Vehicle & Driving License (DL) Details</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Vehicle Type *</label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value as any)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                >
                  <option value="Bike">Bike (Motorcycle)</option>
                  <option value="Scooter">Scooter</option>
                  <option value="Bicycle">Bicycle</option>
                  <option value="Electric Vehicle">Electric Vehicle (EV)</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Vehicle Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ML-08-A-1234"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Driving License (DL) *</label>
                <div className="relative">
                  <FileText className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. DL-ML-2023-009876"
                    value={drivingLicenceNumber}
                    onChange={(e) => setDrivingLicenceNumber(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 font-mono uppercase"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Bank Details & UPI ID for Payouts */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
            <h3 className="font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <span>Bank Details & UPI ID (For Rider Payouts)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">UPI ID for Instant Payouts</label>
                <input
                  type="text"
                  placeholder="e.g. rider@oksbi or 9876543210@paytm"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Account Holder Name</label>
                <input
                  type="text"
                  placeholder="Rider name as per bank"
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Bank Account Number</label>
                <input
                  type="text"
                  placeholder="e.g. 123456789012"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">IFSC Code</label>
                <input
                  type="text"
                  placeholder="e.g. SBIN0004885"
                  value={ifsc}
                  onChange={(e) => setIfsc(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 font-mono uppercase"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Verification & Initial Status */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
            <h3 className="font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Initial Fleet Approval Status</span>
            </h3>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-slate-200 hover:border-emerald-500 flex-1">
                <input
                  type="radio"
                  name="riderStatus"
                  value="approved"
                  checked={status === 'approved'}
                  onChange={() => setStatus('approved')}
                  className="text-emerald-600 focus:ring-emerald-600"
                />
                <div>
                  <span className="font-bold text-slate-800">Approved (Active Immediately)</span>
                  <p className="text-[10px] text-slate-400">Rider can accept delivery orders right away</p>
                </div>
              </label>

              <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-slate-200 hover:border-amber-500 flex-1">
                <input
                  type="radio"
                  name="riderStatus"
                  value="pending"
                  checked={status === 'pending'}
                  onChange={() => setStatus('pending')}
                  className="text-amber-600 focus:ring-amber-600"
                />
                <div>
                  <span className="font-bold text-slate-800">Pending Verification</span>
                  <p className="text-[10px] text-slate-400">Rider is placed on hold until documents check</p>
                </div>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Registering Delivery Partner...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Register Delivery Partner</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
