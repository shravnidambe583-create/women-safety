export interface Message {
  id: string;
  sender: 'user' | 'guardian';
  text: string;
  timestamp: string;
}

export interface EmergencyContact {
  name: string;
  phone: string;
  email: string;
  relationship: string;
}

export interface UserSafetyProfile {
  name: string;
  pin: string;
  medicalNotes: string;
  contacts: EmergencyContact[];
  setupCompleted: boolean;
}

export interface SafetyCheckInSession {
  checkInId: string;
  description: string;
  durationMinutes: number;
  triggerTime: string;
  expireTime: string;
  status: 'pending' | 'completed' | 'expired';
}

export interface SimulatedAlertLog {
  alertId: string;
  userId: string;
  userName: string;
  latitude: number;
  longitude: number;
  status: 'active' | 'resolved';
  threatLevel: 'Low' | 'Elevated' | 'High' | 'Critical';
  createdAt: string;
  audioLogged?: boolean;
}

export interface ThreatAssessment {
  assessmentId: string;
  userId: string;
  description: string;
  location?: { latitude: number; longitude: number };
  riskLevel: number;
  severityText: string;
  tactics: string[];
  decoyResponse: string;
  emergencyRecommended: boolean;
  createdAt: string;
}
