import type { Logger } from 'homebridge';

export class Logs {
  constructor(private logger: Logger, private readonly level = 3) {
    logs = this;
  }

  trace (message, ...parameters: any[]) {
    if (this.level == 5) {
      this.logger.info(message, parameters);
    }
  }

  debug (message, ...parameters: any[]) {
    if (this.level >= 4) {
      this.logger.info(message, parameters);
    }
  }

  info (message, ...parameters: any[]) {
    if (this.level >= 3) {
      this.logger.info(message, parameters);
    }
  }

  warn (message, ...parameters: any[]) {
    if (this.level >= 2) {
      this.logger.warn(message, parameters);
    }
  }

  error (message, ...parameters: any[]) {
    if (this.level >= 1) {
      this.logger.error(message, parameters);
    }
  }
}

let logs: Logs;

export function getLogs() {
  return logs;
}