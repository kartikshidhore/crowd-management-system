export interface Zone {
  zoneId: string;
  name: string;
  securityLevel: 'high' | 'medium' | 'low';
}

export interface Site {
  siteId: string;
  name: string;
  city: string;
  country: string;
  timezone: string;
  zones: Zone[];
}
