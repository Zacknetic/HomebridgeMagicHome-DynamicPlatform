import type { Logger } from 'homebridge';
import { MagicHomeAccessory } from './magichome-interface/types';

export class Logs {
  constructor(private logger: Logger, private readonly level = 3) {
    logs = this;
  }

  trace (message, ...parameters: any[]) {
    if (this.level == 5) {
      this.logger.info(message, ...parameters);
    }
  }

  debug (message, ...parameters: any[]) {
    if (this.level >= 4) {
      this.logger.info(message, ...parameters);
    }
  }

  info (message, ...parameters: any[]) {
    if (this.level >= 3) {
      this.logger.info(message, ...parameters);
    }
  }

  warn (message, ...parameters: any[]) {
    if (this.level >= 2) { 
      this.logger.warn(message, ...parameters);
    }
  }

  error (message, ...parameters: any[]) {
    if (this.level >= 1) {
      this.logger.error(message, ...parameters);
    }
    
  }

  printDeviceInfo(message: string, accessory: MagicHomeAccessory, count: number){
    this.info('%o - %o \nDisplay Name: %o \nController Logic Type: %o  \nModel: %o \nUnique ID: %o \nIP-Address: %o \nHardware Version: %o \nFirmware Version: %o \n',  
      count,
      message,
      accessory.context.device.displayName,
    accessory.context.device.lightParameters?.controllerLogicType,
    accessory.context.device.modelNumber, 
    accessory.context.device.uniqueId, 
    accessory.context.device.ipAddress,
    accessory.context.device.controllerHardwareVersion?.toString(16),
    accessory.context.device.controllerFirmwareVersion?.toString(16));
  }
  
}

let logs: Logs;

export function getLogs() {
  return logs;
}