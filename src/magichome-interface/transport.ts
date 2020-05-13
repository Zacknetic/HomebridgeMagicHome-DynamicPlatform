import net from 'net';
/*import Queue from 'promise-queue';
import { checksum } from './utils';

const PORT = 5577;


function wait(emitter: any, eventName: any) {
  return new Promise((resolve, reject) => {
    let off =                             (() => {
      clearTimeout(off);
      resolve('Promise A win!');
    }, 200);
    const eventHandler = (...args: any[]) => {
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
  private _host: string;
  private _timeout: number;
  private socket: any;
  queue = new Queue(1, Infinity); // 1 concurrent, infinit size
  constructor(host: string, timeout = 5) {
    
    this._host = host;
    this._timeout = timeout;
  }

  async connect(fn: any) {
    const options = {
      host: this._host,
      port: PORT,
      timeout: this._timeout,
    };

    this.socket = net.connect(options);

    await wait(this.socket, 'connect');
    const result = await fn();
    await this.disconnect();

    return result;
  }

  disconnect() {

    this.socket.end();
    this.socket = null;
  }

  async send(buffer: Uint8Array) {
    return this.queue.add(async () => (
      this.connect(async () => {
        await this.write(buffer);
        return this.read();
      })
    ));
  }

  async write(buffer: Uint8Array) {
    const chk = checksum(buffer);
    const payload = Buffer.concat([buffer, Buffer.from([chk])]);

    const sent = this.socket.write(payload, 'binary');

    // wait for drain event which means all data has been sent
    if (sent !== true) {
      await wait(this.socket, 'drain');
    }
 

  async read() {
    const data = await wait(this.socket, 'data');
    return data;
  } }
}
*/