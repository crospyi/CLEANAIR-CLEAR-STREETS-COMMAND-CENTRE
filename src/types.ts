export type IndianCategoryType = 'Trash' | 'Leaf' | 'Factory' | 'Smoke' | 'Dust' | 'Vehicular';

export interface CitizenReport {
  id: string;
  userId: string;
  senderName: string;
  category: IndianCategoryType;
  description: string;
  imageUrl: string;
  aqi: number;
  state: string;
  city: string;
  verified: boolean;
  createdAt: string; // ISO Timestamp string
  status?: 'Pending' | 'Dispatched' | 'Resolved'; // For workflow tracking
  dispatchLogs?: string[];
  lat?: number;
  lon?: number;
}

export interface CommunityMessage {
  id: string;
  senderName: string;
  senderId?: string;
  avatar: string; // Emoji
  text: string;
  state?: string;
  city?: string;
  timestamp: string;
  createdAt: number;
  isUser?: boolean;
}

export interface UserProfile {
  uid: string;
  name?: string;
  points?: number;
  email?: string;
}

export interface AntiSmogVehicle {
  id: string;
  name: string;
  type: 'Water-Mist Truck' | 'Road Sweeper' | 'Anti-Smog Gun';
  lat: number;
  lon: number;
  status: 'Idle' | 'Dispatched' | 'Active';
  currentTask?: string;
}
