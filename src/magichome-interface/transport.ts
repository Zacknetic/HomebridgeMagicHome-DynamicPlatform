import net from 'net';
import Queue from 'promise-queue';
import { checksum } from './utils';
import type { Service, PlatformConfig, PlatformAccessory, CharacteristicValue, 
  CharacteristicSetCallback, CharacteristicGetCallback} from 'homebridge';

const COMMAND_QUERY_STATE: Uint8Array = Uint8Array.from([0x81, 0x8a, 0x8b]);

const PORT = 5577;

function wait(emitter: any, eventName: any, timeout: any) {
  return new Promise((resolve, reject) => {
    let off: any = setTimeout(() => {
      clearTimeout(off);
      const buffer = Buffer.from([0x81, 0x35, 0x24, 0x61, 0x01, 0x01,0x00 ,0x00 ,0x00, 0xff, 0x05, 0x58, 0x0f, 0xa8]);
      resolve(buffer);
    }, timeout);
    const eventHandler = (...args: any) => {
      off();
      resolve(...args);
    };
    const errorHandler = (e: any) => {
      off();
      reject(e);
    };  

    off = () => {
      emitter.removeListener('error', errorHandler);
      emitter.removeListener(eventName, eventHandler);
    };

    emitter.on('error', errorHandler);
    emitter.on(eventName, eventHandler);
  });
}

export class Transport {
  host: any;
  socket: any;
  queue: any;
  /**
   * @param {string} host - hostname
   * @param {number} timeout - connection timeout (in seconds)
   */
  constructor(host: any, public readonly config: PlatformConfig) {
    this.host = host;
    this.socket = null;
    this.queue = new Queue(1, Infinity); // 1 concurrent, infinit size
  }

  async connect(fn: any, _timeout = 200) {
    const options = {
      host: this.host,
      port: PORT,
      timeout: _timeout,
    };

    //this.logger('Attempting connection to %o', options);
    this.socket = net.connect(options);

    await wait(this.socket, 'connect', _timeout = 200);
    //await this.socket.connect;
    const result = await fn();
    await this.disconnect();

    return result;
  }

  disconnect() {  
  //  this.logger('Disconnecting');
    this.socket.end();
    this.socket = null;
  }

  async send(buffer: any, useChecksum = true, _timeout = 200) {
    return this.queue.add(async () => (
      this.connect(async () => {
        await this.write(buffer, useChecksum, _timeout);
        return this.read();
      })
    )); 
  }

  async write(buffer: any, useChecksum = true, _timeout = 200) {
    let sent;
    if(useChecksum){
      const chk = checksum(buffer);
      const payload = Buffer.concat([buffer, Buffer.from([chk])]);
      sent = this.socket.write(payload, useChecksum, _timeout);

    } else {
      sent = this.socket.write(buffer, useChecksum, _timeout);
    }
 


    // wait for drain event which means all data has been sent
    if (sent !== true) {
      await wait(this.socket, 'drain', _timeout);
      //await this.socket.drain;
    }
  }

  async read(_timeout = 200) {
    const data = await wait(this.socket, 'data', _timeout);
    // this.logger('Read data %o', `0x${data.toString('hex')}`);
    return data;
  }

  async getState(_timeout = 500){
    
    // this.platform.log.debug('Querying state');
    const data = await this.send(COMMAND_QUERY_STATE, true, _timeout);
    if (data.length < 14) {
      throw new Error('State query returned invalid data.');
    }
    return {
      
      debugBuffer: data,
      lightVersionModifier: data.readUInt8(1),
      isOn: data.readUInt8(2) === 0x23,
      color: {
        red: data.readUInt8(6),
        green: data.readUInt8(7),
        blue: data.readUInt8(8),
      },
      warmWhite: data.readUInt8(9),
      lightVersion: data.readUInt8(10),
      coldWhite: data.readUInt8(11),
    };
  }
}
