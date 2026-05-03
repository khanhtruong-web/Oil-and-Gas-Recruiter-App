import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  setPersistence,
  indexedDBLocalPersistence,
  User 
} from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { UserSettings } from "../types";
import { OperationType, handleFirestoreError } from "../lib/firestore-error";
import { googleManager } from "../services/GoogleWorkspaceManager";
import { toast } from "sonner";

interface AuthContextType {
  user: User | null;
  profile: UserSettings | null;
  loading: boolean;
  isSigningIn: boolean;
  error: string | null;
  accessToken: string | null;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  refreshTokenSilently: () => Promise<string | null>;
  authorizeDrive: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(googleManager.accessToken);

  useEffect(() => {
    // Sync googleManager with AuthContext values when loaded
    if (profile?.googleClientId) {
      googleManager.setClientId(profile.googleClientId);
    }
    googleManager.setRefreshFn(refreshTokenSilently);
  }, [profile, user]);

  useEffect(() => {
    // Force local persistence for better iframe stability
    setPersistence(auth, indexedDBLocalPersistence).catch(err => {
      console.warn("Persistence error:", err);
    });

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      try {
        setUser(u);
        if (u) {
          // Fetch or create profile
          const path = `settings/${u.uid}`;
          const profileRef = doc(db, 'settings', u.uid);
          let profileSnap;
          try {
            profileSnap = await getDoc(profileRef);
          } catch (err) {
            console.warn("Could not fetch profile (likely offline):", err);
          }
          
          if (profileSnap && profileSnap.exists()) {
            const profileData = profileSnap.data() as UserSettings;
            
            // Auto-upgrade everyone to Admin
            if (profileData.role !== 'Admin') {
              try {
                const upgradeData = {
                  ...profileData,
                  role: 'Admin',
                  updatedAt: serverTimestamp()
                };
                await setDoc(profileRef, upgradeData, { merge: true });
                profileData.role = 'Admin';
              } catch (updateErr) {
                console.warn("Could not upgrade profile role (offline):", updateErr);
              }
            }
            setProfile(profileData);
          } else {
            const newProfile: any = {
              userId: u.uid,
              userName: u.displayName || 'Unidentified User',
              email: u.email || '',
              role: 'Admin', 
            };
            try {
                newProfile.updatedAt = serverTimestamp();
                await setDoc(profileRef, newProfile);
            } catch (createErr) {
                console.warn("Could not write new profile (offline):", createErr);
                newProfile.updatedAt = new Date().toISOString(); 
            }
            setProfile({ ...newProfile, updatedAt: new Date().toISOString() } as UserSettings);
          }
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error("Auth state transition error:", err);
        setError("Lỗi kết nối database authentication.");
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  async function refreshTokenSilently(): Promise<string | null> {
    if (!profile?.googleClientId) return null;
    
    console.log("[Auth] Silent token refresh is not supported in this environment without user interaction. Prompting for reconnect.");
    // We cannot automatically pop up the OAuth window here because of browser block policies
    // User will see an AUTH_REQUIRED error and should manually click "Connect" again.
    return null;
  }

  const authorizeDrive = async (): Promise<string | null> => {
    return new Promise((resolve, reject) => {
      if (!profile?.googleClientId) {
        const err = new Error("Please configure Google OAuth Client ID in Settings first.");
        toast.error(err.message);
        resolve(null);
        return;
      }
      try {
        const clientId = profile.googleClientId;
        const redirectUri = `${window.location.origin}/auth/callback`;
        const scope = 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets';
        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'token',
            scope: scope,
            prompt: 'consent'
        });
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
        
        const popup = window.open(authUrl, 'oauth_popup', 'width=600,height=700');
        if (!popup) {
            toast.error("Popup blocked! Please allow popups or open in a new tab to connect your account.");
            reject(new Error("Popup blocked"));
            return;
        }

        const handleMessage = (event: MessageEvent) => {
            if (!event.origin.endsWith('.run.app') && !event.origin.includes('localhost') && event.origin !== window.location.origin) {
                return;
            }
            if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
                window.removeEventListener('message', handleMessage);
                const { token, expiresIn } = event.data;
                googleManager.setToken(token, expiresIn);
                setAccessToken(token);
                resolve(token);
            } else if (event.data?.type === 'OAUTH_AUTH_ERROR') {
                window.removeEventListener('message', handleMessage);
                toast.error("Authentication failed: " + event.data.error);
                reject(new Error(event.data.error));
            }
        };
        window.addEventListener('message', handleMessage);
      } catch (err) {
        console.error("Failed to initialize Google Auth Popup", err);
        reject(err);
      }
    });
  };

  const signIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive'); 
    provider.addScope('https://www.googleapis.com/auth/spreadsheets');
    provider.setCustomParameters({ prompt: 'select_account' });
    
    setError(null);
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;
      if (token) {
        // Firebase access token doesn't have an explicit expiry we can trust easily here
        // so we treat it as a normal session start. Google tokens from Firebase popup
        // often last 1 hour.
        googleManager.setToken(token, 3500); 
        setAccessToken(token);
      }

      // Log login activity
      if (result.user) {
        const path = 'activities';
        try {
          await addDoc(collection(db, path), {
            type: 'login',
            text: `${result.user.email} logged in to the dashboard.`,
            timestamp: serverTimestamp(),
            userName: result.user.displayName || result.user.email,
            userId: result.user.uid
          });
        } catch (logErr) {
          handleFirestoreError(logErr, OperationType.WRITE, path);
        }
      }

    } catch (e: any) {
      console.error("Sign in error", e);
      if (e.code === 'auth/popup-closed-by-user') {
        setError("Cửa sổ đăng nhập đã bị đóng.");
      } else if (e.code === 'auth/cancelled-popup-request') {
        console.warn("Popup request was cancelled by a newer request");
      } else if (e.code === 'auth/network-request-failed') {
        setError("Lỗi mạng, vui lòng kiểm tra kết nối.");
      } else if (e.code === 'auth/unauthorized-domain') {
        setError("Tên miền này chưa được cấp phép trong Firebase console.");
      } else {
        setError(e.message || "Đã xảy ra lỗi khi đăng nhập.");
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
    googleManager.logout();
    setAccessToken(null);
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isSigningIn, error, accessToken, signIn, logout, clearError, refreshTokenSilently, authorizeDrive }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
