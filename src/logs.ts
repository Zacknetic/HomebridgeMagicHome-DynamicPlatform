import { Logging } from 'homebridge';
import  logger  from 'node-color-log';

export class Logs {
  constructor(private logging: Logging, private readonly level = 3) {
    logs = this;
    this.level = level;
  }

  trace(message, ...parameters: any[]) {
    if (this.level >= 5) {
      this.logging.info(message, ...parameters);
    }
  }

  debug(message, ...parameters: any[]) {
    if (this.level >= 4) {
      this.logging.info(message, ...parameters);
    }
  }

  info(message, ...parameters: any[]) {
    if (this.level >= 3) {
      this.logging.info(message, ...parameters);
    }
  }

  warn(message, ...parameters: any[]) {
    if (this.level >= 2) {
      logger.bgColor('yellow').color('black').log('[Warning] ').joint().color('yellow').log(message, ...parameters);
      // this.logging.warn(message, ...parameters);
    }
  }

  error(message, ...parameters: any[]) {
    if (this.level >= 1) {
      this.logging.error(message, ...parameters);
    }
  }
}

let logs: Logs;

export function getLogs() {
  return logs;
}