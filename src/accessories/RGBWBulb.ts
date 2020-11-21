import { clamp, convertHSLtoRGB } from '../magichome-interface/utils';
import { HomebridgeMagichomeDynamicPlatformAccessory } from '../PlatformAccessory';

export class RGBWBulb extends HomebridgeMagichomeDynamicPlatformAccessory {
  public eightByteProtocol = 2;
  async updateDeviceState() {

    //**** local variables ****\\
    const hsl = this.lightState.HSL;
    const [red, green, blue] = convertHSLtoRGB(hsl); //convert HSL to RGB
    const brightness = this.lightState.brightness;
    
    //this.platform.log.debug('Current HSL and Brightness: h:%o s:%o l:%o br:%o', hsl.hue, hsl.saturation, hsl.luminance, brightness);
    //this.platform.log.debug('Converted RGB: r:%o g:%o b:%o', red, green, blue);
    
    let mask = 0xF0; // the 'mask' byte tells the controller which LEDs to turn on color(0xF0), white (0x0F), or both (0xFF)
    //we default the mask to turn on color. Other values can still be set, they just wont turn on
    
    //sanitize our color/white values with Math.round and clamp between 0 and 255, not sure if either is needed
    //next determine brightness by dividing by 100 and multiplying it back in as brightness (0-100)
    let r = Math.round(((clamp(red, 0, 255) / 100) * brightness));
    let g = Math.round(((clamp(green, 0, 255) / 100) * brightness));
    let b = Math.round(((clamp(blue, 0, 255) / 100) * brightness));
    let ww = 0;
    

    //if saturation is below config set threshold or if user asks for warm white / cold white  
    //set all other values besides warmWhite to 0 and set the mask to white (0x0F)

    if ((hsl.saturation < this.colorWhiteThreshold) 
        || (hsl.hue == 31 && hsl.saturation == 33) 
        || (hsl.hue == 208 && hsl.saturation == 17) 
        || (hsl.hue == 0 && hsl.saturation == 0)) {

      r = 0;
      g = 0;
      b = 0;
      ww = Math.round((255 / 100) * brightness);
      mask = 0x0F;
      // this.platform.log.debug('Setting warmWhite only without colors: ww:%o', ww);

    } 
   
    if(this.eightByteProtocol == 0){
      await this.send([0x31, r, g, b, ww, mask, 0x0F]); //8th byte checksum calculated later in send()
    } else if(this.eightByteProtocol == 1){
      await this.send([0x31, r, g, b, ww, 0x00, mask, 0x0F]);
    } else if (this.eightByteProtocol == 2){
      this.eightByteProtocol = (await this.send([0x31, r, g, b, ww, 0x00, mask, 0x0F])) == undefined ? 0 : 1;
      await this.send([0x31, r, g, b, ww, mask, 0x0F]); //8th byte checksum calculated later in send()
    }

  }
  
  async updateHomekitState(){
    this.service.updateCharacteristic(this.platform.Characteristic.On, this.lightState.isOn);
    this.service.updateCharacteristic(this.platform.Characteristic.Hue, this.lightState.HSL.hue);
    this.service.updateCharacteristic(this.platform.Characteristic.Saturation, this.lightState.HSL.saturation);
    if(this.lightState.HSL.luminance > 0 && this.lightState.isOn){
      this.service.updateCharacteristic(this.platform.Characteristic.Brightness, this.lightState.HSL.luminance * 2);
    } else if (this.lightState.isOn){
      this.service.updateCharacteristic(this.platform.Characteristic.Brightness,clamp((this.lightState.whiteValues.warmWhite/2.55), 0, 100));
    }
  }
    
}