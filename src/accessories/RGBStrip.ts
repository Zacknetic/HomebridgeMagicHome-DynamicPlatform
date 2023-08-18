// import { clamp } from '../misc/utils';
// import { HomebridgeMagichomeDynamicPlatformAccessory } from '../platformAccessory';

// export class RGBStrip extends HomebridgeMagichomeDynamicPlatformAccessory {
//   // public eightByteProtocol = 2;
//   // async updateDeviceState() {

//   //   //**** local variables ****\\
//   //   const hsl = this.lightState.HSL;
//   //   const [red, green, blue] = convertHSLtoRGB(hsl); //convert HSL to RGB
//   //   const brightness = this.lightState.brightness;
    
//   //   //this.platform.log.debug('Current HSL and Brightness: h:%o s:%o l:%o br:%o', hsl.hue, hsl.saturation, hsl.luminance, brightness);
//   //   //this.platform.log.debug('Converted RGB: r:%o g:%o b:%o', red, green, blue);
    
//   //   const mask = 0xF0; // the 'mask' byte tells the controller which LEDs to turn on color(0xF0), white (0x0F), or both (0xFF)
//   //   //we default the mask to turn on color. Other values can still be set, they just wont turn on
    
//   //   //sanitize our color/white values with Math.round and clamp between 0 and 255, not sure if either is needed
//   //   //next determine brightness by dividing by 100 and multiplying it back in as brightness (0-100)
//   //   const r = Math.round(((clamp(red, 0, 255) / 100) * brightness));
//   //   const g = Math.round(((clamp(green, 0, 255) / 100) * brightness));
//   //   const b = Math.round(((clamp(blue, 0, 255) / 100) * brightness));

//   //   if(this.eightByteProtocol == 0){
//   //     //await this.send([0x31, r, g, b, 0x00, mask, 0x0F]); //8th byte checksum calculated later in send()
//   //   } else if(this.eightByteProtocol == 1){
//   //    // await this.send([0x31, r, g, b, 0x00, 0x00, mask, 0x0F]);
//   //   } else if (this.eightByteProtocol == 2){
//   //     //this.eightByteProtocol = (await this.send([0x31, r, g, b, 0x00, 0x00, mask, 0x0F])) == undefined ? 0 : 1;
//   //     //await this.send([0x31, r, g, b, 0x00, mask, 0x0F]); //8th byte checksum calculated later in send()
//   //   }
//   // }//setColor  
// }