import { Characteristic, Formats, Perms, Service } from "hap-nodejs";

/**
  * Characteristic "ProgramService"
  */
export class Program extends Characteristic {
    static readonly UUID = "00000102-0000-1000-8000-0026BB765296";

constructor() {
    super("Program lights", Program.UUID, {
        format: Formats.BOOL,
        // unit: 'mired',
        // minValue: 153,
        // maxValue: 500,
        perms: [
            Perms.PAIRED_WRITE,
            Perms.PAIRED_READ,
            Perms.NOTIFY,
        ]
    });
    this.value = this.getDefaultValue();
}
}

/**
 * Service "ProgramService"
 */
export class ProgramService extends Service {
    static readonly UUID = "00000101-0000-1000-8000-0026BB765296";

    constructor(displayName: string, subtype?: string) {
        super(displayName, ProgramService.UUID, subtype);

        // Required Characteristics
        this.addCharacteristic(Program);

        // Optional Characteristics
        this.addOptionalCharacteristic(Characteristic.Name);
    }
}

/**
  * Characteristic "ProgramService"
  */
export class Clear extends Characteristic {
    static readonly UUID = "00000102-0000-1000-8000-0026BB765297";

constructor() {
    super("Clear Lights", Clear.UUID, {
        format: Formats.BOOL,
        // unit: 'mired',
        // minValue: 153,
        // maxValue: 500,
        perms: [
            Perms.PAIRED_WRITE,
            Perms.PAIRED_READ,
            Perms.NOTIFY,
        ]
    });
    this.value = this.getDefaultValue();
}
}

/**
 * Service "ProgramService"
 */
export class ClearService extends Service {
    static readonly UUID = "00000101-0000-1000-8000-0026BB765297";

    constructor(displayName: string, subtype?: string) {
        super(displayName, ClearService.UUID, subtype);

        // Required Characteristics
        this.addCharacteristic(Clear);

        // Optional Characteristics
        this.addOptionalCharacteristic(Characteristic.Name);
    }
}
