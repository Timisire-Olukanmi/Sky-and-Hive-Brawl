import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  auth,
  db,
  githubProvider,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import type { FighterId, PlayMode } from '../game/types';
import {
  createEmptyScoreboard,
  EMAIL_MAX_LENGTH,
  sanitizeDisplayName,
  sanitizeFighterId,
  sanitizeMapSelection,
  sanitizePlayMode,
  sanitizeScoreboard,
  type AuthProviderKind,
  type MapSelection,
  type ScoreboardStats,
  type UserPrivateAccountDoc,
  type UserProfileDoc,
} from '../types/account';

export const SCOREBOARD_STORAGE_KEY = 'sky_hive_brawl_scoreboard_v1';

export interface AuthFeedbackError {
  code?: string;
  message: string;
  setupHint?: string;
}

export type CloudSyncStatus = 'local' | 'syncing' | 'synced' | 'error';

export interface ProfileUpdateInput {
  displayName: string;
  favoriteFighter: FighterId;
  defaultMap: MapSelection;
  preferredMode: PlayMode;
}

interface FirebaseContextValue {
  user: User | null;
  authReady: boolean;
  profile: UserProfileDoc | null;
  privateAccount: UserPrivateAccountDoc | null;
  profileLoading: boolean;
  syncStatus: CloudSyncStatus;
  authPendingProvider: AuthProviderKind | null;
  authError: AuthFeedbackError | null;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<boolean>;
  signInWithGitHub: () => Promise<boolean>;
  signInAsGuest: () => Promise<boolean>;
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  registerWithEmail: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<boolean>;
  sendPasswordReset: (email: string) => Promise<boolean>;
  linkGuestWithGoogle: () => Promise<boolean>;
  linkGuestWithEmail: (
    email: string,
    password: string,
    displayName?: string
  ) => Promise<boolean>;
  signOutUser: () => Promise<void>;
  updateUserProfile: (input: ProfileUpdateInput) => Promise<boolean>;
  saveCloudScoreboard: (stats: ScoreboardStats) => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

function readLocalScoreboardSeed(): ScoreboardStats {
  if (typeof window === 'undefined') return createEmptyScoreboard();
  try {
    const raw = window.localStorage.getItem(SCOREBOARD_STORAGE_KEY);
    if (!raw) return createEmptyScoreboard();
    return sanitizeScoreboard(JSON.parse(raw));
  } catch {
    return createEmptyScoreboard();
  }
}

function detectProviderKind(user: User): AuthProviderKind {
  if (user.isAnonymous) return 'anonymous';
  const pid = user.providerData[0]?.providerId;
  if (pid === 'google.com') return 'google';
  if (pid === 'github.com') return 'github';
  if (pid === 'password') return 'password';
  return 'google';
}

function mapFirebaseAuthError(
  err: unknown,
  attemptedProvider?: AuthProviderKind
): AuthFeedbackError {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: unknown }).code)
      : undefined;

  if (code === 'auth/operation-not-allowed') {
    const providerLabel =
      attemptedProvider === 'github'
        ? 'GitHub'
        : attemptedProvider === 'password'
        ? 'Email/Password'
        : attemptedProvider === 'anonymous'
        ? 'Anonymous'
        : 'this sign-in provider';
    return {
      code,
      message: `${providerLabel} sign-in is not enabled yet in Firebase Authentication.`,
      setupHint: `Open Firebase Console → Authentication → Sign-in method and enable ${providerLabel}.`,
    };
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return {
      code,
      message: 'Sign-in popup was closed before completing.',
    };
  }
  if (code === 'auth/popup-blocked') {
    return {
      code,
      message: 'Sign-in popup was blocked by your browser. Please allow popups and try again.',
    };
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return {
      code,
      message:
        'An account already exists with this email using a different login method. Sign in with that method first.',
    };
  }
  if (code === 'auth/credential-already-in-use') {
    return {
      code,
      message:
        'That email or provider account is already linked to another user. Sign out of Guest and sign in directly.',
    };
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return {
      code,
      message: 'Incorrect email or password. Double-check your credentials or reset your password.',
    };
  }
  if (code === 'auth/email-already-in-use') {
    return {
      code,
      message: 'An account with this email already exists. Try signing in instead.',
    };
  }
  if (code === 'auth/weak-password') {
    return {
      code,
      message: 'Password must be at least 6 characters long.',
    };
  }
  if (code === 'auth/invalid-email') {
    return {
      code,
      message: 'Please enter a valid email address.',
    };
  }
  if (code === 'auth/too-many-requests') {
    return {
      code,
      message: 'Too many attempts. Please wait a moment before trying again.',
    };
  }
  if (code === 'auth/unauthorized-domain') {
    return {
      code,
      message: 'This domain is not yet authorized in Firebase Authentication settings.',
      setupHint:
        'Add this app hostname under Firebase Console → Authentication → Settings → Authorized domains.',
    };
  }

  return {
    code,
    message:
      err instanceof Error ? err.message : 'Authentication failed. Please try again.',
  };
}

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserProfileDoc | null>(null);
  const [privateAccount, setPrivateAccount] = useState<UserPrivateAccountDoc | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>('local');
  const [authPendingProvider, setAuthPendingProvider] = useState<AuthProviderKind | null>(
    null
  );
  const [authError, setAuthError] = useState<AuthFeedbackError | null>(null);

  const activeUidRef = useRef<string | null>(null);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  const ensureUserDocuments = useCallback(async (currentUser: User) => {
    const uid = currentUser.uid;
    const profilePath = `users/${uid}`;
    const privatePath = `users/${uid}/private/account`;
    const profileRef = doc(db, 'users', uid);
    const privateRef = doc(db, 'users', uid, 'private', 'account');

    let profileSnap;
    try {
      profileSnap = await getDoc(profileRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, profilePath);
    }

    if (!profileSnap.exists()) {
      const defaultName = currentUser.isAnonymous
        ? `Guest_${uid.slice(0, 5)}`
        : sanitizeDisplayName(
            currentUser.displayName || currentUser.email?.split('@')[0],
            'Brawler'
          );
      const seededScoreboard = sanitizeScoreboard(readLocalScoreboardSeed());
      const newProfile: UserProfileDoc = {
        uid,
        displayName: defaultName,
        favoriteFighter: 'honey_shell',
        defaultMap: 'hive_canopy',
        preferredMode: '1P_AI',
        scoreboard: seededScoreboard,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      try {
        await setDoc(profileRef, newProfile);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, profilePath);
      }
    }

    let privateSnap;
    try {
      privateSnap = await getDoc(privateRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, privatePath);
    }

    const providerKind = detectProviderKind(currentUser);
    const safeEmail = (currentUser.email ?? '').slice(0, EMAIL_MAX_LENGTH);

    if (!privateSnap.exists()) {
      const newPrivate: UserPrivateAccountDoc = {
        uid,
        email: safeEmail,
        authProvider: providerKind,
        isGuest: currentUser.isAnonymous,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      try {
        await setDoc(privateRef, newPrivate);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, privatePath);
      }
      setPrivateAccount({
        uid,
        email: safeEmail,
        authProvider: providerKind,
        isGuest: currentUser.isAnonymous,
      });
    } else {
      const existingData = privateSnap.data() as UserPrivateAccountDoc;
      if (
        existingData.email !== safeEmail ||
        existingData.authProvider !== providerKind ||
        existingData.isGuest !== currentUser.isAnonymous
      ) {
        try {
          await updateDoc(privateRef, {
            email: safeEmail,
            authProvider: providerKind,
            isGuest: currentUser.isAnonymous,
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, privatePath);
        }
      }
      setPrivateAccount({
        uid,
        email: safeEmail,
        authProvider: providerKind,
        isGuest: currentUser.isAnonymous,
      });
    }
  }, []);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (nextUser) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      setUser(nextUser);
      setAuthReady(true);
      activeUidRef.current = nextUser?.uid ?? null;

      if (!nextUser) {
        setProfile(null);
        setPrivateAccount(null);
        setProfileLoading(false);
        setSyncStatus('local');
        return;
      }

      setProfileLoading(true);
      setSyncStatus('syncing');

      try {
        await ensureUserDocuments(nextUser);
      } catch {
        // ensureUserDocuments already logs and throws structured error
        setProfileLoading(false);
        setSyncStatus('error');
        return;
      }

      if (activeUidRef.current !== nextUser.uid) return;

      const profilePath = `users/${nextUser.uid}`;
      const profileRef = doc(db, 'users', nextUser.uid);

      unsubscribeProfile = onSnapshot(
        profileRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const raw = snapshot.data() as Record<string, unknown>;
            const sanitized: UserProfileDoc = {
              uid: nextUser.uid,
              displayName: sanitizeDisplayName(
                typeof raw.displayName === 'string' ? raw.displayName : undefined
              ),
              favoriteFighter: sanitizeFighterId(raw.favoriteFighter),
              defaultMap: sanitizeMapSelection(raw.defaultMap),
              preferredMode: sanitizePlayMode(raw.preferredMode),
              scoreboard: sanitizeScoreboard(raw.scoreboard),
            };
            setProfile(sanitized);
            setSyncStatus('synced');
          }
          setProfileLoading(false);
        },
        (error) => {
          setProfileLoading(false);
          setSyncStatus('error');
          handleFirestoreError(error, OperationType.GET, profilePath);
        }
      );
    });

    return () => {
      if (unsubscribeProfile) unsubscribeProfile();
      unsubscribeAuth();
    };
  }, [ensureUserDocuments]);

  const runAuthAction = useCallback(
    async (provider: AuthProviderKind, fn: () => Promise<void>): Promise<boolean> => {
      setAuthError(null);
      setAuthPendingProvider(provider);
      try {
        await fn();
        return true;
      } catch (err) {
        setAuthError(mapFirebaseAuthError(err, provider));
        return false;
      } finally {
        setAuthPendingProvider(null);
      }
    },
    []
  );

  const signInWithGoogle = useCallback(
    () =>
      runAuthAction('google', async () => {
        await signInWithPopup(auth, googleProvider);
      }),
    [runAuthAction]
  );

  const signInWithGitHub = useCallback(
    () =>
      runAuthAction('github', async () => {
        await signInWithPopup(auth, githubProvider);
      }),
    [runAuthAction]
  );

  const signInAsGuest = useCallback(
    () =>
      runAuthAction('anonymous', async () => {
        await signInAnonymously(auth);
      }),
    [runAuthAction]
  );

  const signInWithEmail = useCallback(
    (email: string, password: string) =>
      runAuthAction('password', async () => {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }),
    [runAuthAction]
  );

  const registerWithEmail = useCallback(
    (email: string, password: string, displayName: string) =>
      runAuthAction('password', async () => {
        const cleanName = sanitizeDisplayName(displayName, 'Brawler');
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(cred.user, { displayName: cleanName });
        await cred.user.getIdToken(true);
        void sendEmailVerification(cred.user).catch(() => {
          // Non-blocking verification email
        });
        await ensureUserDocuments(cred.user);
      }),
    [ensureUserDocuments, runAuthAction]
  );

  const sendPasswordReset = useCallback(
    (email: string) =>
      runAuthAction('password', async () => {
        await sendPasswordResetEmail(auth, email.trim());
      }),
    [runAuthAction]
  );

  const linkGuestWithGoogle = useCallback(
    () =>
      runAuthAction('google', async () => {
        if (!auth.currentUser) throw new Error('No active session to upgrade.');
        const cred = await linkWithPopup(auth.currentUser, googleProvider);
        await cred.user.getIdToken(true);
        await ensureUserDocuments(cred.user);
      }),
    [ensureUserDocuments, runAuthAction]
  );

  const linkGuestWithEmail = useCallback(
    (email: string, password: string, displayName?: string) =>
      runAuthAction('password', async () => {
        if (!auth.currentUser) throw new Error('No active session to upgrade.');
        const credential = EmailAuthProvider.credential(email.trim(), password);
        const cred = await linkWithCredential(auth.currentUser, credential);
        if (displayName && displayName.trim().length > 0) {
          const cleanName = sanitizeDisplayName(displayName, 'Brawler');
          await updateProfile(cred.user, { displayName: cleanName });
          await updateDoc(doc(db, 'users', cred.user.uid), {
            displayName: cleanName,
            updatedAt: serverTimestamp(),
          });
        }
        await cred.user.getIdToken(true);
        await ensureUserDocuments(cred.user);
      }),
    [ensureUserDocuments, runAuthAction]
  );

  const signOutUser = useCallback(async () => {
    setAuthError(null);
    await signOut(auth);
  }, []);

  const updateUserProfile = useCallback(
    async (input: ProfileUpdateInput): Promise<boolean> => {
      const currentUser = auth.currentUser;
      if (!currentUser) return false;

      const cleanDisplayName = sanitizeDisplayName(input.displayName, 'Brawler');
      const cleanFighter = sanitizeFighterId(input.favoriteFighter);
      const cleanMap = sanitizeMapSelection(input.defaultMap);
      const cleanMode = sanitizePlayMode(input.preferredMode);

      const profilePath = `users/${currentUser.uid}`;
      setSyncStatus('syncing');
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
          displayName: cleanDisplayName,
          favoriteFighter: cleanFighter,
          defaultMap: cleanMap,
          preferredMode: cleanMode,
          updatedAt: serverTimestamp(),
        });
        if (currentUser.displayName !== cleanDisplayName) {
          void updateProfile(currentUser, { displayName: cleanDisplayName }).catch(() => {});
        }
        setSyncStatus('synced');
        return true;
      } catch (error) {
        setSyncStatus('error');
        handleFirestoreError(error, OperationType.UPDATE, profilePath);
      }
    },
    []
  );

  const saveCloudScoreboard = useCallback(async (stats: ScoreboardStats): Promise<void> => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const cleanStats = sanitizeScoreboard(stats);
    const profilePath = `users/${currentUser.uid}`;
    setSyncStatus('syncing');
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        scoreboard: cleanStats,
        updatedAt: serverTimestamp(),
      });
      setSyncStatus('synced');
    } catch (error) {
      setSyncStatus('error');
      handleFirestoreError(error, OperationType.UPDATE, profilePath);
    }
  }, []);

  const value = useMemo<FirebaseContextValue>(
    () => ({
      user,
      authReady,
      profile,
      privateAccount,
      profileLoading,
      syncStatus,
      authPendingProvider,
      authError,
      clearAuthError,
      signInWithGoogle,
      signInWithGitHub,
      signInAsGuest,
      signInWithEmail,
      registerWithEmail,
      sendPasswordReset,
      linkGuestWithGoogle,
      linkGuestWithEmail,
      signOutUser,
      updateUserProfile,
      saveCloudScoreboard,
    }),
    [
      authError,
      authPendingProvider,
      authReady,
      clearAuthError,
      linkGuestWithEmail,
      linkGuestWithGoogle,
      privateAccount,
      profile,
      profileLoading,
      registerWithEmail,
      saveCloudScoreboard,
      sendPasswordReset,
      signInAsGuest,
      signInWithEmail,
      signInWithGitHub,
      signInWithGoogle,
      signOutUser,
      syncStatus,
      updateUserProfile,
      user,
    ]
  );

  return <FirebaseContext.Provider value={value}>{children}</FirebaseContext.Provider>;
}

export function useFirebase(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }
  return ctx;
}
