import React, { useState } from 'react';
import { X, Store, Building2, CreditCard, ShieldCheck, MapPin, AlertCircle, Check } from 'lucide-react';
import { registerShop, getShopByOwnerId } from '../../services/dbService';
import { supabase } from '../../supabase';
import { Shop } from '../../types';

interface AdminRegisterShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShopRegistered: (shop: Shop) => void;
}

export const AdminRegisterShopModal: React.FC<AdminRegisterShopModalProps> = ({
  isOpen,
  onClose,
  onShopRegistered,
}) => {
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('+91 ');
  const [shopAddress, setShopAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Meghalaya');
  const [postalCode, setPostalCode] = useState('');
  const [servicePinCode, setServicePinCode] = useState('');
  const [category, setCategory] = useState('Groceries & Daily Essentials');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [panNumber, setPanNumber] = useState('');

  // Bank & UPI Details
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [upiId, setUpiId] = useState('');

  // Initial Status (Partner Hub Admin has authority to directly approve)
  const [status, setStatus] = useState<Shop['status']>('approved');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid owner email / Gmail address.');
      return;
    }

    if (!shopName.trim()) {
      setErrorMsg('Please enter the shop name.');
      return;
    }

    if (!ownerName.trim()) {
      setErrorMsg('Please enter the owner full name.');
      return;
    }

    setLoading(true);

    try {
      // 1. Strict Duplicate Check: ensure no duplicate shop for this email
      const existingShop = await getShopByOwnerId('', cleanEmail);
      if (existingShop) {
        throw new Error(
          `A shop is already registered for "${cleanEmail}" (${existingShop.shopName}). A single Gmail ID is permitted only one shop profile.`
        );
      }

      // 2. Resolve ownerId: if user exists in public.users, use their UID; otherwise deterministic UID
      let resolvedOwnerId = `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
      try {
        const { data: uData } = await supabase
          .from('users')
          .select('uid')
          .ilike('email', cleanEmail)
          .limit(1)
          .maybeSingle();
        if (uData && uData.uid) {
          resolvedOwnerId = uData.uid;
        }
      } catch {}

      const cleanPostal = postalCode.trim();
      const cleanService = (servicePinCode || cleanPostal).trim();

      const createdShop = await registerShop(
        {
          ownerId: resolvedOwnerId,
          shopName: shopName.trim(),
          ownerName: ownerName.trim(),
          email: cleanEmail,
          phoneNumber: phoneNumber.trim(),
          shopAddress: shopAddress.trim(),
          city: city.trim(),
          state: state.trim(),
          postalCode: cleanPostal,
          servicePinCode: cleanService,
          category,
          description: description.trim(),
          logoUrl: logoUrl.trim() || 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=300&q=80',
          panNumber: panNumber.trim().toUpperCase(),
          bankDetails: {
            accountHolderName: accountHolderName.trim() || ownerName.trim(),
            accountNumber: accountNumber.trim(),
            ifsc: ifsc.trim().toUpperCase(),
            upiId: upiId.trim(),
          },
        },
        status
      );

      onShopRegistered(createdShop);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to register shop.');
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
            <Store className="w-6 h-6 text-emerald-400" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold">Partner Hub: Register New Seller</h2>
                <span className="text-[10px] bg-emerald-500 text-slate-950 font-black px-2 py-0.5 rounded uppercase">
                  Admin Authority
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Directly onboard a retail store and link it to the owner's Google account
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

          {/* Section 1: Business Details */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
            <h3 className="font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Store className="w-4 h-4 text-emerald-600" />
              <span>Shop & Business Details</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Shop / Business Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Garo Hills Mart"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded bg-white outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Retail Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded bg-white outline-none focus:border-emerald-600 font-medium"
                >
                  <option value="Food, Meals & Restaurant">Food, Cooked Meals & Restaurant</option>
                  <option value="Fresh Fruits & Vegetables">Fresh Fruits & Vegetables</option>
                  <option value="Groceries & Daily Essentials">Groceries & Daily Essentials</option>
                  <option value="Electronics & Mobiles">Electronics & Mobiles</option>
                  <option value="Clothing & Fashion">Clothing & Fashion</option>
                  <option value="Home, Kitchen & Living">Home, Kitchen & Living</option>
                  <option value="Health & Pharmacy">Health & Pharmacy</option>
                  <option value="Bakery & Sweets">Bakery & Sweets</option>
                  <option value="General Retail & Bazaar">General Retail & Bazaar</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-600 font-medium mb-1">Shop Description</label>
                <textarea
                  rows={2}
                  placeholder="Brief description of products sold..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded bg-white outline-none focus:border-emerald-600"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Owner & Auth Details */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
            <h3 className="font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <span>Owner & Login Account Credentials</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Owner Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gamjin Marak"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded bg-white outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Owner Gmail / Email ID * (Must match user Google login)
                </label>
                <input
                  type="email"
                  required
                  placeholder="vendor@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded bg-white outline-none focus:border-emerald-600 font-mono text-emerald-700 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Phone Number *</label>
                <input
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded bg-white outline-none focus:border-emerald-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">PAN Card / Reg Number</label>
                <input
                  type="text"
                  placeholder="ABCDE1234F"
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                  className="w-full p-2 border border-slate-300 rounded bg-white outline-none focus:border-emerald-600 uppercase"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Physical Address & Delivery PIN Code */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
            <h3 className="font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>Location & Delivery Service PIN Code</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-slate-600 font-medium mb-1">Physical Shop Street Address *</label>
                <input
                  type="text"
                  required
                  placeholder="Main Market Road, Near Town Clock Tower"
                  value={shopAddress}
                  onChange={(e) => setShopAddress(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded bg-white outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">City / Town *</label>
                <input
                  type="text"
                  required
                  placeholder="Tura"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded bg-white outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">State *</label>
                <input
                  type="text"
                  required
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded bg-white outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Shop Postal Code (PIN) *</label>
                <input
                  type="text"
                  required
                  placeholder="794001"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded bg-white outline-none focus:border-emerald-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Service Area PIN Code * (Matches customer ordering filter)
                </label>
                <input
                  type="text"
                  placeholder="794001"
                  value={servicePinCode}
                  onChange={(e) => setServicePinCode(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded bg-white outline-none focus:border-emerald-600 font-mono font-bold text-blue-700"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Bank & UPI Settlements */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
            <h3 className="font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <span>Bank & Instant UPI Settlement Details</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Bank Account Holder Name</label>
                <input
                  type="text"
                  placeholder={ownerName || 'Name on bank passbook'}
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded bg-white outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Account Number</label>
                <input
                  type="text"
                  placeholder="123456789012"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded bg-white outline-none focus:border-emerald-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Bank IFSC Code</label>
                <input
                  type="text"
                  placeholder="SBIN0001234"
                  value={ifsc}
                  onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                  className="w-full p-2 border border-slate-300 rounded bg-white outline-none focus:border-emerald-600 font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Settlement UPI ID (Recommended for instant payouts)
                </label>
                <input
                  type="text"
                  placeholder="shopname@okaxis"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value.toLowerCase())}
                  className="w-full p-2 border border-slate-300 rounded bg-white outline-none focus:border-emerald-600 font-mono font-medium text-emerald-800"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Initial Status */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-2">
            <label className="block font-bold text-emerald-900">Initial Shop Status:</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-emerald-800">
                <input
                  type="radio"
                  name="status"
                  value="approved"
                  checked={status === 'approved'}
                  onChange={() => setStatus('approved')}
                  className="text-emerald-600"
                />
                <span>Approved & Active (Can list products immediately)</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700">
                <input
                  type="radio"
                  name="status"
                  value="pending_approval"
                  checked={status === 'pending_approval'}
                  onChange={() => setStatus('pending_approval')}
                  className="text-slate-600"
                />
                <span>Pending Verification</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{loading ? 'Registering Shop...' : 'Register & Provision Seller'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
