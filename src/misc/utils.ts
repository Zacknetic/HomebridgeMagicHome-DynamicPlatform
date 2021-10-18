import { existsSync, readFileSync } from 'fs';
import { IColorCCT, IColorRGB, IDeviceCommand, IDeviceState } from 'magichome-platform/dist/types';
import { IAccessoryCommand, IAccessoryState, IColorHSL } from './types';

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}


//=================================================
// Start checksum //



/**
 * @checksum
 * a checksum is needed at the end of the byte array otherwise the message is rejected by the device
 * add all bytes and chop off the beginning by & with 0xFF
 * @param buffer 
 * @returns checksum number
 */
export function checksum(buffer: Uint8Array) {
  let chk = 0;

  for (const byte of buffer) {
    chk += byte;
  }

  return chk & 0xff;
}

//=================================================
// Start Convert RGBtoHSL //
export function convertRGBtoHSL(RGB: IColorRGB) {
  const { red, green, blue } = RGB;
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  const delta = max - min;
  let h = 0;
  let s = 0;

  if (max === min) {
    h = 0;
  } else if (r === max) {
    h = (g - b) / delta;
  } else if (g === max) {
    h = 2 + (b - r) / delta;
  } else if (b === max) {
    h = 4 + (r - g) / delta;
  }

  h = Math.min(h * 60, 360);

  if (h < 0) {
    h += 360;
  }

  const l = max / 2.55;

  if (max === min) {
    s = 0;
  } else if (l <= 0.5) {
    s = delta / (max + min);
  } else {
    s = delta / (2 - max - min);
  }
  const HSL: IColorHSL = { hue: h, saturation: s * 100, luminance: l * 100 };
  return HSL;
}

//=================================================
// End Convert RGBtoHSL //


//=================================================
// Start Convert HSLtoRGB //
export function convertHSLtoRGB(HSL: IColorHSL): IColorRGB {

  let RGB: IColorRGB;
  const { hue, saturation, luminance } = HSL;
  const h = hue / 360;
  const s = saturation / 100;
  const l = 50 / 100;
  let t2;
  let t3;
  let val;

  if (s === 0) {
    val = l * 255;
    RGB = { red: val, green: val, blue: val };
  }

  if (l < 0.5) {
    t2 = l * (1 + s);
  } else {
    t2 = l + s - l * s;
  }

  const t1 = 2 * l - t2;

  const rgb = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    t3 = h + 1 / 3 * -(i - 1);
    if (t3 < 0) {
      t3++;
    }

    if (t3 > 1) {
      t3--;
    }

    if (6 * t3 < 1) {
      val = t1 + (t2 - t1) * 6 * t3;
    } else if (2 * t3 < 1) {
      val = t2;
    } else if (3 * t3 < 2) {
      val = t1 + (t2 - t1) * (2 / 3 - t3) * 6;
    } else {
      val = t1;
    }

    rgb[i] = val * 255;
  }
  RGB = { red: rgb[0], green: rgb[1], blue: rgb[2] };
  return RGB;
}
//=================================================
// End Convert HSLtoRGB //

export function parseJson<T>(value: string, replacement: T): T {
  try {
    return <T>JSON.parse(value);
  } catch (_error) {
    return replacement;
  }
}

export function loadJson<T>(file: string, replacement: T): T {
  if (!existsSync(file)) {
    return replacement;
  }
  return parseJson<T>(readFileSync(file).toString(), replacement);
}

/**
 ** @calculateWhiteColor
 *  determine warmWhite/coldWhite values from hue
 *  the closer to 0/360 the weaker coldWhite brightness becomes
 *  the closer to 180 the weaker warmWhite brightness becomes
 *  the closer to 90/270 the stronger both warmWhite and coldWhite become simultaniously
 */
export function convertHueToColorCCT(hue: number): IColorCCT {
  let multiplier = 0;
  const colorCCT = { warmWhite: 0, coldWhite: 0 };


  if (hue <= 90) {        //if hue is <= 90, warmWhite value is full and we determine the coldWhite value based on Hue
    colorCCT.warmWhite = 255;
    multiplier = ((hue / 90));
    colorCCT.coldWhite = Math.round((255 * multiplier));
  } else if (hue > 270) { //if hue is >270, warmWhite value is full and we determine the coldWhite value based on Hue
    colorCCT.warmWhite = 255;
    multiplier = (1 - (hue - 270) / 90);
    colorCCT.coldWhite = Math.round((255 * multiplier));
  } else if (hue > 180 && hue <= 270) { //if hue is > 180 and <= 270, coldWhite value is full and we determine the warmWhite value based on Hue
    colorCCT.coldWhite = 255;
    multiplier = ((hue - 180) / 90);
    colorCCT.warmWhite = Math.round((255 * multiplier));
  } else if (hue > 90 && hue <= 180) {//if hue is > 90 and <= 180, coldWhite value is full and we determine the warmWhite value based on Hue
    colorCCT.coldWhite = 255;
    multiplier = (1 - (hue - 90) / 90);
    colorCCT.warmWhite = Math.round((255 * multiplier));
  }

  return colorCCT;
} //hueToWhiteTemperature

export function cctToWhiteTemperature(CCT: number, multiplier = 0): { warmWhite: number, coldWhite: number } {
  CCT -= 140;
  let warmWhite, coldWhite;

  const threshold = 110;
  if (CCT >= threshold) {
    warmWhite = 127;
    multiplier = (1 - ((CCT - threshold) / (360 - threshold)));
    coldWhite = Math.round((127 * multiplier));
  } else {
    coldWhite = 127;
    multiplier = (CCT / threshold);
    warmWhite = Math.round((127 * multiplier));
  }

  return { warmWhite, coldWhite };
}

export function whiteTemperatureToCCT(whiteTemperature: IColorCCT) {
  const { coldWhite } = whiteTemperature;
  const CCT = (coldWhite * 1.41) + 140;

  return CCT;
}

/*
export function delayToSpeed(delay: never) {
  let clamped = clamp(delay, 1, 31);
  clamped -= 1; // bring into interval [0, 30]
  return 100 - (clamped / 30) * 100;
}

export function speedToDelay(speed: never) {
  const clamped = clamp(speed, 0, 100);
  return 30 - (clamped / 100) * 30 + 1;
}
*/
export function convertMiredColorTemperatureToHueSat(temperature: number): [number, number] {
  const xy = convertMiredColorTemperatureToXY(500 - temperature);
  return convertXyToHueSat(xy[0], xy[1]);
}

export function convertXyToHueSat(x: number, y: number): [number, number] {
  // Based on: https://developers.meethue.com/develop/application-design-guidance/color-conversion-formulas-rgb-to-xy-and-back/
  const z: number = 1.0 - x - y;
  const Y = 1.0;
  const X: number = (Y / y) * x;
  const Z: number = (Y / y) * z;

  // sRGB D65 conversion
  let r: number = (X * 1.656492) - (Y * 0.354851) - (Z * 0.255038);
  let g: number = (-X * 0.707196) + (Y * 1.655397) + (Z * 0.036152);
  let b: number = (X * 0.051713) - (Y * 0.121364) + (Z * 1.011530);

  // Remove negative values
  const m = Math.min(r, g, b);
  if (m < 0.0) {
    r -= m;
    g -= m;
    b -= m;
  }

  // Normalize
  if (r > b && r > g && r > 1.0) {
    // red is too big
    g = g / r;
    b = b / r;
    r = 1.0;
  } else if (g > b && g > r && g > 1.0) {
    // green is too big
    r = r / g;
    b = b / g;
    g = 1.0;
  } else if (b > r && b > g && b > 1.0) {
    // blue is too big
    r = r / b;
    g = g / b;
    b = 1.0;
  }

  // Gamma correction
  r = reverseGammaCorrection(r);
  g = reverseGammaCorrection(g);
  b = reverseGammaCorrection(b);

  // Maximize
  const max = Math.max(r, g, b);
  r = (r === max) ? 255 : (255 * (r / max));
  g = (g === max) ? 255 : (255 * (g / max));
  b = (b === max) ? 255 : (255 * (b / max));

  const RGB: IColorRGB = { red: r, green: g, blue: b };
  const HSL = convertRGBtoHSL(RGB);

  const hsv = [HSL.hue, HSL.saturation];

  return [hsv[0], hsv[1]];
}

function convertMiredColorTemperatureToXY(temperature: number): [number, number] {
  // Based on MiredColorTemperatureToXY from:
  // https://github.com/dresden-elektronik/deconz-rest-plugin/blob/78939ac4ee4b0646fbf542a0f6e83ee995f1a875/colorspace.cpp
  const TEMPERATURE_TO_X_TEMPERATURE_THRESHOLD = 4000;

  const TEMPERATURE_TO_Y_FIRST_TEMPERATURE_THRESHOLD = 2222;
  const TEMPERATURE_TO_Y_SECOND_TEMPERATURE_THRESHOLD = 4000;

  const TEMPERATURE_TO_X_FIRST_FACTOR_FIRST_EQUATION = 17440695910400;
  const TEMPERATURE_TO_X_SECOND_FACTOR_FIRST_EQUATION = 15358885888;
  const TEMPERATURE_TO_X_THIRD_FACTOR_FIRST_EQUATION = 57520658;
  const TEMPERATURE_TO_X_FOURTH_FACTOR_FIRST_EQUATION = 11790;

  const TEMPERATURE_TO_X_FIRST_FACTOR_SECOND_EQUATION = 198301902438400;
  const TEMPERATURE_TO_X_SECOND_FACTOR_SECOND_EQUATION = 138086835814;
  const TEMPERATURE_TO_X_THIRD_FACTOR_SECOND_EQUATION = 14590587;
  const TEMPERATURE_TO_X_FOURTH_FACTOR_SECOND_EQUATION = 15754;

  const TEMPERATURE_TO_Y_FIRST_FACTOR_FIRST_EQUATION = 18126;
  const TEMPERATURE_TO_Y_SECOND_FACTOR_FIRST_EQUATION = 22087;
  const TEMPERATURE_TO_Y_THIRD_FACTOR_FIRST_EQUATION = 35808;
  const TEMPERATURE_TO_Y_FOURTH_FACTOR_FIRST_EQUATION = 3312;

  const TEMPERATURE_TO_Y_FIRST_FACTOR_SECOND_EQUATION = 15645;
  const TEMPERATURE_TO_Y_SECOND_FACTOR_SECOND_EQUATION = 22514;
  const TEMPERATURE_TO_Y_THIRD_FACTOR_SECOND_EQUATION = 34265;
  const TEMPERATURE_TO_Y_FOURTH_FACTOR_SECOND_EQUATION = 2744;

  const TEMPERATURE_TO_Y_FIRST_FACTOR_THIRD_EQUATION = 50491;
  const TEMPERATURE_TO_Y_SECOND_FACTOR_THIRD_EQUATION = 96229;
  const TEMPERATURE_TO_Y_THIRD_FACTOR_THIRD_EQUATION = 61458;
  const TEMPERATURE_TO_Y_FOURTH_FACTOR_THIRD_EQUATION = 6062;

  let localX = 0;
  let localY = 0;
  const temp = 1000000 / temperature;

  if (TEMPERATURE_TO_X_TEMPERATURE_THRESHOLD > temp) {
    localX = TEMPERATURE_TO_X_THIRD_FACTOR_FIRST_EQUATION / temp +
      TEMPERATURE_TO_X_FOURTH_FACTOR_FIRST_EQUATION -
      TEMPERATURE_TO_X_SECOND_FACTOR_FIRST_EQUATION / temp / temp -
      TEMPERATURE_TO_X_FIRST_FACTOR_FIRST_EQUATION / temp / temp / temp;
  } else {
    localX = TEMPERATURE_TO_X_SECOND_FACTOR_SECOND_EQUATION / temp / temp +
      TEMPERATURE_TO_X_THIRD_FACTOR_SECOND_EQUATION / temp +
      TEMPERATURE_TO_X_FOURTH_FACTOR_SECOND_EQUATION -
      TEMPERATURE_TO_X_FIRST_FACTOR_SECOND_EQUATION / temp / temp / temp;
  }

  if (TEMPERATURE_TO_Y_FIRST_TEMPERATURE_THRESHOLD > temp) {
    localY = TEMPERATURE_TO_Y_THIRD_FACTOR_FIRST_EQUATION * localX / 65536 -
      TEMPERATURE_TO_Y_FIRST_FACTOR_FIRST_EQUATION * localX * localX * localX / 281474976710656 -
      TEMPERATURE_TO_Y_SECOND_FACTOR_FIRST_EQUATION * localX * localX / 4294967296 -
      TEMPERATURE_TO_Y_FOURTH_FACTOR_FIRST_EQUATION;
  } else if (TEMPERATURE_TO_Y_SECOND_TEMPERATURE_THRESHOLD > temp) {
    localY = TEMPERATURE_TO_Y_THIRD_FACTOR_SECOND_EQUATION * localX / 65536 -
      TEMPERATURE_TO_Y_FIRST_FACTOR_SECOND_EQUATION * localX * localX * localX / 281474976710656 -
      TEMPERATURE_TO_Y_SECOND_FACTOR_SECOND_EQUATION * localX * localX / 4294967296 -
      TEMPERATURE_TO_Y_FOURTH_FACTOR_SECOND_EQUATION;
  } else {
    localY = TEMPERATURE_TO_Y_THIRD_FACTOR_THIRD_EQUATION * localX / 65536 +
      TEMPERATURE_TO_Y_FIRST_FACTOR_THIRD_EQUATION * localX * localX * localX / 281474976710656 -
      TEMPERATURE_TO_Y_SECOND_FACTOR_THIRD_EQUATION * localX * localX / 4294967296 -
      TEMPERATURE_TO_Y_FOURTH_FACTOR_THIRD_EQUATION;
  }

  localY *= 4;

  localX /= 0xFFFF;
  localY /= 0xFFFF;

  return [Math.round(localX * 10000) / 10000, Math.round(localY * 10000) / 10000];
}

function reverseGammaCorrection(v: number): number {
  return (v <= 0.0031308) ? 12.92 * v : (1.0 + 0.055) * Math.pow(v, (1.0 / 2.4)) - 0.055;
}