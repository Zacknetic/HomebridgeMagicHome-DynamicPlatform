import { CharacteristicEventTypes } from 'homebridge';
import { HomebridgeMagichomeDynamicPlatformAccessory } from '../platformAccessory';

/*-------------------------- Characteristics -------------------------------------*/

export function addOnCharacteristic(_this) {
	_this.logs.trace(`[Trace] [${_this.accessory.context.displayName}] - Adding On characteristic to service.`);
	_this.service.getCharacteristic(_this.hap.Characteristic.On)
		.onSet(_this.setOn.bind(_this))
		.onGet(_this.getOn.bind(_this));
}

export function addHueCharacteristic(_this) {
	_this.logs.trace(`[Trace] [${_this.accessory.context.displayName}] - Adding Hue characteristic to service.`);
	_this.service.getCharacteristic(_this.hap.Characteristic.Hue)
		.onSet(_this.setHue.bind(_this))
		.onGet(_this.getHue.bind(_this));
}

export function addSaturationCharacteristic(_this) {
	_this.logs.trace(`[Trace] [${_this.accessory.context.displayName}] - Adding Saturation characteristic to service.`);
	_this.service.getCharacteristic(_this.hap.Characteristic.Saturation)
		.onSet(_this.setSaturation.bind(_this));
	// .onGet(_this.CHANGE_ME.bind(_this));

}

export function addBrightnessCharacteristic(_this) {
	_this.logs.trace(`[Trace] [${_this.accessory.context.displayName}] - Adding Brightness characteristic to service.`);
	_this.service.getCharacteristic(_this.hap.Characteristic.Brightness)
		.onSet(_this.setBrightness.bind(_this))
		.onGet(_this.getBrightness.bind(_this));
}

export function addColorTemperatureCharacteristic(_this) {
	_this.logs.trace(`[Trace] [${_this.accessory.context.displayName}] - Adding Color Temperature characteristic to service.`);
	_this.service.getCharacteristic(_this.hap.Characteristic.ColorTemperature)
		.onSet(_this.setColorTemperature.bind(_this))
		.onGet(_this.getColorTemperature.bind(_this));

	if (_this.api.versionGreaterOrEqual && _this.api.versionGreaterOrEqual('1.3.0-beta.46')) {
		_this.logs.trace(`[Trace] [${_this.accessory.context.displayName}] - Adding Adaptive Lighting service to accessory.`);
		_this.adaptiveLightingService = new _this.api.hap.AdaptiveLightingController(_this.service);
		_this.accessory.configureController(_this.adaptiveLightingService);
	}
}

export function addAccessoryInformationCharacteristic(_this) {

	// const {
	// 	protoDevice: { uniqueId, modelNumber },
	// 	// deviceState: { controllerFirmwareVersion, controllerHardwareVersion },
	// } = _this.accessory.context.cachedDeviceInformation;
	// set accessory information
	_this.accessory.getService(_this.hap.Service.AccessoryInformation)!
		.setCharacteristic(_this.hap.Characteristic.Manufacturer, 'MagicHome')
		// .setCharacteristic(_this.hap.Characteristic.SerialNumber, uniqueId)
		// .setCharacteristic(_this.hap.Characteristic.Model, modelNumber)
		// .setCharacteristic(_this.hap.Characteristic.HardwareRevision, controllerHardwareVersion?.toString(16) ?? 'unknown')
		// .setCharacteristic(_this.hap.Characteristic.FirmwareRevision, controllerFirmwareVersion?.toString(16) ?? 'unknown ')
		.getCharacteristic(_this.hap.Characteristic.Identify)
		.removeAllListeners(CharacteristicEventTypes.SET)
		.removeAllListeners(CharacteristicEventTypes.GET)
		.on(CharacteristicEventTypes.SET, _this.identifyLight.bind(_this));       // SET - bind to the 'Identify` method below


	_this.accessory.getService(_this.hap.Service.AccessoryInformation)!
		.addOptionalCharacteristic(_this.hap.Characteristic.ConfiguredName);
}

export function addConfiguredNameCharacteristic(_this) {
	if (!_this.service.testCharacteristic(_this.hap.Characteristic.ConfiguredName)) {
		_this.service.addCharacteristic(_this.hap.Characteristic.ConfiguredName)
			.onSet(_this.setConfiguredName.bind(_this));
	} else {
		_this.service.getCharacteristic(_this.hap.Characteristic.ConfiguredName)
			.onSet(_this.setConfiguredName.bind(_this));
	}
	_this.logs.trace(`[Trace] [${_this.accessory.context.displayName}] - Adding Configured Name characteristic to service.`);

}


/*
	// Add the garage door service if it doesn't already exist
	this.service =
		this.accessory.getService(this.hapServ.GarageDoorOpener) ||
		this.accessory.addService(this.hapServ.GarageDoorOpener)

	// Add some extra Eve characteristics
	if (!this.service.testCharacteristic(this.eveChar.LastActivation)) {
		this.service.addCharacteristic(this.eveChar.LastActivation)
	}
	if (!this.service.testCharacteristic(this.eveChar.ResetTotal)) {
		this.service.addCharacteristic(this.eveChar.ResetTotal)
	}
	if (!this.service.testCharacteristic(this.eveChar.TimesOpened)) {
		this.service.addCharacteristic(this.eveChar.TimesOpened)
	}

	// Add the set handler to the garage door target state characteristic
	this.service
		.getCharacteristic(this.hapChar.TargetDoorState)
		.onSet(value => this.internalTargetUpdate(value))
	this.cacheTarget = this.service.getCharacteristic(this.hapChar.TargetDoorState).value
	this.cacheCurrent = this.service.getCharacteristic(this.hapChar.CurrentDoorState).value

	// Add the set handler to the garage door reset total characteristic
	this.service.getCharacteristic(this.eveChar.ResetTotal).onSet(value => {
		this.service.updateCharacteristic(this.eveChar.TimesOpened, 0)
	})

	// Update the obstruction detected to false on plugin load
	this.service.updateCharacteristic(this.hapChar.ObstructionDetected, false)

	// Pass the accessory to Fakegato to set up with Eve
	this.accessory.eveService = new platform.eveService('door', this.accessory, {
		log: platform.config.debugFakegato ? this.log : () => {}
	})
	*/