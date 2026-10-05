import React, { useState, useEffect } from 'react';
import {
  X,
  MapPin,
  Plus,
  CheckCircle2,
  CreditCard,
  Smartphone,
  Banknote,
  ShieldCheck,
  Truck,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { Address, PlatformSettings, PaymentMethod, Order, VillageDeliveryRate } from '../../types';
import { createOrder, fetchVillageDeliveryRates } from '../../services/dbService';
import { doc, getDocs, collection, query, where, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { supabase } from '../../supabase';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderSuccess: (order: Order) => void;
  settings: PlatformSettings;
  singleBuyItem?: any;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  onOrderSuccess,
  settings,
  singleBuyItem,
}) => {
  const { user } = useAuth();
  const { items, subtotal: cartSubtotal, clearCart } = useCart();

  const checkoutItems = singleBuyItem
    ? [
        {
          productId: singleBuyItem.id,
          shopId: singleBuyItem.shopId,
          shopName: singleBuyItem.shopName,
          name: singleBuyItem.name,
          price: singleBuyItem.price,
          discountPrice: singleBuyItem.discountPrice || singleBuyItem.price,
          quantity: 1,
          image: singleBuyItem.images[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80',
          stock: singleBuyItem.stock,
          sellerPinCode: singleBuyItem.sellerPinCode,
          targetPinCode: singleBuyItem.targetPinCode,
          villageDeliveryRates: singleBuyItem.villageDeliveryRates,
        },
      ]
    : items;

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [showNewAddressForm, setShowNewAddressForm] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Hardcoded UPI Details for Greja Marak
  const upiId = 'grejamarak@okaxis';
  const upiPayeeName = 'Greja Marak';
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Village-based dynamic delivery charge state
  const [activePinCode, setActivePinCode] = useState<string>('');
  const [selectedVillageName, setSelectedVillageName] = useState<string>('');
  const [dynamicDeliveryFee, setDynamicDeliveryFee] = useState<number>(settings.deliveryBaseCharge);
  const [loadingVillages, setLoadingVillages] = useState<boolean>(false);

  // New Address Form State
  const [newFullName, setNewFullName] = useState(user?.displayName || '');
  const [newPhone, setNewPhone] = useState(user?.phoneNumber || '+91 98765 43210');
  const [newStreet, setNewStreet] = useState('');
  const [newCity, setNewCity] = useState('Resubelpara');
  const [newState, setNewState] = useState('Meghalaya');
  const [newPostalCode, setNewPostalCode] = useState('794114');
  const [newVillage, setNewVillage] = useState('');
  const [newLandmark, setNewLandmark] = useState('');
  const [newType, setNewType] = useState<'home' | 'work' | 'other'>('home');
  const [newAddressVillages, setNewAddressVillages] = useState<VillageDeliveryRate[]>([]);
  const [loadingNewAddressVillages, setLoadingNewAddressVillages] = useState<boolean>(false);

  // Dynamically fetch villages when entering PIN code in new address form
  useEffect(() => {
    const cleanPin = newPostalCode.trim();
    if (!cleanPin || cleanPin.length < 3) {
      setNewAddressVillages([]);
      return;
    }
    let isMounted = true;
    setLoadingNewAddressVillages(true);
    fetchVillageDeliveryRates(cleanPin)
      .then((rates) => {
        if (!isMounted) return;
        setNewAddressVillages(rates);
        if (rates.length > 0 && !newVillage) {
          setNewVillage(rates[0].villageName);
        }
      })
      .catch((err) => {
        console.warn('Error fetching villages in new address form:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingNewAddressVillages(false);
      });

    return () => {
      isMounted = false;
    };
  }, [newPostalCode]);

  // Subtotal & Dynamic totals
  const subtotal = singleBuyItem
    ? singleBuyItem.discountPrice || singleBuyItem.price
    : cartSubtotal;

  const deliveryFee = dynamicDeliveryFee;
  const platformFee = settings.platformFee;
  const totalAmount = subtotal + deliveryFee + platformFee;

  // Load customer addresses (strictly dynamic user addresses only, purging any demo mock addresses)
  useEffect(() => {
    if (!user) return;

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
      // 1. Try Supabase addresses
      try {
        const { data, error } = await supabase
          .from('addresses')
          .select('*')
          .eq('user_id', user.uid)
          .order('is_default', { ascending: false });

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

            // Purge demo Bangalore mock address if present
            if (isDemoMockAddress(addrObj)) {
              supabase.from('addresses').delete().eq('id', a.id).then(() => {});
              deleteDoc(doc(db, 'addresses', a.id)).catch(() => {});
            } else {
              list.push(addrObj);
            }
          }

          if (list.length > 0) {
            setAddresses(list);
            setSelectedAddressId(list[0].id);
            setShowNewAddressForm(false);
            return;
          }
        }
      } catch (err) {
        // Fallback
      }

      // 2. Fallback to Firestore
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

        if (list.length > 0) {
          setAddresses(list);
          setSelectedAddressId(list[0].id);
          setShowNewAddressForm(false);
        } else {
          // No addresses exist yet: display clean new address form directly
          setAddresses([]);
          setSelectedAddressId('');
          setShowNewAddressForm(true);
        }
      } catch (e) {
        console.warn('Addresses fetch error:', e);
      }
    };
    fetchAddresses();
  }, [user]);

  // Automatically read pre-selected village from chosen address and fetch corresponding delivery fee
  useEffect(() => {
    const chosenAddress = addresses.find((a) => a.id === selectedAddressId);
    if (!chosenAddress) return;

    const pin = (chosenAddress.postalCode || '').trim();
    const village = (chosenAddress.village || '').trim();

    if (!pin) {
      setDynamicDeliveryFee(settings.deliveryBaseCharge);
      setSelectedVillageName('');
      return;
    }

    setActivePinCode(pin);
    setSelectedVillageName(village);
    setLoadingVillages(true);

    // 1. Check if the seller has a product-specific village delivery charge for this village & PIN
    let matchedSellerFee: number | null = null;
    if (village) {
      const lowerVillage = village.toLowerCase();
      for (const ci of checkoutItems as any[]) {
        const pRates = ci.villageDeliveryRates;
        const targetPin = (ci.targetPinCode || ci.sellerPinCode || '').trim();
        if (Array.isArray(pRates) && (!targetPin || targetPin === pin)) {
          const match = pRates.find(
            (vr: any) => vr.villageName.toLowerCase() === lowerVillage
          );
          if (match && typeof match.deliveryCharge === 'number') {
            matchedSellerFee = match.deliveryCharge;
            break;
          }
        }
      }
    }

    if (matchedSellerFee !== null) {
      setDynamicDeliveryFee(matchedSellerFee);
      setLoadingVillages(false);
      return;
    }

    // 2. Fetch village rates for this PIN from database
    fetchVillageDeliveryRates(pin)
      .then((rates) => {
        if (village) {
          const lowerVillage = village.toLowerCase();
          const matchedDb = rates.find(
            (r) => r.villageName.toLowerCase() === lowerVillage
          );
          if (matchedDb) {
            setDynamicDeliveryFee(matchedDb.deliveryCharge);
            return;
          }
        }
        // Fallback to platform base delivery charge if no village rate match
        setDynamicDeliveryFee(settings.deliveryBaseCharge);
      })
      .catch((err) => {
        console.warn('Error fetching village rate for checkout address:', err);
        setDynamicDeliveryFee(settings.deliveryBaseCharge);
      })
      .finally(() => {
        setLoadingVillages(false);
      });
  }, [selectedAddressId, addresses, settings.deliveryBaseCharge, checkoutItems]);

  if (!isOpen) return null;

  const handleSaveNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const newAddr: Address = {
      id: 'addr_' + Date.now(),
      userId: user.uid,
      fullName: newFullName,
      phoneNumber: newPhone,
      streetAddress: newStreet,
      city: newCity,
      state: newState,
      postalCode: newPostalCode,
      village: newVillage || undefined,
      landmark: newLandmark,
      isDefault: addresses.length === 0,
      addressType: newType,
    };
    const compositeLandmark = newAddr.village
      ? (newAddr.landmark ? `Village: ${newAddr.village} | ${newAddr.landmark}` : `Village: ${newAddr.village}`)
      : (newAddr.landmark || null);

    try {
      await supabase.from('addresses').insert({
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
    } catch {}
    try {
      await setDoc(doc(db, 'addresses', newAddr.id), newAddr);
      setAddresses([...addresses, newAddr]);
      setSelectedAddressId(newAddr.id);
      setShowNewAddressForm(false);
    } catch (e) {
      console.error('Error saving address:', e);
    }
  };

  const handlePlaceOrder = async () => {
    if (!user) {
      setErrorMsg('Please sign in to place an order.');
      return;
    }
    const chosenAddress = addresses.find((a) => a.id === selectedAddressId);
    if (!chosenAddress) {
      setErrorMsg('Please select or add a delivery address.');
      return;
    }
    if (checkoutItems.length === 0) {
      setErrorMsg('No items in checkout.');
      return;
    }

    if (settings.localPinCodeRestriction) {
      const buyerPin = (chosenAddress.postalCode || '').trim();
      const hasBlocked = checkoutItems.some((it) => {
        const sellerPin = (it.sellerPinCode || '').trim();
        return sellerPin && sellerPin !== buyerPin;
      });
      if (hasBlocked) {
        setErrorMsg('Sorry, this product is currently available only in your local area.');
        return;
      }
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const updatedAddress = {
        ...chosenAddress,
        village: selectedVillageName || chosenAddress.village,
      };

      const order = await createOrder(
        user.uid,
        user.displayName || 'Customer',
        user.email || 'customer@bazaarx.com',
        user.phoneNumber || chosenAddress.phoneNumber,
        updatedAddress,
        checkoutItems,
        paymentMethod,
        settings,
        dynamicDeliveryFee,
        selectedVillageName || undefined
      );

      // Unconditionally clear active cart state on order completion
      clearCart();

      // Store placed order ID in localStorage for instant retrieval across all views
      try {
        const stored = JSON.parse(localStorage.getItem('bazaarx_my_order_ids') || '[]');
        if (!stored.includes(order.id)) {
          localStorage.setItem('bazaarx_my_order_ids', JSON.stringify([order.id, ...stored]));
        }
      } catch {}

      // Trigger UPI app intent deep link if UPI method chosen
      if (paymentMethod === 'upi') {
        const upiDeepLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiPayeeName)}&am=${totalAmount}&cu=INR&tn=${encodeURIComponent(`BazaarX Order ${order.id}`)}`;
        try {
          window.location.href = upiDeepLink;
        } catch {}
      }

      onOrderSuccess(order);
      onClose();
    } catch (err: any) {
      console.error('Order creation error:', err);
      setErrorMsg(err.message || 'Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#2874f0] text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-yellow-300" />
            <h2 className="text-base font-bold">Secure Checkout & Payment</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/20 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Delivery Address */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-xs sm:text-sm">
                <span className="w-5 h-5 rounded-full bg-[#2874f0] text-white flex items-center justify-center text-[10px]">
                  1
                </span>
                <span>Delivery Address</span>
              </div>
              {!showNewAddressForm && (
                <button
                  onClick={() => setShowNewAddressForm(true)}
                  className="text-xs font-semibold text-[#2874f0] hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add New</span>
                </button>
              )}
            </div>

            {showNewAddressForm ? (
              <form onSubmit={handleSaveNewAddress} className="space-y-3 bg-white p-4 rounded-lg border border-blue-200">
                <div className="text-xs font-bold text-slate-700 mb-2">New Address Details</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-500 font-medium mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={newFullName}
                      onChange={(e) => setNewFullName(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded outline-none focus:border-[#2874f0]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-medium mb-1">Mobile Number</label>
                    <input
                      type="tel"
                      required
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded outline-none focus:border-[#2874f0]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-slate-500 font-medium mb-1">Flat / House No. / Street</label>
                    <input
                      type="text"
                      required
                      value={newStreet}
                      onChange={(e) => setNewStreet(e.target.value)}
                      placeholder="e.g. House No. 12, Main Road"
                      className="w-full p-2 border border-slate-300 rounded outline-none focus:border-[#2874f0]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-medium mb-1">City</label>
                    <input
                      type="text"
                      required
                      value={newCity}
                      onChange={(e) => setNewCity(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded outline-none focus:border-[#2874f0]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-medium mb-1">State</label>
                    <input
                      type="text"
                      required
                      value={newState}
                      onChange={(e) => setNewState(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded outline-none focus:border-[#2874f0]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-medium mb-1">PIN Code *</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={newPostalCode}
                      onChange={(e) => setNewPostalCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="e.g. 794114"
                      className="w-full p-2 border border-slate-300 rounded outline-none focus:border-[#2874f0] font-semibold text-slate-800"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-slate-500 font-medium">Village / Locality *</label>
                      {loadingNewAddressVillages && (
                        <span className="text-[10px] text-blue-600 font-semibold animate-pulse">
                          Fetching...
                        </span>
                      )}
                    </div>
                    {newAddressVillages.length > 0 ? (
                      <select
                        required
                        value={newVillage}
                        onChange={(e) => setNewVillage(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded bg-white outline-none focus:border-[#2874f0] text-slate-800 font-semibold cursor-pointer"
                      >
                        <option value="">-- Select Village / Locality --</option>
                        {newAddressVillages.map((v, i) => (
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
                          value={newVillage}
                          onChange={(e) => setNewVillage(e.target.value)}
                          placeholder={
                            newPostalCode.length >= 6
                              ? 'Enter Village / Locality name'
                              : 'Enter PIN Code first to see villages'
                          }
                          className="w-full p-2 border border-slate-300 rounded outline-none focus:border-[#2874f0]"
                        />
                        {newPostalCode.length >= 6 && newAddressVillages.length === 0 && !loadingNewAddressVillages && (
                          <span className="text-[10px] text-slate-400 block">
                            No registered villages found for PIN {newPostalCode}. Enter your locality name above.
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-slate-500 font-medium mb-1">Landmark (Optional)</label>
                    <input
                      type="text"
                      value={newLandmark}
                      onChange={(e) => setNewLandmark(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded outline-none focus:border-[#2874f0]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowNewAddressForm(false)}
                    className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[#2874f0] text-white text-xs font-bold rounded shadow hover:bg-blue-700"
                  >
                    Save & Deliver Here
                  </button>
                </div>
              </form>
            ) : addresses.length === 0 ? (
              <div className="text-center p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <p className="text-xs font-semibold text-slate-700">No delivery address saved yet</p>
                <button
                  type="button"
                  onClick={() => setShowNewAddressForm(true)}
                  className="px-3 py-1.5 bg-[#2874f0] text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition cursor-pointer"
                >
                  + Add Delivery Address
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {addresses.map((addr) => (
                  <label
                    key={addr.id}
                    className={`block p-3 rounded-lg border cursor-pointer transition ${
                      selectedAddressId === addr.id
                        ? 'bg-blue-50/70 border-[#2874f0] ring-1 ring-[#2874f0]'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="radio"
                        name="delivery_address"
                        checked={selectedAddressId === addr.id}
                        onChange={() => setSelectedAddressId(addr.id)}
                        className="mt-1 accent-[#2874f0]"
                      />
                      <div className="flex-1 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{addr.fullName}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded uppercase font-bold bg-slate-200 text-slate-700">
                            {addr.addressType}
                          </span>
                          <span className="font-semibold text-slate-600">{addr.phoneNumber}</span>
                        </div>
                        <p className="text-slate-600 mt-0.5 leading-relaxed">
                          {addr.streetAddress}, {addr.city}, {addr.state} -{' '}
                          <span className="font-bold">{addr.postalCode}</span>
                          {addr.village && (
                            <span className="ml-1.5 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 inline-flex items-center gap-1 text-[11px]">
                              <MapPin className="w-3 h-3 text-emerald-600" />
                              Village: {addr.village}
                            </span>
                          )}
                          {addr.landmark && ` (Near ${addr.landmark})`}
                        </p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {/* Auto-detected Village and Delivery Fee Confirmation */}
            {selectedAddress && (
              <div className="mt-3 p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-emerald-950 font-medium">
                  <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Selected Village: <strong>{selectedAddress.village || 'Standard Area'}</strong> (PIN {selectedAddress.postalCode || activePinCode})
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">Locality Delivery Fee</span>
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                    {loadingVillages ? 'Calculating...' : `₹${dynamicDeliveryFee}`}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Order Items Summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs sm:text-sm mb-3">
              <span className="w-5 h-5 rounded-full bg-[#2874f0] text-white flex items-center justify-center text-[10px]">
                2
              </span>
              <span>Order Summary ({checkoutItems.length} items)</span>
            </div>

            <div className="divide-y divide-slate-200 max-h-40 overflow-y-auto">
              {checkoutItems.map((it) => (
                <div key={it.productId} className="py-2 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <img src={it.image} alt="" className="w-10 h-10 object-contain rounded bg-white p-1 shrink-0 border border-slate-200" />
                    <div className="truncate">
                      <div className="font-semibold text-slate-800 truncate">{it.name}</div>
                      <div className="text-[10px] text-slate-400">Qty: {it.quantity} • {it.shopName}</div>
                    </div>
                  </div>
                  <div className="font-bold text-slate-900 whitespace-nowrap">
                    ₹{(it.discountPrice * it.quantity).toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Payment Options */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs sm:text-sm mb-3">
              <span className="w-5 h-5 rounded-full bg-[#2874f0] text-white flex items-center justify-center text-[10px]">
                3
              </span>
              <span>Payment Options</span>
            </div>

            <div className="space-y-2 text-xs">
              <label
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition ${
                  paymentMethod === 'upi'
                    ? 'bg-blue-50/80 border-[#2874f0] ring-1 ring-[#2874f0]'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="payment"
                    value="upi"
                    checked={paymentMethod === 'upi'}
                    onChange={() => setPaymentMethod('upi')}
                    className="accent-[#2874f0]"
                  />
                  <div className="p-1.5 rounded-full bg-blue-100 text-blue-700">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">UPI (Google Pay, PhonePe, Paytm, BHIM)</div>
                    <div className="text-[11px] text-slate-500">Fastest and 100% secure instant checkout</div>
                  </div>
                </div>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                  Recommended
                </span>
              </label>

              {/* UPI Transaction Card with grejamarak@okaxis, dynamic total amount, and QR code */}
              {paymentMethod === 'upi' && (
                <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl space-y-3">
                  <div className="flex flex-col sm:flex-row items-center gap-3.5">
                    <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-2xs shrink-0 text-center">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(
                          `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiPayeeName)}&am=${totalAmount}&cu=INR&tn=${encodeURIComponent(`BazaarX Order Payment`)}`
                        )}`}
                        alt="UPI Payment QR Code"
                        className="w-24 h-24 sm:w-28 sm:h-28 mx-auto"
                      />
                      <span className="text-[10px] text-slate-500 font-bold block mt-1">Scan & Pay via UPI</span>
                    </div>

                    <div className="space-y-1.5 flex-1 text-xs">
                      <div>
                        <span className="text-slate-500 text-[11px] block">Payee Name</span>
                        <span className="font-extrabold text-slate-900 text-sm">{upiPayeeName}</span>
                      </div>

                      <div>
                        <span className="text-slate-500 text-[11px] block">UPI ID</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <code className="bg-white px-2.5 py-1 rounded border border-slate-300 font-mono font-bold text-blue-900 text-xs select-all">
                            {upiId}
                          </code>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(upiId);
                              setCopiedUpi(true);
                              setTimeout(() => setCopiedUpi(false), 2000);
                            }}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-[11px] font-bold transition cursor-pointer"
                          >
                            {copiedUpi ? 'Copied! ✓' : 'Copy UPI ID'}
                          </button>
                        </div>
                      </div>

                      <div className="pt-0.5">
                        <span className="text-slate-500 text-[11px] block">Payable Amount</span>
                        <span className="text-base font-black text-emerald-700">₹{totalAmount.toLocaleString('en-IN')}</span>
                      </div>

                      <div className="pt-1">
                        <a
                          href={`upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiPayeeName)}&am=${totalAmount}&cu=INR&tn=${encodeURIComponent(`BazaarX Order Payment`)}`}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#2874f0] hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition shadow-2xs cursor-pointer"
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                          <span>Open UPI App (GPay / PhonePe / Paytm)</span>
                        </a>
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-600 bg-white/90 p-2 rounded-lg border border-blue-100/80">
                    💡 Click <strong>"Open UPI App"</strong> or scan the QR code to send ₹{totalAmount} to <strong>{upiId}</strong>, then tap <strong>"Confirm Order"</strong> below.
                  </p>
                </div>
              )}

              <label
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition ${
                  paymentMethod === 'card'
                    ? 'bg-blue-50/80 border-[#2874f0] ring-1 ring-[#2874f0]'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="payment"
                    value="card"
                    checked={paymentMethod === 'card'}
                    onChange={() => setPaymentMethod('card')}
                    className="accent-[#2874f0]"
                  />
                  <div className="p-1.5 rounded-full bg-emerald-100 text-emerald-700">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">Credit / Debit / ATM Card</div>
                    <div className="text-[11px] text-slate-500">Visa, MasterCard, RuPay, Diners Club</div>
                  </div>
                </div>
              </label>

              {settings.cashOnDeliveryEnabled && (
                <label
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition ${
                    paymentMethod === 'cod'
                      ? 'bg-blue-50/80 border-[#2874f0] ring-1 ring-[#2874f0]'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="payment"
                      value="cod"
                      checked={paymentMethod === 'cod'}
                      onChange={() => setPaymentMethod('cod')}
                      className="accent-[#2874f0]"
                    />
                    <div className="p-1.5 rounded-full bg-amber-100 text-amber-700">
                      <Banknote className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">Cash on Delivery (COD)</div>
                      <div className="text-[11px] text-slate-500">Pay cash or UPI upon delivery at doorstep</div>
                    </div>
                  </div>
                </label>
              )}
            </div>
          </div>

          {/* Section 4: Total Bill Breakdown */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-xs space-y-1.5">
            <div className="flex justify-between text-slate-600">
              <span>Items Subtotal</span>
              <span>₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Delivery Fee</span>
              <span>₹{deliveryFee}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Platform Fee</span>
              <span>₹{platformFee}</span>
            </div>
            <div className="border-t border-dashed border-slate-200 pt-2 flex justify-between font-black text-slate-900 text-sm">
              <span>Total Payable</span>
              <span className="text-base text-[#2874f0]">₹{totalAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Payable Amount</div>
            <div className="text-base sm:text-lg font-black text-slate-900">₹{totalAmount.toLocaleString('en-IN')}</div>
          </div>

          <button
            onClick={handlePlaceOrder}
            disabled={loading || !selectedAddressId}
            className="min-h-[46px] px-5 sm:px-6 py-2.5 bg-[#fb641b] hover:bg-[#e85b17] text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition cursor-pointer touch-manipulation active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span>Placing Order...</span>
            ) : (
              <>
                <span>Confirm Order</span>
                <Truck className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
