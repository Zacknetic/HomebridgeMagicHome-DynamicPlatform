import { ILightParameters } from './types';

const lightTypesMap: Map<number, ILightParameters> = new Map([
  [
    0x04,
    {
      controllerType: 'RGBWStrip',
      convenientName: 'RGBW Simultaneous',
      simultaneousCCT: true,
      hasColor: true,
      hasBrightness: true,
    },
  ],
  [
    0x06,
    {
      controllerType: 'RGBWStrip',
      convenientName: 'RGBW Simultaneous',
      simultaneousCCT: true,
      hasColor: true,
      hasBrightness: true,
    },
  ],
  [
    0x07,
    {
      controllerType: 'RGBWBulb',
      convenientName: 'RGBW Non-Simultaneous',
      simultaneousCCT: false,
      hasColor: true,
      hasBrightness: true,
    },
  ],
  [
    0x08,
    {
      controllerType: 'RGBStrip',
      convenientName: 'Simple RGB',
      simultaneousCCT: false,
      hasColor: true,
      hasBrightness: true,
    },
  ],
  [
    0x21,
    {
      controllerType: 'DimmerStrip',
      convenientName: 'Dimmer',
      simultaneousCCT: false,
      hasColor: false,
      hasBrightness: true,
    },
  ],
  [
    0x33,
    {
      controllerType: 'GRBStrip',
      convenientName: 'Simple GRB',
      simultaneousCCT: false,
      hasColor: true,
      hasBrightness: true,
    },
  ],
  [
    0x25,
    {
      controllerType: 'RGBWWStrip',
      convenientName: 'RGBWW Simultaneous',
      simultaneousCCT: true,
      hasColor: true,
      hasBrightness: true,
    },
  ],
  [
    0x35,
    {
      controllerType: 'RGBWWBulb',
      convenientName: 'RGBWW Non-Simultaneous',
      simultaneousCCT: false,
      hasColor: true,
      hasBrightness: true,
    },
  ],
  [
    0x41,
    {
      controllerType: 'DimmerStrip',
      convenientName: 'Dimmer',
      simultaneousCCT: false,
      hasColor: false,
      hasBrightness: true,
    },
  ],
  [
    0x44,
    {
      controllerType: 'RGBWBulb',
      convenientName: 'RGBW Non-Simultaneous',
      simultaneousCCT: false,
      hasColor: true,
      hasBrightness: true,
    },
  ],
  [
    0x65,
    {
      controllerType: 'DimmerStrip',
      convenientName: 'Dimmer',
      simultaneousCCT: false,
      hasColor: false,
      hasBrightness: true,
    },
  ],
  [
    0x97,
    {
      controllerType: 'Switch',
      convenientName: 'Power Socket',
      simultaneousCCT: false,
      hasColor: false,
      hasBrightness: false,
    },
  ],
  [
    0xa1,
    {
      controllerType: 'RGBStrip',
      convenientName: 'Simple RGB',
      simultaneousCCT: false,
      hasColor: true,
      hasBrightness: true,
    },
  ],
  [
    0xa2,
    {
      controllerType: 'RGBStrip',
      convenientName: 'Simple RGB',
      simultaneousCCT: false,
      hasColor: true,
      hasBrightness: true,
    },
  ],
]);

function getPrettyName(uniqueId:string, controllerType:string | null):string{
  const uniqueIdTruc = uniqueId.slice(-6);
  let deviceType = 'LED';
  if(controllerType){
    if( isType(controllerType, 'bulb') ) {
      deviceType = 'Bulb';
    } else if( isType(controllerType, 'strip') ){
      deviceType = 'Strip';
    }else if( isType(controllerType, 'switch') ){
      deviceType = 'Switch';
    }
  }
  return `${deviceType} ${uniqueIdTruc}`;
}

function isType(a,b){
  return a.toLowerCase().indexOf(b) > -1;
}

export { lightTypesMap, getPrettyName };