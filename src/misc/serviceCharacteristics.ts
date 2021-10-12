import { CharacteristicEventTypes } from 'homebridge';
import { HomebridgeMagichomeDynamicPlatformAccessory } from '../platformAccessory';

/*-------------------------- Characteristics -------------------------------------*/

export function addOnCharacteristic(_this) {
	_this.logs.trace('Adding On characteristic to service.');
	_this.service.getCharacteristic(_this.hap.Characteristic.On)
		.removeAllListeners(CharacteristicEventTypes.SET)
		.removeAllListeners(CharacteristicEventTypes.GET)
		.on(CharacteristicEventTypes.SET, _this.setOn.bind(_this))              // SET - bind to the `setOn` method below
		.on(CharacteristicEventTypes.GET, _this.getOn.bind(_this));               // GET - bind to the `getOn` method below
}

export function addBrightnessCharacteristic(_this) {
	_this.logs.trace('Adding Hue characteristic to service.');
	_this.service.getCharacteristic(_this.hap.Characteristic.Brightness)
		.removeAllListeners(CharacteristicEventTypes.SET)
		.removeAllListeners(CharacteristicEventTypes.GET)
		.on(CharacteristicEventTypes.SET, _this.setBrightness.bind(_this))        // SET - bind to the 'setBrightness` method below
		.on(CharacteristicEventTypes.GET, _this.getBrightness.bind(_this));       // GET - bind to the 'getBrightness` method below
}

export function addHueCharacteristic(_this) {
	_this.logs.trace('Adding Hue characteristic to service.');
	_this.service.getCharacteristic(_this.hap.Characteristic.Hue)
		.removeAllListeners(CharacteristicEventTypes.SET)
		.removeAllListeners(CharacteristicEventTypes.GET)
		.on(CharacteristicEventTypes.SET, _this.setHue.bind(_this))               // SET - bind to the 'setHue` method below
		.on(CharacteristicEventTypes.GET, _this.getHue.bind(_this));              // GET - bind to the 'getHue` method below
}

export function addSaturationCharacteristic(_this) {
	_this.logs.trace('Adding Saturation characteristic to service.');
	_this.saturationCharacteristic = _this.service.getCharacteristic(_this.hap.Characteristic.Saturation)
		.removeAllListeners(CharacteristicEventTypes.SET)
		.removeAllListeners(CharacteristicEventTypes.GET)
		.on(CharacteristicEventTypes.SET, _this.setSaturation.bind(_this));        // SET - bind to the 'setSaturation` method below
	//.on(CharacteristicEventTypes.GET, _this.getSaturation.bind(_this));       // GET - bind to the 'getSaturation` method below

}

export function addColorTemperatureCharacteristic(_this) {
	_this.logs.trace('Adding ColorTemperature characteristic to service.');
	_this.service.getCharacteristic(_this.hap.Characteristic.ColorTemperature)
		.removeAllListeners(CharacteristicEventTypes.SET)
		.removeAllListeners(CharacteristicEventTypes.GET)
		.on(CharacteristicEventTypes.SET, _this.setColorTemperature.bind(_this))        // SET - bind to the 'setSaturation` method below
		.on(CharacteristicEventTypes.GET, _this.getColorTemperature.bind(_this));       // GET - bind to the 'getSaturation` method below

	if (_this.api.versionGreaterOrEqual && _this.api.versionGreaterOrEqual('1.3.0-beta.46')) {
		_this.logs.trace('Adding the adaptive lighting service to the accessory...');
		_this.adaptiveLightingService = new _this.api.hap.AdaptiveLightingController(_this.service);
		_this.accessory.configureController(_this.adaptiveLightingService);
	}
}

export function addAccessoryInformationCharacteristic(_this) {

	const {
		protoDevice: { uniqueId, modelNumber },
		deviceState: { controllerFirmwareVersion, controllerHardwareVersion },
	} = _this.controller.getCachedDeviceInformation();

	// set accessory information
	_this.accessory.getService(_this.hap.Service.AccessoryInformation)!
		.setCharacteristic(_this.hap.Characteristic.Manufacturer, 'MagicHome')
		.setCharacteristic(_this.hap.Characteristic.SerialNumber, uniqueId)
		.setCharacteristic(_this.hap.Characteristic.Model, modelNumber)
		.setCharacteristic(_this.hap.Characteristic.HardwareRevision, controllerHardwareVersion.toString(16))
		.setCharacteristic(_this.hap.Characteristic.FirmwareRevision, controllerFirmwareVersion.toString(16))
		.getCharacteristic(_this.hap.Characteristic.Identify)
		.removeAllListeners(CharacteristicEventTypes.SET)
		.removeAllListeners(CharacteristicEventTypes.GET)
		.on(CharacteristicEventTypes.SET, _this.identifyLight.bind(_this));       // SET - bind to the 'Identify` method below


	_this.accessory.getService(_this.hap.Service.AccessoryInformation)!
		.addOptionalCharacteristic(_this.hap.Characteristic.ConfiguredName);
}

export function addConfiguredNameCharacteristic(_this) {
	_this.service.getCharacteristic(_this.hap.Characteristic.ConfiguredName)
		.removeAllListeners(CharacteristicEventTypes.SET)
		.removeAllListeners(CharacteristicEventTypes.GET)
		.on(CharacteristicEventTypes.SET, _this.setConfiguredName.bind(_this));
}