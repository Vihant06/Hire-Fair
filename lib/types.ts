export interface BiasAuditRequest {
  jobDescription: string;
  resume?: string;
  protectedAttributes?: string[];
}

export interface BiasFinding {
  category: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  example?: string;
  mitigation: string;
}

export interface BiasAuditResponse {
  overallScore: number;
  findings: BiasFinding[];
  rewrittenJobDescription?: string;
  mitigatedResume?: string;
  metrics: {
    genderCodedWords: number;
    nameProxyRisk: number;
    educationProxyRisk: number;
    ageProxyRisk: number;
  };
  compliance: {
    nycLL144Ready: boolean;
    eeocRisk: 'high' | 'medium' | 'low';
  };
}