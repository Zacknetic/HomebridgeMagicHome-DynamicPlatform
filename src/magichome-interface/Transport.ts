import net from 'net';
import Queue from 'promise-queue';
import { checksum } from './utils';
import type { PlatformConfig } from 'homebridge';
import { getLogs } from '../logs';

const COMMAND_QUERY_STATE: Uint8Array = Uint8Array.from([0x81, 0x8a, 0x8b]);

const PORT = 5577;

function wait(emitter: net.Socket, eventName: string, timeout: number) {

  return new Promise((resolve, reject) => {
    let complete = false;

    const waitTimeout: any = setTimeout(() => {
      complete = true; // mark the job as done
      resolve(null);
    }, timeout);

    // listen for the first event, then stop listening (once)
    emitter.once(eventName, (args: any) => {
      clearTimeout(waitTimeout); // stop the timeout from executing
      if (!complete) {
        complete = true; // mark the job as done
        resolve(args);
      }
    });

    emitter.once('close', () => {
      clearTimeout(waitTimeout); // stop the timeout from executing

      // if the socket closed before we resolved the promise, reject the promise
      if (!complete) {
        complete = true;
        reject(null);
      }
    });

    // handle the first error and reject the promise
    emitter.on('error', (e) => {
      clearTimeout(waitTimeout); // stop the timeout from executing

      if (!complete) {
        complete = true;
        reject(e);
      }
    });

  });
}

export class Transport {
  logs = getLogs();
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
    this.queue = new Queue(1, Infinity); // 1 concurrent, infinite size
  }

  async connect(fn: any, _timeout = 200) {
    const options = {
      host: this.host,
      port: PORT,
      timeout: _timeout,
    };

    let result;
    try {
      this.socket = net.connect(options);
      await wait(this.socket, 'connect', _timeout = 200);
      result = await fn();
      return result;
    } catch (e) {
      const { code, address, port } = e;
      if (code) {
        // No need to show error here, shown upstream
        // this.log.debug(`Unable to connect to ${address} ${port} (code: ${code})`);
      } else {
        this.logs.error('transport.ts error:', e);
      }
    } finally {
      this.socket.end();
      this.socket.destroy();
    }

    return null;
  }

  disconnect() {
    this.socket.end();
    this.socket = null;
  }

  async send(buffer: any, useChecksum = true, _timeout = 2000) {
    return this.queue.add(async () => (
      this.connect(async () => {
        await this.write(buffer);
        return this.read(_timeout);
      })
    ));
  }

  async write(buffer: any, useChecksum = true, _timeout = 200) {
    let sent;
    if (useChecksum) {

      const chk = checksum(buffer);
      const payload = Buffer.concat([buffer, Buffer.from([chk])]);
      sent = this.socket.write(payload);

    } else {
      sent = this.socket.write(buffer);
    }

    // wait for drain event which means all data has been sent
    if (sent !== true) {
      await wait(this.socket, 'drain', _timeout);
    }
  }

  async read(_timeout = 200) {
    const data = await wait(this.socket, 'data', _timeout);
    return data;
  }

  async getState(_timeout = 500) {
    try {
      const data = await this.send(COMMAND_QUERY_STATE, true, _timeout);
      if (data == null) {
        return null;
      }
      return {

        debugBuffer: data,
        controllerHardwareVersion: data.readUInt8(1),
        isOn: data.readUInt8(2) === 0x23,
        RGB: {
          red: data.readUInt8(6),
          green: data.readUInt8(7),
          blue: data.readUInt8(8),
        },
        whiteValues: {
          warmWhite: data.readUInt8(9),
          coldWhite: data.readUInt8(11),
        },
        controllerFirmwareVersion: data.readUInt8(10),

      };
    } catch (error) {
      this.logs.debug('Transport getState() error:', error);
    }
  }
}
