import React, { createContext, useContext, useEffect, useState } from 'react';
import { getPortalData, setAccessToken, type DashboardData, type Patient } from '../api/client';

interface PortalDataValue {
  patients: Patient[];
  dashboard: DashboardData | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  addPatient: (p: Patient) => void;
}

const PortalDataContext = createContext<PortalDataValue | null>(null);

export const PortalDataProvider: React.FC<{ token: string; children: React.ReactNode }> = ({ token, children }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      setAccessToken(token);
      const data = await getPortalData();
      setPatients(data.patients);
      setDashboard(data.dashboard);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load portal data.');
    } finally {
      setLoading(false);
    }
  };

  const addPatient = (p: Patient) => setPatients(prev => [p, ...prev]);

  useEffect(() => { void refresh(); }, [token]);

  return <PortalDataContext.Provider value={{ patients, dashboard, loading, error, refresh, addPatient }}>{children}</PortalDataContext.Provider>;
};

export const usePortalData = () => {
  const context = useContext(PortalDataContext);
  if (!context) throw new Error('usePortalData must be used inside PortalDataProvider');
  return context;
};
