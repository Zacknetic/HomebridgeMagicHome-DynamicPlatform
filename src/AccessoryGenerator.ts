import { BaseController, ControllerGenerator } from 'magichome-platform';
import { IAccessoryState, MagicHomeAccessory } from './magichome-interface/types';
import {
	API,
	HAP,
	PlatformConfig,
} from 'homebridge';

import { homekitInterface } from './magichome-interface/types';
import { config } from 'process';
import { convertRGBtoHSL } from './magichome-interface/utils';

const PLATFORM_NAME = 'homebridge-magichome-dynamic-platform';
const PLUGIN_NAME = 'homebridge-magichome-dynamic-platform';

export class AccessoryGenerator {

	public readonly accessoriesFromDiskMap: Map<string, MagicHomeAccessory> = new Map();

	private hap: HAP;
	private api: API;
	private log;
	private config: PlatformConfig;
	private controllerGenerator: ControllerGenerator;

	constructor(hap, api, log, config, accessoriesFromDiskMap, controllerGenerator) {
		this.hap = hap;
		this.api = api;
		this.log = log;
		this.config = config;
		this.accessoriesFromDiskMap = accessoriesFromDiskMap;
		this.controllerGenerator = controllerGenerator;
	}

	public async generateAccessories() {
		this.log.warn('started to generate accessories');
		return await this.controllerGenerator.discoverControllers().then(async controllers => {
			return this.discoverAccessories(controllers);
		}).catch(error => {
			this.log.error(error);
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

	rescanAccessories(controllers: Map<string, BaseController>) {

		//
	}

	discoverAccessories(controllers: Map<string, BaseController>) {

		const newAccessoriesList: MagicHomeAccessory[] = [];
		const existingAccessoriesList: MagicHomeAccessory[] = [];

		for (const [uniqueId, controller] of Object.entries(controllers)) {
			// this.log.warn(controller);

			const homebridgeUUID = this.hap.uuid.generate(uniqueId);

			if (this.accessoriesFromDiskMap[homebridgeUUID]) {

				const existingAccessory = this.accessoriesFromDiskMap[homebridgeUUID];
				const processedAccessory = this.processExistingAccessory(controller, existingAccessory);

				this.accessoriesFromDiskMap.delete[homebridgeUUID];

				existingAccessoriesList.push(processedAccessory);
				this.log.warn('registering existing accessory');

				//this.log.printDeviceInfo('Registering existing accessory...!', processedAccessory);

			} else {
				const newAccessory = this.createNewAccessory(controller, homebridgeUUID);
				newAccessoriesList.push(newAccessory);				//add it to new accessory list
				//this.log.printDeviceInfo('Registering new accessory...!', newAccessory);
				this.log.warn('registering new accessory');

			}

		}

		this.registerNewAccessories(newAccessoriesList);	//register new accessories from scan
		this.registerExistingAccessories(existingAccessoriesList);
	}

	createNewAccessory(controller: BaseController, homebridgeUUID: string): MagicHomeAccessory {

		const {
			protoDevice: { uniqueId },
			deviceAPI: { description },
			deviceState: {LED: { RGB, CCT, isOn}},
		} = controller.getCachedDeviceInformation();

		if (!this.isAllowed(uniqueId)) {
			return;
		}

		// //convert RGB to HSL
		// //convert CCT to colorTemperature
		// const HSL = convertRGBtoHSL(RGB)
		// const 
		// const accessoryState: IAccessoryState = {isOn, }			JUST KIDDING, DO IT AFTER INITIALIZING DEVICE

		const newAccessory: MagicHomeAccessory = new this.api.platformAccessory(description, homebridgeUUID) as MagicHomeAccessory;
		newAccessory.context = { displayName: description as string, restartsSinceSeen: 0 };

		try {
			new homekitInterface[description](this.hap, this.api, newAccessory, this.config, controller);
		} catch (error) {
			this.log.error('The controllerLogicType does not exist in accessoryType list.');
			this.log.error(error);
		}
		return newAccessory;
	}

	processExistingAccessory(controller: BaseController, existingAccessory: MagicHomeAccessory) {
		const cachedInformation = controller.getCachedDeviceInformation();
		const {
			protoDevice: { uniqueId, ipAddress, modelNumber },
			deviceState, deviceAPI: { description },
		} = cachedInformation;

		if (!this.isAllowed(uniqueId) || !this.isFresh(cachedInformation, existingAccessory)) {
			return;
		}

		this.log.info(existingAccessory.context.displayName);

		//existingAccessory.context.cachedInformation = cachedInformation; SAME HERE
		try {
			new homekitInterface[description](this.hap, this.api, existingAccessory, this.config, controller);
		} catch (error) {
			this.log.error('The controllerLogicType does not exist in accessoryType list.');
			this.log.error(error);
		}
		return existingAccessory;

	}

	registerNewAccessories(newAccessories: MagicHomeAccessory[]) {
		// link the accessory to your platform
		this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, newAccessories);

	}

	registerExistingAccessories(existingAccessories: MagicHomeAccessory[]) {
		this.api.updatePlatformAccessories(existingAccessories);
	}

	isFresh(cachedInformation, existingAccessory: MagicHomeAccessory): boolean {


		let isFresh = true;
		const {
			protoDevice: { uniqueId, ipAddress, modelNumber },
			deviceState, deviceAPI: { description },
		} = cachedInformation;

		if (existingAccessory.context.displayName.toString().toLowerCase().includes('delete')) {

			this.unregisterAccessory(existingAccessory,
				`Successfully pruned accessory: ${existingAccessory.context.displayName} 
				due to being marked for deletion\n`);
			isFresh = false;
		} else if (this.config.pruning.pruneRestarts) {
			if (existingAccessory.context.restartsSinceSeen >= this.config.pruning.pruneRestarts) {
				this.unregisterAccessory(existingAccessory, `Successfully pruned accessory: ${existingAccessory.context.displayName}
					which had not being seen for ${existingAccessory.context.restartsSinceSeen} restart(s).\n`);
				isFresh = false;
			}
		}

		return isFresh;
	}

	isAllowed(uniqueId: string): boolean {

		const blacklistedUniqueIDs = this.config.deviceManagement.blacklistedUniqueIDs;
		const isWhitelist: boolean = this.config.deviceManagement.blacklistOrWhitelist.includes('whitelist');
		const onList: boolean = (blacklistedUniqueIDs).includes(uniqueId);

		const isAllowed = isWhitelist ? onList : !onList;

		return isAllowed;
	}

	unregisterAccessory(existingAccessory: MagicHomeAccessory, reason: string) {
		this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
		this.log.warn(reason);
	}

	//    const accessory = new this.api.platformAccessory(deviceQueryData.lightParameters.convenientName, generatedUUID) as MagicHomeAccessory;

}