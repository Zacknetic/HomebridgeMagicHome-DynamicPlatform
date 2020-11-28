/* eslint-disable no-console */

import Common from '../dist/accessories/common';
import { ILightState, opMode } from '../dist/magichome-interface/types';

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
      for(let b=0; b<256; b++){
        counter++;
        state.HSL =  { hue: h, saturation: s, luminance: 0 };
        state.brightness = b;
        const copy: ILightState =  deepCopy(state);
        const converted = Common.convertHSBtoRGBWW(copy, {config: {}});
        const restored = Common.convertRGBWWtoHSB(converted, {config: {}});  
        if(state.HSL.hue !== restored.HSL.hue || state.HSL.saturation !== restored.HSL.saturation || state.brightness !== restored.brightness){
          console.log(`Error test ${counter}, h:${h} s:${s} b:${b} state mismatch.`);
          console.log('input: ', state);
          console.log('output: ', restored);
          console.log(`Expected output h:${h} s:${s} b:${b} state mismatch.`);
          return;
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
        const copy: ILightState =  deepCopy(state);
        const converted = Common.convertRGBWWtoHSB(copy, {config: {}});
        const restored = Common.convertHSBtoRGBWW(converted, {config: {}});  
      
        if(state.RGB.red !== restored.RGB.red || state.RGB.blue !== restored.RGB.blue || state.RGB.green !== restored.RGB.green){
          console.log(`Error test ${counter}.`);
          console.log('input: ', state);
          console.log('output: ', restored);
          console.log(`Expected output r:${r} g:${g} b:${b}.`);
          return;
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
      const copy: ILightState =  deepCopy(state);
      const converted = Common.convertRGBWWtoHSB(copy, {config: {}});
      const restored = Common.convertHSBtoRGBWW(converted, {config: {}});  
      
      if(state.whiteValues.coldWhite !== restored.whiteValues.coldWhite || state.whiteValues.warmWhite !== restored.whiteValues.warmWhite){
        console.log(`Error test ${counter}.`);
        console.log('input: ', state);
        console.log('output: ', restored);
        console.log(`Expected output cw:${cw} ww:${ww}.`);
        return;
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