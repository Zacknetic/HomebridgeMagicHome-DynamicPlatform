import { BaseController, ControllerGenerator, ICustomProtoDevice, IDeviceAPI } from 'magichome-platform';
import { IAccessoryContext, IAccessoryState, MagicHomeAccessory } from './misc/types';
import {
	API,
	HAP,
	PlatformConfig,
} from 'homebridge';

import { _ } from 'lodash';
import { homekitInterface } from './misc/types';
import { Logs } from './logs';

const PLATFORM_NAME = 'homebridge-magichome-dynamic-platform';
const PLUGIN_NAME = 'homebridge-magichome-dynamic-platform';

export class AccessoryGenerator {

	public readonly accessoriesFromDiskMap: Map<string, MagicHomeAccessory> = new Map();
	public readonly activeAccessoriesMap: Map<string, MagicHomeAccessory> = new Map();
	private hap: HAP;
	private api: API;
	private hbLogger;
	private config: PlatformConfig;
	private controllerGenerator: ControllerGenerator;
	private logs: Logs;
	constructor(api, logs, hbLogger, config, accessoriesFromDiskMap, controllerGenerator) {
		this.api = api;
		this.hap = api.hap;
		this.hbLogger = hbLogger;
		this.logs = logs;
		this.config = config;
		this.accessoriesFromDiskMap = accessoriesFromDiskMap;
		this.controllerGenerator = controllerGenerator;
	}

	public async generateAccessories() {
		this.logs.info('Scanning network for MagicHome accessories.');
		return await this.controllerGenerator.discoverControllers().then(async controllers => {
			const accessories = this.discoverAccessories(controllers);

			return accessories;
		}).catch(error => {
			this.logs.error(error);
		});
	}

	/**
	 * 
	 * 1. iterate through scanned controllers
	 * 	a. exist already as a homebridge accessory?
	 * 		i. yes: 
	 * 			1. check if it's allowed, if not, skip+remove
	 * 			2. check it for inconsistencies and fix
	 * 			3. register it with homekit again and reset the "last seen" to 0
	 * 			4. remove it from the diskMap so we later know that it was seen
	 * 		ii. no: 
	 * 			1. check if it's allowed, if not, skip
	 * 			2. create a new accessory Object and new homeKit interface
	 * 			3. register it with homekit and set "last seen" to 0
	 * 2. iterate through all remaining disk devices not yet removed by our scan function
	 * 	a. is it allowed, less than allocated number of restarts ( maybe add this to isAllowed)... if not, skip+remove
	 * 	b. warn user about device
	 * 	c. increment number of times unseen
	 * 	d. register with homekit again
	 * 	e. add new homeKit interface
	 * 
	 * note: need a way to just do a base protodevice scan on concurrent scans because current method creates new objects
	 * 				which is quite wasteful...
	 */

	public async rescanAccessories() {
		this.logs.trace('Re-scanning network for MagicHome accessories.');
		return await this.controllerGenerator.discoverControllers().then(async controllers => {
			await this.reDiscoverAccessories(controllers);
		}).catch(error => {
			this.logs.error(error);
		});
	}

	reDiscoverAccessories(controllers: Map<string, BaseController>) {

		const newAccessoriesList: MagicHomeAccessory[] = [];
		const existingAccessoriesList: MagicHomeAccessory[] = [];
		let accessory;
		for (const [uniqueId, controller] of Object.entries(controllers)) {

			const homebridgeUUID = this.hap.uuid.generate(uniqueId);

			if (this.accessoriesFromDiskMap.has(homebridgeUUID)) {
				const existingAccessory = this.accessoriesFromDiskMap.get(homebridgeUUID);
				accessory = this.processExistingAccessory(controller, existingAccessory);

				this.accessoriesFromDiskMap.delete(homebridgeUUID);

				existingAccessoriesList.push(accessory);
				this.logs.info(`[Info] [${existingAccessory.context.displayName}] - Found previously unreachable existing accessory during a re-scan. Updating...`);

			} else if (!this.activeAccessoriesMap.has(homebridgeUUID)) {
				accessory = this.createNewAccessory(controller, homebridgeUUID);
				newAccessoriesList.push(accessory);				//add it to new accessory list
				this.logs.info(`[Info] [${accessory.context.displayName}] - Found previously unseen accessory during a re-scan. Registering...`);
			}

			this.activeAccessoriesMap.set(homebridgeUUID, accessory);
		}

		this.registerNewAccessories(newAccessoriesList);	//register new accessories from scan
		this.updateExistingAccessories(existingAccessoriesList);
	}

	discoverAccessories(controllers: Map<string, BaseController>) {

		const newAccessoriesList: MagicHomeAccessory[] = [];
		const existingAccessoriesList: MagicHomeAccessory[] = [];
		let accessory;
		for (const [uniqueId, controller] of Object.entries(controllers)) {
			const homebridgeUUID = this.hap.uuid.generate(uniqueId);

			if (this.accessoriesFromDiskMap.has(homebridgeUUID)) {

				const existingAccessory = this.accessoriesFromDiskMap.get(homebridgeUUID);
				accessory = this.processExistingAccessory(controller, existingAccessory);
				this.logs.info(`[Info] [${accessory.context.displayName}] - Found existing accessory. Updating...`);
				this.accessoriesFromDiskMap.delete(homebridgeUUID);
				existingAccessoriesList.push(accessory);
			} else {
				accessory = this.createNewAccessory(controller, homebridgeUUID);
				this.logs.info(`[Info] [${accessory.context.displayName}] - Found new accessory. Registering...`);
				newAccessoriesList.push(accessory);				//add it to new accessory list
			}

			this.activeAccessoriesMap.set(homebridgeUUID, accessory);
		}

		this.accessoriesFromDiskMap.forEach(async (offlineAccessory) => {
			const homebridgeUUID = this.hap.uuid.generate(offlineAccessory.context.cachedDeviceInformation.protoDevice.uniqueId);
			await this.processOfflineAccessory(offlineAccessory);
			existingAccessoriesList.push(offlineAccessory);
			this.activeAccessoriesMap.set(homebridgeUUID, offlineAccessory);
		});

		this.registerNewAccessories(newAccessoriesList);	//register new accessories from scan
		this.updateExistingAccessories(existingAccessoriesList);
	}

	createNewAccessory(controller: BaseController, homebridgeUUID: string): MagicHomeAccessory {

		const cachedDeviceInformation = controller.getCachedDeviceInformation();
		const { protoDevice: { uniqueId }, deviceAPI: { description } } = cachedDeviceInformation;

		if (!this.isAllowed(uniqueId)) {
			return;
		}

		const newAccessory: MagicHomeAccessory = new this.api.platformAccessory(description, homebridgeUUID) as MagicHomeAccessory;
		newAccessory.context = { cachedDeviceInformation, displayName: description as string, restartsSinceSeen: 0 };

		try {
			new homekitInterface[description](this.api, newAccessory, this.config, controller, this.hbLogger);
		} catch (error) {
			this.logs.error('The controllerLogicType does not exist in accessoryType list.');
			this.logs.error(error);
		}
		return newAccessory;
	}

	processExistingAccessory(controller: BaseController, existingAccessory: MagicHomeAccessory) {
		try {


			const cachedDeviceInformation = controller?.getCachedDeviceInformation() ?? existingAccessory.context.cachedDeviceInformation;
			const { protoDevice: { uniqueId }, deviceAPI: { description } } = cachedDeviceInformation;
			if (!this.isAllowed(uniqueId) || !this.isFresh(cachedDeviceInformation, existingAccessory)) {
				return;
			}
			_.merge(existingAccessory.context, { cachedDeviceInformation, restartsSinceSeen: 0 });

			try {
				new homekitInterface[description](this.api, existingAccessory, this.config, controller, this.hbLogger);
			} catch (error) {
				this.logs.error('[processExistingAccessory] [Error]: ', error);
			}
			return existingAccessory;
		} catch (error) {
			this.logs.error(error);
		}
	}

	async processOfflineAccessory(offlineAccessory) {
		offlineAccessory.context.restartsSinceSeen++;
		const { deviceState, protoDevice, deviceAPI, deviceAPI: { description } } = offlineAccessory.context.cachedDeviceInformation;
		this.logs.warn(`[Warning] [${offlineAccessory.context.displayName}] [UID: ${protoDevice.uniqueId}] - Device Unreachable. Registering accessory with cached information.`);
		this.logs.trace(deviceState);
		const controller = await this.controllerGenerator.createCustomControllers({ protoDevice, deviceAPI, deviceState });
		new homekitInterface[description](this.api, offlineAccessory, this.config, controller, this.hbLogger);


	}

	registerNewAccessories(newAccessories: MagicHomeAccessory[]) {
		// link the accessory to your platform
		this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, newAccessories);

	}

	updateExistingAccessories(existingAccessories: MagicHomeAccessory[]) {
		this.api.updatePlatformAccessories(existingAccessories);
	}

	isFresh(cachedInformation, existingAccessory: MagicHomeAccessory): boolean {

		let isFresh = true;
		if (existingAccessory.context.displayName.toString().toLowerCase().includes('delete')) {

			this.unregisterAccessory(existingAccessory,
				`Successfully pruned accessory: ${existingAccessory.context.displayName} 
				due to being marked for deletion\n`);
			isFresh = false;
		}

		// else if (this.config.pruning?.pruneRestarts ?? false) {
		// 	if (existingAccessory.context.restartsSinceSeen >= this.config.pruning.pruneRestarts) {
		// 		this.unregisterAccessory(existingAccessory, `Successfully pruned accessory: ${existingAccessory.context.displayName}
		// 			which had not being seen for ${existingAccessory.context.restartsSinceSeen} restart(s).\n`);
		// 		isFresh = false;
		// 	}
		// }

		return isFresh;
	}

	isAllowed(uniqueId: string): boolean {

		const blacklistedUniqueIDs = this.config.deviceManagement?.blacklistedUniqueIDs ?? [];
		const isWhitelist: boolean = this.config.deviceManagement?.blacklistOrWhitelist?.includes('whitelist') ?? false;
		const onList: boolean = (blacklistedUniqueIDs).includes(uniqueId);

		const isAllowed = isWhitelist ? onList : !onList;

		return isAllowed;
		return true;
	}

	unregisterAccessory(existingAccessory: MagicHomeAccessory, reason: string) {
		this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
		this.hbLogger.warn(reason);
	}

	//    const accessory = new this.api.platformAccessory(deviceQueryData.lightParameters.convenientName, generatedUUID) as MagicHomeAccessory;

}