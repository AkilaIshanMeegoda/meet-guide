import { Amplify } from 'aws-amplify';
import { signIn, signOut, signUp, confirmSignUp, getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';

// Configure Amplify with Cognito settings from environment variables
const configureAmplify = () => {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
        userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '',
        loginWith: {
          oauth: {
            domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN || '',
            scopes: ['email', 'openid', 'profile'],
            redirectSignIn: [
              typeof window !== 'undefined' ? window.location.origin : '',
              'http://localhost:3000'
            ],
            redirectSignOut: [
              typeof window !== 'undefined' ? window.location.origin : '',
              'http://localhost:3000'
            ],
            responseType: 'code'
          }
        }
      }
    }
  }, {
    ssr: true
  });
};

// Initialize Amplify
if (typeof window !== 'undefined') {
  configureAmplify();
}

// Auth helper functions
export const auth = {
  // Sign in with email and password
  signIn: async (email: string, password: string) => {
    try {
      const { isSignedIn, nextStep } = await signIn({ username: email, password });
      return { success: true, isSignedIn, nextStep };
    } catch (error: any) {
      console.error('Error signing in:', error);
      return { success: false, error: error.message || 'Failed to sign in' };
    }
  },

  // Sign up new user
  signUp: async (email: string, password: string, name: string) => {
    try {
      const { isSignUpComplete, userId, nextStep } = await signUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email,
            name
          }
        }
      });
      return { success: true, isSignUpComplete, userId, nextStep };
    } catch (error: any) {
      console.error('Error signing up:', error);
      return { success: false, error: error.message || 'Failed to sign up' };
    }
  },

  // Confirm sign up with verification code
  confirmSignUp: async (email: string, code: string) => {
    try {
      const { isSignUpComplete, nextStep } = await confirmSignUp({
        username: email,
        confirmationCode: code
      });
      return { success: true, isSignUpComplete, nextStep };
    } catch (error: any) {
      console.error('Error confirming sign up:', error);
      return { success: false, error: error.message || 'Failed to confirm sign up' };
    }
  },

  // Sign out
  signOut: async () => {
    try {
      await signOut();
      return { success: true };
    } catch (error: any) {
      console.error('Error signing out:', error);
      return { success: false, error: error.message || 'Failed to sign out' };
    }
  },

  // Get current authenticated user
  getCurrentUser: async () => {
    try {
      const user = await getCurrentUser();
      return { success: true, user };
    } catch (error: any) {
      console.error('Error getting current user:', error);
      return { success: false, error: error.message || 'Not authenticated' };
    }
  },

  // Get auth session with tokens
  getSession: async () => {
    try {
      const session = await fetchAuthSession();
      return {
        success: true,
        tokens: session.tokens,
        idToken: session.tokens?.idToken?.toString(),
        accessToken: session.tokens?.accessToken?.toString()
      };
    } catch (error: any) {
      console.error('Error getting session:', error);
      return { success: false, error: error.message || 'Failed to get session' };
    }
  },

  // Check if user is authenticated
  isAuthenticated: async () => {
    try {
      await getCurrentUser();
      return true;
    } catch {
      return false;
    }
  }
};

export default auth;
