
/**
 * Constants for the string values used in the app
 */
export abstract class AppConstants {

  // config paths
  
  // discovery management
  static readonly DISCOVERY_MANAGEMENT: string = 'discovery_management';
  static readonly ADDITIONAL_SUBNETS: string = 'additional_subnets';
  static readonly DEVICE_DISCOVERY_INTERVAL: string = 'device_discovery_interval';

  // device management
  static readonly DEVICE_MANAGEMENT: string = 'device_management';
  static readonly WHITELIST: string = 'whitelist';
  static readonly BLACKLIST: string = 'blacklist';
  static readonly PERIODIC_SCAN: string = 'periodic_scan';
}
