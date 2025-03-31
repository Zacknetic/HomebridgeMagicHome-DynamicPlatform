/**
 * Common constants used throughout the application
 */
export abstract class CommonConstants {

  // Default config values
  static readonly DEFAULT_CONFIG = {
    name: 'homebridge-magichome-dynamic-platform',
    platform: 'homebridge-magichome-dynamic-platform',
    discovery_management: {
      additional_subnets: [] as string[],
      device_discovery_interval: 30000, // 30 seconds default
      device_discovery: true,
      periodic_scan: true,
    },
    device_management: {
      whitelist: [] as string[],
      blacklist: [] as string[],
      purge_all_accessories: false,
    },
  };
  
} 