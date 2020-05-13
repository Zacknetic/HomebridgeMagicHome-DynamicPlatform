const LightAccessory = require('./LightAccessory');
const { Light } = require('@gordalina/magic-home');

module.exports = (homebridge) => {

  class Platform {
    constructor(log, config) {
      this.log = log;
      this.config = config;
    }

    async accessories(cb) {
      try {
        const lights = await this.getAccessories();
        cb(lights);
      } catch (e) {
        console.error(e);
        cb([]);
      }
    }

    async getAccessories() {
      const devices = await Light.scan();
      return devices.map(device => new LightAccessory(device, homebridge));
    }
  }

  return Platform;
}
