/* eslint-disable no-console */

import Common from '../dist/accessories/common';
import { ILightState, opMode } from '../dist/magichome-interface/types';

const props = {
  config: {
    'whiteEffects': {
      'simultaniousDevicesColorWhite': true,
      'colorWhiteThreshold': 10,
      'colorWhiteThresholdSimultaniousDevices': 50,
      'colorOffThresholdSimultaniousDevices': 5,
    },
  },
};
const state = {
  isOn: true,
  operatingMode: opMode.redBlueGreenMode,
  HSL: { hue: 127, saturation: 100, luminance: 50 },
  RGB: { red: 0, green: 0, blue: 0 },
  whiteValues: { warmWhite: 0, coldWhite: 0 },
  colorTemperature: null,
  brightness: 100,
};

function tester(){
  console.log('Testing HSB and back');

  let counter = 0;
  for(let h=0; h<256; h++){
    for(let s=0; s<256; s++){
      for(let b=100; b<=100; b++){
        counter++;
        state.HSL =  { hue: h, saturation: s, luminance: 0 };
        state.brightness = b;

        const original: ILightState =  deepCopy(state);
        const transient: ILightState =  deepCopy(state);
        Common.convertHSBtoRGBWW(transient, props);
        Common.convertRGBWWtoHSB(transient, props);  
        

        if(original.HSL.hue !== transient.HSL.hue || original.HSL.saturation !== transient.HSL.saturation || original.brightness !== transient.brightness){
          console.log(`Error test ${counter}, h:${h} s:${s} b:${b} state mismatch.`);
          console.log('input: ', state);
          console.log('output: ', transient);
          console.log(`Expected output h:${h} s:${s} b:${b} state mismatch.`);
          process.exit(0);
        }
          
      }
    }
  }
}


function tester2(){
  console.log('Testing RGB and back');

  let counter = 0;
  for(let r=0; r<256; r++){
    for(let g=0; g<256; g++){
      for(let b=0; b<256; b++){
        counter++;
        state.RGB =  { red:r, green:g, blue:b };

        const original: ILightState =  deepCopy(state);
        const transient: ILightState =  deepCopy(state);
        Common.convertHSBtoRGBWW(transient, props);
        Common.convertRGBWWtoHSB(transient, props);  
      
        if(state.RGB.red !== transient.RGB.red || state.RGB.blue !== transient.RGB.blue || state.RGB.green !== transient.RGB.green){
          console.log(`Error test ${counter}.`);
          console.log('input: ', state);
          console.log('output: ', transient);
          console.log(`Expected output r:${r} g:${g} b:${b}.`);
          process.exit(0);
        }
          
      }
    }
  }
}

function tester3(){
  console.log('Testing CW/WW and back');

  let counter = 0;
  for(let cw=0; cw<256; cw++){
    for(let ww=0; ww<256; ww++){
      counter++;
      state.whiteValues =  { warmWhite:ww, coldWhite:cw };

      const original: ILightState =  deepCopy(state);
      const transient: ILightState =  deepCopy(state);
      Common.convertHSBtoRGBWW(transient, props);
      Common.convertRGBWWtoHSB(transient, props);  
      
      if(state.whiteValues.coldWhite !== transient.whiteValues.coldWhite || state.whiteValues.warmWhite !== transient.whiteValues.warmWhite){
        console.log(`Error test ${counter}.`);
        console.log('input: ', state);
        console.log('output: ', transient);
        console.log(`Expected output cw:${cw} ww:${ww}.`);
        process.exit(0);
      }
          
    }
  }
}

function deepCopy(state:any){
  return JSON.parse(JSON.stringify(state));
}
tester();
tester2();
tester3();