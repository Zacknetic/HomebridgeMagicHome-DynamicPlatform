import { ILightParameters } from './types';

const lightTypesMap: Map<number, ILightParameters> = new Map([
  [
    0x04,
    {
      controllerLogicType: 'RGBWStrip',
      convenientName: 'RGBW Simultaneous',
      simultaneousCCT: true,
      hasColor: true,
      hasBrightness: true,
    },
  ],
  [
    0x06,
    {
      controllerLogicType: 'RGBWStrip',
      convenientName: 'RGBW Simultaneous',
      simultaneousCCT: true,
      hasColor: true,
      hasBrightness: true,
    },
  ],
  [
    0x07,
    {
      controllerLogicType: 'RGBWWStrip',
      convenientName: 'RGBWW Simultaneous',
      simultaneousCCT: true,
      hasColor: true,
      hasBrightness: true,
    },
  ],
  [
    0x21,
    {
      controllerLogicType: 'DimmerStrip',
      convenientName: 'Dimmer',
      simultaneousCCT: false,
      hasColor: false,
      hasBrightness: true,
    },
  ],
  [
    0x25,
    {
      controllerLogicType: 'RGBWWStrip',
      convenientName: 'RGBWW Simultaneous',
      simultaneousCCT: true,
      hasColor: true,
      hasBrightness: true,
    },
  ],
  [
    0x33,
    {
      controllerLogicType: 'GRBStrip',
      convenientName: 'GRB Strip',
      simultaneousCCT: false,
      hasColor: true,
      hasBrightness: true,
    },
  ],
  [
    0x35,
    {
      controllerLogicType: 'RGBWWBulb',
      convenientName: 'RGBWW Non-Simultaneous',
      simultaneousCCT: false,
      hasColor: true,
      hasBrightness: true,
    },
  ],
  [
    0x41,
    {
      controllerLogicType: 'DimmerStrip',
      convenientName: 'Dimmer',
      simultaneousCCT: false,
      hasColor: false,
      hasBrightness: true,
    },
  ],
  [
    0x44,
    {
      controllerLogicType: 'RGBWBulb',
      convenientName: 'RGBW Non-Simultaneous',
      simultaneousCCT: false,
      hasColor: true,
      hasBrightness: true,
    },
  ],
  [
    0x52,
    {
      controllerLogicType: 'RGBWWBulb',
      convenientName: 'RGBWW Non-Simultaneous',
      simultaneousCCT: false,
      hasColor: true,
      hasBrightness: true,
    },
  ],
  [
    0x65,
    {
      controllerLogicType: 'DimmerStrip',
      convenientName: 'Dimmer',
      simultaneousCCT: false,
      hasColor: false,
      hasBrightness: true,
    },
  ],
  [
    0x97,
    {
      controllerLogicType: 'Switch',
      convenientName: 'Power Socket',
      simultaneousCCT: false,
      hasColor: false,
      hasBrightness: false,
    },
  ],
  [
    0xa1,
    {
      controllerLogicType: 'RGBStrip',
      convenientName: 'RGB Strip',
      simultaneousCCT: false,
      hasColor: true,
      hasBrightness: true,
    },
  ],
  [
    0xa2,
    {
      controllerLogicType: 'RGBStrip',
      convenientName: 'RGB Strip',
      simultaneousCCT: false,
      hasColor: true,
      hasBrightness: true,
    },
  ],
]);

function getPrettyName(uniqueId:string, controllerLogicType:string | null):string{
  const uniqueIdTruc = uniqueId.slice(-6);
  let deviceType = 'LED';
  if(controllerLogicType){
    if( isType(controllerLogicType, 'bulb') ) {
      deviceType = 'Bulb';
    } else if( isType(controllerLogicType, 'strip') ){
      deviceType = 'Strip';
    }else if( isType(controllerLogicType, 'switch') ){
      deviceType = 'Switch';
    }
  }
  return `${deviceType} ${uniqueIdTruc}`;
}

function isType(a,b){
  return a.toLowerCase().indexOf(b) > -1;
}

export { lightTypesMap, getPrettyName };