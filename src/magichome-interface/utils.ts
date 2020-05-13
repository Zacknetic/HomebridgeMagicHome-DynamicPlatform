/* eslint no-bitwise: off, no-restricted-syntax: off */
export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function delayToSpeed(delay: any) {
  let clamped = clamp(delay, 1, 31);
  clamped -= 1; // bring into interval [0, 30]
  return 100 - (clamped / 30) * 100;
}

export function speedToDelay(speed: any) {
  const clamped = clamp(speed, 0, 100);
  return 30 - (clamped / 100) * 30 + 1;
}

export function checksum(buffer: Uint8Array) {
  let chk = 0;

  for (const byte of buffer) {
    chk += byte;
  }

  return chk & 0xff;
}
