import type { Logger } from 'homebridge';

export class MHLogger {
	private static instance: MHLogger;
	constructor(private logger: Logger, private readonly level = 3) {
		if (MHLogger.instance) {
			return MHLogger.instance;
		}

		this.level = level;
		MHLogger.instance = this;
	}

	static trace(message, ...parameters: string[] | number[] | boolean [] | object[]) {
		if (MHLogger.instance?.level >= 5) {
			MHLogger.instance.logger.info('[Trace]', message, ...parameters);
		}
	}

	static debug(message, ...parameters: string[] | number[] | boolean [] | object[]) {
		if (MHLogger.instance?.level >= 4) {
			MHLogger.instance.logger.info('[Debug]', message, ...parameters);
		}
	}

	static info(message, ...parameters: string[] | number[] | boolean [] | object[]) {
		if (MHLogger.instance?.level >= 3) {
			MHLogger.instance.logger.info('[Info]', message, ...parameters);
		}
	}

	static warn(message, ...parameters: string[] | number[] | boolean [] | object[]) {
		if (MHLogger.instance?.level >= 2) {
			MHLogger.instance.logger.warn('[Warning]', message, ...parameters);
		}
	}

	static error(message, ...parameters: string[] | number[] | boolean [] | object[]) {
		if (MHLogger.instance?.level >= 1) {
			MHLogger.instance.logger.error('[Error]', message, ...parameters);
		}
	}
}