import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  setPersistence,
  browserLocalPersistence,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import { UserProfile, UserRole, Shop, DeliveryPartner } from '../types';
import { supabase } from '../supabase';
import { checkUserProfiles, ensureWalletExists, fetchUserRoleFromSupabase } from '../services/dbService';

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  role: UserRole;
  loading: boolean;
  hasRegisteredShop: boolean;
  hasRegisteredDelivery: boolean;
  registeredShop: Shop | null;
  registeredDeliveryPartner: DeliveryPartner | null;
  refreshProfiles: () => Promise<void>;
  signInEmail: (email: string, pass: string) => Promise<UserRole>;
  signUpEmail: (email: string, pass: string, name: string, role: UserRole) => Promise<UserRole>;
  signInGoogle: (role?: UserRole) => Promise<UserRole>;
  logout: () => Promise<void>;
  switchRole: (newRole: UserRole) => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  quickLoginAsRole: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Generate deterministic Firestore ID from email for fallback authentication
const getDeterministicUid = (email: string) => {
  const sanitized = email.toLowerCase().trim().replace(/[^a-zA-Z0-9]/g, '_');
  return `user_${sanitized}`;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole>('customer');
  const [loading, setLoading] = useState<boolean>(true);
  const [hasRegisteredShop, setHasRegisteredShop] = useState<boolean>(false);
  const [hasRegisteredDelivery, setHasRegisteredDelivery] = useState<boolean>(false);
  const [registeredShop, setRegisteredShop] = useState<Shop | null>(null);
  const [registeredDeliveryPartner, setRegisteredDeliveryPartner] = useState<DeliveryPartner | null>(null);

  // Synchronize user profile from Supabase and Firestore (with automatic shop and delivery partner detection)
  const syncUserProfile = async (fbUser: FirebaseUser, requestedRole?: UserRole): Promise<UserRole> => {
    try {
      const userRef = doc(db, 'users', fbUser.uid);
      const snap = await getDoc(userRef);

      // 1. Fetch user role and profiles from Supabase (authoritative source of truth)
      const {
        role: supabaseRole,
        hasShop,
        shop,
        hasDeliveryPartner,
        deliveryPartner,
      } = await fetchUserRoleFromSupabase(fbUser.uid, fbUser.email || undefined);

      setHasRegisteredShop(hasShop);
      setRegisteredShop(shop);
      setHasRegisteredDelivery(hasDeliveryPartner);
      setRegisteredDeliveryPartner(deliveryPartner);

      // 2. Authoritative role resolution from Supabase users table:
      let effectiveRole: UserRole = 'customer';
      if (supabaseRole === 'admin') {
        effectiveRole = 'admin';
      } else if (supabaseRole === 'seller') {
        effectiveRole = 'seller';
      } else if (supabaseRole === 'delivery_partner') {
        effectiveRole = 'delivery_partner';
      } else if (supabaseRole === 'customer') {
        effectiveRole = 'customer';
      } else if (hasShop) {
        effectiveRole = 'seller';
      } else if (hasDeliveryPartner) {
        effectiveRole = 'delivery_partner';
      } else if (requestedRole && requestedRole !== 'admin') {
        effectiveRole = requestedRole;
      }

      // Automatically ensure wallet entry exists in Supabase 'public.wallets' table for delivery partner
      if (effectiveRole === 'delivery_partner' || hasDeliveryPartner || requestedRole === 'delivery_partner') {
        const isSilgrak =
          (fbUser.email && fbUser.email.toLowerCase().includes('silgrakmarak1309')) ||
          fbUser.uid === 'silgrakmarak1309' ||
          fbUser.displayName?.toLowerCase().includes('silgrak');

        ensureWalletExists(fbUser.uid, 'delivery_partner', 0).catch(() => {});
        if (isSilgrak) {
          ensureWalletExists('silgrakmarak1309', 'delivery_partner', 0).catch(() => {});
        }
        if (deliveryPartner?.id) {
          ensureWalletExists(deliveryPartner.id, 'delivery_partner', 0).catch(() => {});
        }
      }

      // Automatically ensure wallet entry exists in Supabase 'public.wallets' table for sellers
      if (effectiveRole === 'seller' || hasShop || requestedRole === 'seller') {
        ensureWalletExists(fbUser.uid, 'seller', 0).catch(() => {});
        if (shop?.id) {
          ensureWalletExists(shop.id, 'seller', 0).catch(() => {});
        }
        if (shop?.ownerId && shop.ownerId !== fbUser.uid) {
          ensureWalletExists(shop.ownerId, 'seller', 0).catch(() => {});
        }
      }

      if (snap.exists()) {
        const profile = snap.data() as UserProfile;
        profile.role = effectiveRole;
        await updateDoc(userRef, { role: effectiveRole }).catch(() => {});
        setUser(profile);
        setRole(effectiveRole);
        localStorage.setItem('bazaarx_auth_user', JSON.stringify(profile));
      } else {
        const newProfile: UserProfile = {
          uid: fbUser.uid,
          email: fbUser.email || '',
          displayName: fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : 'Customer'),
          role: effectiveRole,
          photoURL: fbUser.photoURL || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await setDoc(userRef, newProfile);
        setUser(newProfile);
        setRole(effectiveRole);
        localStorage.setItem('bazaarx_auth_user', JSON.stringify(newProfile));
      }

      // Sync to Supabase public.users table
      try {
        await supabase.from('users').upsert({
          uid: fbUser.uid,
          email: fbUser.email || '',
          display_name: fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : 'User'),
          role: effectiveRole,
          photo_url: fbUser.photoURL || null,
          delivery_pin_code: '123456',
          updated_at: new Date().toISOString(),
        });
      } catch (sErr) {
        console.warn('Supabase user profile sync notice:', sErr);
      }

      return effectiveRole;
    } catch (err) {
      console.error('Error syncing user profile:', err);
      // Fallback local profile if offline, checking Supabase first
      const { role: fbRole } = await fetchUserRoleFromSupabase(fbUser.uid, fbUser.email || undefined).catch(() => ({ role: (requestedRole || 'customer') as UserRole }));
      const effectiveRole: UserRole = fbRole || requestedRole || 'customer';
      const fallback: UserProfile = {
        uid: fbUser.uid,
        email: fbUser.email || 'user@balpakram.com',
        displayName: fbUser.displayName || 'User',
        role: effectiveRole,
        createdAt: new Date().toISOString(),
      };
      setUser(fallback);
      setRole(fallback.role);
      localStorage.setItem('bazaarx_auth_user', JSON.stringify(fallback));

      try {
        await supabase.from('users').upsert({
          uid: fallback.uid,
          email: fallback.email,
          display_name: fallback.displayName,
          role: fallback.role,
          delivery_pin_code: '123456',
          updated_at: new Date().toISOString(),
        });
      } catch {}

      return effectiveRole;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        await syncUserProfile(fbUser);
      } else {
        // Check if user session stored in localStorage
        const saved = localStorage.getItem('bazaarx_auth_user') || localStorage.getItem('bazaarx_demo_user');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setUser(parsed);
            setRole(parsed.role);
            // Verify with Supabase and Firestore in background
            try {
              const { role: suRole } = await fetchUserRoleFromSupabase(parsed.uid, parsed.email);
              if (suRole && suRole !== parsed.role) {
                const refreshed = { ...parsed, role: suRole };
                setUser(refreshed);
                setRole(suRole);
                localStorage.setItem('bazaarx_auth_user', JSON.stringify(refreshed));
              }
            } catch (_) {
              // Ignore background fetch error
            }
          } catch (e) {
            setUser(null);
            setRole('customer');
          }
        } else {
          setUser(null);
          setRole('customer');
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInEmail = async (email: string, pass: string): Promise<UserRole> => {
    setLoading(true);
    const cleanEmail = email.toLowerCase().trim();
    try {
      // 1. Supabase Auth attempt
      let supabaseUser: any = null;
      try {
        const { data: suData } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: pass,
        });
        if (suData?.user) {
          supabaseUser = suData.user;
        }
      } catch (suErr) {
        console.warn('Supabase signInWithPassword note:', suErr);
      }

      // 2. Firebase Auth attempt
      let firebaseCred: any = null;
      let firebaseErr: any = null;
      try {
        firebaseCred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
      } catch (fbErr: any) {
        firebaseErr = fbErr;
        console.warn('Sign in with Firebase Auth returned an error, checking fallback:', fbErr);
      }

      // If both auth attempts failed and error is real invalid password
      if (!supabaseUser && !firebaseCred && firebaseErr) {
        const isOpNotAllowed =
          firebaseErr.code === 'auth/operation-not-allowed' ||
          firebaseErr.code === 'auth/configuration-not-found' ||
          (firebaseErr.message && firebaseErr.message.includes('operation-not-allowed'));
        if (!isOpNotAllowed) {
          throw firebaseErr;
        }
      }

      const uid = supabaseUser?.id || firebaseCred?.user?.uid || getDeterministicUid(cleanEmail);

      // Fetch authoritative role directly from Supabase users table
      const { role: supabaseRole, hasShop, hasDeliveryPartner } = await fetchUserRoleFromSupabase(uid, cleanEmail);
      let effectiveRole: UserRole = 'customer';
      if (supabaseRole === 'admin') {
        effectiveRole = 'admin';
      } else if (supabaseRole === 'seller') {
        effectiveRole = 'seller';
      } else if (supabaseRole === 'delivery_partner') {
        effectiveRole = 'delivery_partner';
      } else if (supabaseRole === 'customer') {
        effectiveRole = 'customer';
      } else if (hasShop) {
        effectiveRole = 'seller';
      } else if (hasDeliveryPartner) {
        effectiveRole = 'delivery_partner';
      }

      if (firebaseCred?.user) {
        await syncUserProfile(firebaseCred.user, effectiveRole);
      } else {
        const userRef = doc(db, 'users', uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const profile = snap.data() as UserProfile;
          profile.role = effectiveRole;
          setUser(profile);
          setRole(effectiveRole);
          localStorage.setItem('bazaarx_auth_user', JSON.stringify(profile));
        } else {
          const newProfile: UserProfile = {
            uid,
            email: cleanEmail,
            displayName: cleanEmail.split('@')[0].replace(/[._]/g, ' '),
            role: effectiveRole,
            photoURL: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          await setDoc(userRef, newProfile, { merge: true }).catch(() => {});
          setUser(newProfile);
          setRole(effectiveRole);
          localStorage.setItem('bazaarx_auth_user', JSON.stringify(newProfile));
        }
      }

      return effectiveRole;
    } finally {
      setLoading(false);
    }
  };

  const signUpEmail = async (email: string, pass: string, name: string, chosenRole: UserRole): Promise<UserRole> => {
    setLoading(true);
    const cleanEmail = email.toLowerCase().trim();
    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
      const userRole = await syncUserProfile(cred.user, chosenRole);
      return userRole;
    } catch (err: any) {
      console.warn('Sign up with Firebase Auth returned an error, checking fallback:', err);
      if (
        err.code === 'auth/operation-not-allowed' ||
        err.code === 'auth/configuration-not-found' ||
        (err.message && err.message.includes('operation-not-allowed'))
      ) {
        const uid = getDeterministicUid(cleanEmail);
        const userRef = doc(db, 'users', uid);
        const effectiveRole: UserRole = chosenRole || 'customer';
        const newProfile: UserProfile = {
          uid,
          email: cleanEmail,
          displayName: name.trim() || cleanEmail.split('@')[0],
          role: effectiveRole,
          photoURL: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await setDoc(userRef, newProfile, { merge: true });
        setUser(newProfile);
        setRole(effectiveRole);
        localStorage.setItem('bazaarx_auth_user', JSON.stringify(newProfile));

        try {
          await supabase.from('users').upsert({
            uid,
            email: cleanEmail,
            display_name: newProfile.displayName,
            role: effectiveRole,
            delivery_pin_code: '123456',
            updated_at: new Date().toISOString(),
          });
        } catch {}

        return effectiveRole;
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signInGoogle = async (chosenRole?: UserRole): Promise<UserRole> => {
    setLoading(true);
    try {
      // Configure prompt: 'select_account' ONLY when there is no active session (new users)
      const hasActiveSession = Boolean(
        auth.currentUser ||
        user ||
        localStorage.getItem('bazaarx_auth_user')
      );

      if (!hasActiveSession) {
        googleProvider.setCustomParameters({ prompt: 'select_account' });
      } else {
        googleProvider.setCustomParameters({});
      }

      // Persist session across browser sessions so user stays logged in automatically until explicit logout
      await setPersistence(auth, browserLocalPersistence).catch(() => {});

      const cred = await signInWithPopup(auth, googleProvider);
      const userRole = await syncUserProfile(cred.user, chosenRole);
      return userRole;
    } catch (err: any) {
      console.warn('Google sign in error, checking fallback:', err);
      if (
        err.code === 'auth/operation-not-allowed' ||
        err.code === 'auth/unauthorized-domain' ||
        err.code === 'auth/popup-blocked' ||
        err.code === 'auth/popup-closed-by-user' ||
        (err.message && err.message.includes('operation-not-allowed'))
      ) {
        // Fallback for preview / demo environment
        const googleEmail = 'customer@balpakram.in';
        const uid = getDeterministicUid(googleEmail);
        const userRef = doc(db, 'users', uid);
        const snap = await getDoc(userRef);

        const { role: supabaseRole } = await fetchUserRoleFromSupabase(uid, googleEmail);
        const effectiveRole: UserRole = chosenRole || supabaseRole || 'customer';

        let profile: UserProfile;
        if (snap.exists()) {
          profile = snap.data() as UserProfile;
          profile.role = effectiveRole;
        } else {
          profile = {
            uid,
            email: googleEmail,
            displayName: 'Customer User',
            role: effectiveRole,
            photoURL: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          await setDoc(userRef, profile, { merge: true });
        }
        setUser(profile);
        setRole(profile.role);
        localStorage.setItem('bazaarx_auth_user', JSON.stringify(profile));
        return effectiveRole;
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const refreshProfiles = async () => {
    if (!user) return;
    try {
      const res = await checkUserProfiles(user.uid, user.email);
      setHasRegisteredShop(res.hasShop);
      setRegisteredShop(res.shop);
      setHasRegisteredDelivery(res.hasDeliveryPartner);
      setRegisteredDeliveryPartner(res.deliveryPartner);
    } catch {}
  };

  const logout = async () => {
    try {
      localStorage.removeItem('bazaarx_auth_user');
      localStorage.removeItem('bazaarx_demo_user');
      sessionStorage.removeItem('partner_hub_token');
      sessionStorage.removeItem('partner_hub_admin');
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      await signOut(auth);
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      setFirebaseUser(null);
      setRole('customer');
      setHasRegisteredShop(false);
      setHasRegisteredDelivery(false);
      setRegisteredShop(null);
      setRegisteredDeliveryPartner(null);
    }
  };

  // Switch role allows switching active workspace tabs (customer, seller, delivery partner, admin)
  const switchRole = async (newRole: UserRole) => {
    // If switching to admin, only update active view tab; Partner Hub dashboard strictly requires server credentials
    if (newRole === 'admin') {
      setRole('admin');
      return;
    }

    setRole(newRole);
    if (user && user.role !== 'admin') {
      const updated = { ...user, role: newRole, updatedAt: new Date().toISOString() };
      setUser(updated);
      try {
        await setDoc(doc(db, 'users', user.uid), updated, { merge: true });
      } catch (e) {
        console.warn('Switch role update in firestore:', e);
      }
      localStorage.setItem('bazaarx_auth_user', JSON.stringify(updated));
    }
  };

  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    const updated = { ...user, ...data, updatedAt: new Date().toISOString() };
    setUser(updated);
    try {
      await setDoc(doc(db, 'users', user.uid), updated, { merge: true });
    } catch (e) {
      console.warn('Update profile error in firestore:', e);
    }
    localStorage.setItem('bazaarx_auth_user', JSON.stringify(updated));
  };

  // Quick switch role accounts for instant multi-role testing (Customer, Seller, Delivery Partner only)
  const quickLoginAsRole = async (targetRole: UserRole) => {
    setLoading(true);

    if (targetRole === 'admin') {
      // Partner Hub is strictly protected by server credentials Gamjinmarak / 130990
      setRole('admin');
      setLoading(false);
      return;
    }

    const demoProfiles: Record<'customer' | 'seller' | 'delivery_partner', UserProfile> = {
      customer: {
        uid: 'demo_customer_uid',
        email: 'rahul.customer@example.com',
        displayName: 'Rahul Sharma',
        role: 'customer',
        phoneNumber: '+91 98765 11223',
        photoURL: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
        createdAt: new Date().toISOString(),
      },
      seller: {
        uid: 'seller_registered_uid',
        email: 'seller@balpakram.com',
        displayName: 'New Registered Seller',
        role: 'seller',
        phoneNumber: '+91 98765 43210',
        photoURL: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80',
        createdAt: new Date().toISOString(),
      },
      delivery_partner: {
        uid: 'demo_delivery_uid',
        email: 'amit.delivery@example.com',
        displayName: 'Amit Kumar (Delivery Hero)',
        role: 'delivery_partner',
        phoneNumber: '+91 98111 22334',
        photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
        createdAt: new Date().toISOString(),
      },
    };

    const targetProfile = demoProfiles[targetRole];
    setUser(targetProfile);
    setRole(targetRole);

    if (targetRole === 'seller') {
      ensureWalletExists(targetProfile.uid, 'seller', 0).catch(() => {});
    }

    if (targetRole === 'delivery_partner') {
      ensureWalletExists(targetProfile.uid, 'delivery_partner', 0).catch(() => {});
      ensureWalletExists('silgrakmarak1309', 'delivery_partner', 0).catch(() => {});
    }
    localStorage.setItem('bazaarx_auth_user', JSON.stringify(targetProfile));
    localStorage.setItem('bazaarx_demo_user', JSON.stringify(targetProfile));

    // Also persist in Firestore so security rules and queries work immediately!
    try {
      await setDoc(doc(db, 'users', targetProfile.uid), targetProfile, { merge: true });
    } catch (e) {
      console.warn('Persisting demo profile to Firestore:', e);
    }

    setLoading(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        role,
        loading,
        hasRegisteredShop,
        hasRegisteredDelivery,
        registeredShop,
        registeredDeliveryPartner,
        refreshProfiles,
        signInEmail,
        signUpEmail,
        signInGoogle,
        logout,
        switchRole,
        updateUserProfile,
        quickLoginAsRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
