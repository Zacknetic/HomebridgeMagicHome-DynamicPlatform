const convert = require('color-convert');
const { Light } = require('@gordalina/magic-home');
let Service, Characteristic;

function wrap(fn) {
  return async (value, callback, req, id) => {
    if (!id) {
      id = req;
      req = callback;
      callback = value;
      value = undefined;
    }

    try {
      const result = await fn(value);
      callback(null, result);
    } catch (e) {
      callback(e);
    }
  }
}

class LightAccessory {
  constructor(config, homebridge) {
    this.homebridge = homebridge;
    this.config = config;
    this.name = `LED ${config.id}`
    this.brightness = 100;
    this.hsl = [255, 100, 50];
    this.light = new Light(config);
  }

  getServices() {
    const { Service, Characteristic } = this.homebridge.hap;
    const informationService = new Service.AccessoryInformation();

    informationService
      .setCharacteristic(Characteristic.Manufacturer, 'MagicHome')
      .setCharacteristic(Characteristic.Model, this.config.model)
      .setCharacteristic(Characteristic.SerialNumber, this.config.id);

    const lightbulbService = new Service.Lightbulb(this.name);
    lightbulbService
        .getCharacteristic(Characteristic.On)
        .on('get', wrap(this.getPowerState.bind(this)))
        .on('set', wrap(this.setPowerState.bind(this)));

    lightbulbService
        .addCharacteristic(new Characteristic.Hue())
        .on('get', wrap(this.getHue.bind(this)))
        .on('set', wrap(this.setHue.bind(this)));

    lightbulbService
        .addCharacteristic(new Characteristic.Saturation())
        .on('get', wrap(this.getSaturation.bind(this)))
        .on('set', wrap(this.setSaturation.bind(this)));

    lightbulbService
        .addCharacteristic(new Characteristic.Brightness())
        .on('get', wrap(this.getBrightness.bind(this)))
        .on('set', wrap(this.setBrightness.bind(this)));

    return [informationService, lightbulbService];
  }

  async getState() {
    const state = await this.light.state();

    const { red, green, blue } = state.color;
    const [h, s, l] = convert.rgb.hsl(red, green, blue);
    this.hsl = [h, s, l];

    return state;
  }

  async getPowerState() {
    const state = await this.getState();
    return state.on;
  }

  async setPowerState(on) {
    if (on) {
      await this.light.on();
    } else {
      await this.light.off();
    }

  }

  async getRGB() {
    const { color } = await this.getState();
    return color;
  }

  async getHSL() {
    const { red, green, blue } = await this.getRGB();
    const [h, s, l] = convert.rgb.hsl(red, green, blue);
    this.hsl = [h, s, l];

    return [h, s, l];
  }

  async getHue() {
    const [h, s, l] = await this.getHSL();
    return h;
  }

  async setHue(hue) {
    const [h, s, l] = this.hsl;
    const [r, g, b] = convert.hsl.rgb(hue, s, l);
    this.hsl = [hue, s, l];

    await this.light.color(r, g, b);
  }

  async getSaturation() {
    const [h, s, l] = await this.getHSL();
    return s;
  }

  async setSaturation(saturation) {
    const [h, s, l] = this.hsl;
    const [r, g, b] = convert.hsl.rgb(h, saturation, l);
    this.hsl = [h, saturation, l];

    await this.light.color(r, g, b);
  }

  async getBrightness() {
    return this.brightness;
  }

  async setBrightness(brightness) {
    this.brightness = brightness;
    const [h, s, l] = this.hsl;
    const [r, g, b] = convert.hsl.rgb(h, s, l);
    await this.light.brightness(r, g, b, brightness);
  }
}

module.exports = LightAccessory;
