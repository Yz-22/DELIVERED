import React, { createContext, useContext, useState, useEffect } from 'react';
import { TenantBranding } from '../types/logistics';
import { fetchCompanyBranding } from '../lib/branding';

interface TenantBrandingContextType {
  branding: TenantBranding;
  isLoading: boolean;
  refreshBranding: () => Promise<void>;
}

const defaultBranding: TenantBranding = {
  tenantId: '',
  companyName: 'Delivere',
  logoUrl: '',
  primaryColor: '#f59e0b',
  secondaryColor: '#0f172a',
};

const TenantBrandingContext = createContext<TenantBrandingContextType>({
  branding: defaultBranding,
  isLoading: false,
  refreshBranding: async () => {},
});

export const TenantBrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branding, setBranding] = useState<TenantBranding>(defaultBranding);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const refreshBranding = async () => {
    const token = localStorage.getItem('delivere_auth_token');
    if (!token) return;
    try {
      setIsLoading(true);
      const data = await fetchCompanyBranding();
      if (data) {
        setBranding(data);
      }
    } catch (e) {
      // Use safe fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshBranding();

    const handleBrandingUpdated = (e: any) => {
      if (e.detail) {
        setBranding(e.detail);
      } else {
        refreshBranding();
      }
    };

    window.addEventListener('company_branding_updated', handleBrandingUpdated);
    window.addEventListener('user_logged_in', refreshBranding);

    return () => {
      window.removeEventListener('company_branding_updated', handleBrandingUpdated);
      window.removeEventListener('user_logged_in', refreshBranding);
    };
  }, []);

  return (
    <TenantBrandingContext.Provider value={{ branding, isLoading, refreshBranding }}>
      {children}
    </TenantBrandingContext.Provider>
  );
};

export const useTenantBranding = () => useContext(TenantBrandingContext);
