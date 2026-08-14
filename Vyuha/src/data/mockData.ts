/** Shared portal record shape. Runtime patient values come from the API. */
export interface Patient {
  id: string;
  abhaId: string;
  name: string;
  age: number | null;
  gender: string;
  ward: string;
  consultant: string;
  admissionDate: string;
  admissionTime: string;
  riskScore: number;
  riskLevel: 'high' | 'medium' | 'low';
  riskTrend: number;
  status: string;
  vitals: { temperature: string; heartRate: string; bloodPressure: string; spo2: string };
  biomarkers: { wbc: string; crp: string; procalcitonin: string };
  riskFactors: Array<{ label: string; impact: number; bar: number }>;
  amrHistory: Array<{
    date: string; hospital: string; event: string; detail: string; type: string;
    hasResistance: boolean; organism?: string; resistance?: string[];
  }>;
  antibioticTimeline: Array<{ month: string; drug: string; duration: string; hospital: string }>;
  cultures: Array<{
    date: string; site: string; organism: string; hospital: string;
    sensitivities: Array<{ drug: string; result: string }>;
  }>;
  monitoringTimeline: Array<{ time: string; event: string; risk: number; detail: string }>;
  cultureOutcome: null | {
    predicted: number; predictedLevel: string; actual: string;
    organism: string; resistance: string; aligned: boolean;
  };
  hospitalEncounters: Array<{
    date: string; hospital: string; admission: string; duration: string; antibiotics: string;
  }>;
  previousAssessments: Array<{
    date: string; hospital: string; risk: number; level: string; model: string;
  }>;
  sourceClinicalData?: Record<string, unknown>;
}
