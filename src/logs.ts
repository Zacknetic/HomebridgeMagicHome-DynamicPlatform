import { Logging } from 'homebridge';

export class Logs {
  constructor(private hbLogger: Logging, private readonly level = 3) {
    // logs = this;
    this.level = level;
  }

  trace(message, ...parameters: any[]) {
    if (this.level >= 5) {
      this.hbLogger.info('[Trace]', message, ...parameters);
    }
  }

  debug(message, ...parameters: any[]) {
    if (this.level >= 4) {
      this.hbLogger.info('[Debug]', message, ...parameters);
    }
  }

  info(message, ...parameters: any[]) {
    if (this.level >= 3) {
      this.hbLogger.info('[Info]', message, ...parameters);
    }
  }

  warn(message, ...parameters: any[]) {
    if (this.level >= 2) {
      this.hbLogger.warn('[Warning]', message, ...parameters);
    }
  }

  error(message, ...parameters: any[]) {
    if (this.level >= 1) {
      this.hbLogger.error('[Error]', message, ...parameters);
    }
  }
}

let logs: Logs;

export function getLogs() {
  return logs;
}

