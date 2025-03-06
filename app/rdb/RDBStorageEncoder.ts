import type { StorageState } from "../data/Storage";
import { RDBStorage } from "./const";


export class RDBStorageEncoder {
    public encodeHeader(): Uint8Array {        
        const buffer = Buffer.alloc(RDBStorage.MAGIC_STRING.length + RDBStorage.MAGIC_STRING_VER.length); // 5 bytes for "REDIS" + 4 bytes for version
        const offset = buffer.write(RDBStorage.MAGIC_STRING);
        buffer.write(RDBStorage.MAGIC_STRING_VER, offset, RDBStorage.MAGIC_STRING_VER.length);
        return buffer;
    }

    public encodeMetadata(): Uint8Array {
        return Buffer.concat([
            Uint8Array.from([RDBStorage.METADATA_SECTION_FLAG]),
            this.encodeString(RDBStorage.REDIS_VER_PARAM),
            this.encodeString(RDBStorage.REDIS_VER)
        ]);
    }

    public encodeDatabase(storage: StorageState): Uint8Array | null {
        if (!storage.data.size) {
            return null
        }
        const dbIndex = 0;
        const mainPart = Buffer.concat([
            Uint8Array.from([RDBStorage.DATABASE_SECTION_FLAG]),
            this.encodeLength(dbIndex),
            Uint8Array.from([RDBStorage.DATABASE_SIZE_SECTION_FLAG]),
            this.encodeLength(storage.data.size),
            this.encodeLength(storage.expiry.size)
        ]);
        const keyParts: Uint8Array[] = [...storage.data.entries()].map(([key, value]) => {
            const typeByte = Uint8Array.from([RDBStorage.STRING_TYPE]);
            const part: Uint8Array = Buffer.concat([
                typeByte,
                this.encodeString(key),
                this.encodeString(value),
            ]);
            return part;
        });

        return Buffer.concat([
            mainPart,
            ...keyParts
        ]);
    }

    public encodeEOF(): Uint8Array {
        return Uint8Array.from([RDBStorage.EOF_FLAG]);
    }

    private encodeLength(length: number): Buffer {
        if (length < 64) {
            // Single-byte length (6-bit)
            const buffer = Buffer.alloc(1);
            const encodedValue = (0b00 << 6) | length
            buffer.writeUInt8(encodedValue)
            return buffer;
        } else if (length < 16384) {
            const buffer = Buffer.alloc(2); // Create a 2-byte buffer        
            const encodedValue = (0b01 << 14) | length; // Combine prefix with number
            buffer.writeUInt16BE(encodedValue); // Write to buffer in big-endian format         
            return buffer;
        } else {
            // 5-byte length (marker + 4-byte unsigned integer)
            const buffer = Buffer.alloc(5);
            buffer[0] = 0x80; // Marker for 32-bit length
            buffer.writeUInt32BE(length, 1);
            return buffer;
        }
    }
    
    private encodeStringIntegerAsLength(value: number) {
        console.log('encoding str as int', value);
        if (value >= -128 && value <= 127) {    
            return Buffer.from([0xC0, value & 0xFF]);            
        } else  if (value >= -32768 && value <= 32767) {
            const buffer = Buffer.alloc(3);
            buffer.writeUInt8(0xC1, 0);
            buffer.writeInt16LE(value, 1);
            return buffer;
        } else if (value >= -2147483648 && value <= 2147483647) {     
            const buffer = Buffer.alloc(5);
            buffer.writeUint8(0xC2, 0);
            buffer.writeInt32LE(value, 1);       
            return buffer;
        } else {
            throw new RangeError(`Value ${value} is out of range for integer encoding.`);
        }        
    }

    private encodeString(value: string): Uint8Array {
        if (Number.isInteger(Number(value))) {
            console.log('String is int');
            const num = Number(value);
            try {
                return this.encodeStringIntegerAsLength(num);
            } catch(e: any) {
                // use original string encoding instead
            }
        }
        const stringLength = this.encodeLength(value.length);
        return Buffer.concat([
            stringLength, // Type
            Buffer.from(value)
        ]);
    }
}