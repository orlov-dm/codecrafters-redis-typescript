import { resourceLimits } from "worker_threads";
import type { PersistenceConfig, StorageState } from "./Storage";
import { WriteStream, readFileSync, writeFileSync, open, O_RDONLY, readFile } from "fs";
import { buffer } from "stream/consumers";

const MAGIC_STRING = 'REDIS';
const MAGIC_STRING_VER = '0011';
const REDIS_VER_PARAM = 'redis-ver';
const REDIS_VER = '6.0.16';

const METADATA_SECTION_FLAG: number = 0xFA;
const MAGIC_STRING_POS = [0, 5];
const MAGIC_STRING_VERSION_POS = [5, 9];
const METADATA_SECTION_TYPE_POS = [9, 10];

const DATABASE_SECTION_FLAG: number = 0xFE;
const DATABASE_SIZE_SECTION_FLAG: number = 0xFB;

const EOF_FLAG: number = 0xFF;


const TARGET_ENCODING = 'ascii';
const SOURCE_ENCODING = 'utf-8';

const STRING_TYPE: number = 0x00;

export class RDBStorageSaver {
    private filePath;
    public constructor(config: PersistenceConfig) {
        this.filePath = config.dir + '/' + config.dbFilename;
        console.log('Built filepath', this.filePath, config);        
        
    }

    public save(storage: StorageState) {
        try {
            console.log('saving file', this.filePath);
            const header = this.encodeHeader();
            const metadata = this.encodeMetadata();
            const database = this.encodeDatabase(storage);
            const eofMarker = Uint8Array.from([EOF_FLAG]);

            const buffer = Buffer.concat([header, metadata, database, eofMarker]);
            writeFileSync(this.filePath, buffer);
        } catch (err) {
            console.error(err, "Can't write file", this.filePath)
        }
    }

    public async restore(): Promise<StorageState | null> {        
        try {
            console.log('restoring file', this.filePath);

            const buffer = readFileSync(this.filePath);            
            const magicString = buffer.toString(SOURCE_ENCODING, MAGIC_STRING_POS[0], MAGIC_STRING_POS[1]);
            if (magicString !== MAGIC_STRING) {
                console.error("Magic string doesn't exist", magicString);
                return null;
            }
            const version = buffer.toString(SOURCE_ENCODING, MAGIC_STRING_VERSION_POS[0], MAGIC_STRING_VERSION_POS[1]);
            const metadataSectionFlag = Number(buffer[METADATA_SECTION_TYPE_POS[0]]);            
            if (metadataSectionFlag !== METADATA_SECTION_FLAG) {
                console.error("Metadata section doesn't exist", metadataSectionFlag);
                return null;
            }
            console.log('data', magicString, version, metadataSectionFlag.toString(16));
            
            const storage = this.decodeDatabase(buffer, METADATA_SECTION_TYPE_POS[1]);

            console.log('Restore state here', storage);
            return storage;
        } catch (err) {
            console.error(err, "Can't restore data from file", this.filePath);
        }        
        return null;
    }

    private encodeHeader(): Uint8Array {
        const headerSize = MAGIC_STRING_VERSION_POS[1] - MAGIC_STRING_POS[0];
        const buffer = Buffer.alloc(headerSize); // 5 bytes for "REDIS" + 4 bytes for version
        buffer.write(MAGIC_STRING, MAGIC_STRING_POS[0], MAGIC_STRING.length);
        buffer.write(MAGIC_STRING_VER.padStart(4, "0"), MAGIC_STRING_VERSION_POS[0], 4);
        return buffer;
    }

    private encodeMetadata(): Uint8Array {
        return Buffer.concat([
            Uint8Array.from([METADATA_SECTION_FLAG]), 
            this.encodeString(REDIS_VER_PARAM),
            this.encodeString(REDIS_VER)
        ]);
    }

    private encodeDatabase(storage: StorageState): Uint8Array {
        const dbIndex = 0;
        const mainPart = Buffer.concat([
            Uint8Array.from([DATABASE_SECTION_FLAG]), 
            this.encodeLength(dbIndex),
            Uint8Array.from([DATABASE_SIZE_SECTION_FLAG]),
            this.encodeLength(storage.data.size),
            this.encodeLength(storage.expiry.size)
        ]);
        const keyParts: Uint8Array[] = [...storage.data.entries()].map(([key, value]) => {        
            const typeByte = Uint8Array.from([STRING_TYPE]); 
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

    private decodeDatabase(buffer: Buffer<ArrayBufferLike>, index: number): StorageState | null {
        let currentIndex = index;

        const data = new Map<string, string>();
        const expiry = new Map<string, number>();
        let hasDBSection = false; 
        let hasDBSizeSection = false;
        let keyCount = 0;
        let expiresCount = 0;
        while (currentIndex < buffer.length) {
            const currentByte = buffer[currentIndex];            
            switch (currentByte) {
                case DATABASE_SECTION_FLAG:
                    ++currentIndex;
                    hasDBSection = true;            
                    break;
                case DATABASE_SIZE_SECTION_FLAG:
                    hasDBSizeSection = true;
                    ++currentIndex;
                    [keyCount, currentIndex] = this.decodeLength(buffer, currentIndex);                    
                    [expiresCount, currentIndex] = this.decodeLength(buffer, currentIndex)
                    break;
                case EOF_FLAG:
                    return {
                        data,
                        expiry
                    };    
            }
            if (hasDBSection && hasDBSizeSection) {
                let result = null;
                [result, currentIndex] = this.decodeValue(buffer, currentIndex);
                const [key, value] = result || [null, null];
                if (key) {
                    data.set(key, value);
                }
                continue;      
            }
            ++currentIndex;
        }        
        return {
            data,
            expiry
        };        
    }

    private decodeValue(buffer: Buffer<ArrayBufferLike>, index: number): [[string, string] | null, number] {
        let currentIndex = index;
        const type = buffer.readUint8(index);
        ++currentIndex;
        let key: string = '';
        let value: string = '';
        switch (type) {
            case STRING_TYPE:
                [key, currentIndex] = this.decodeString(buffer, currentIndex);
                [value, currentIndex] = this.decodeString(buffer, currentIndex);
                return [[key, value], currentIndex];
            default:
                console.error('unknown value type', type);
        }
        return [null, currentIndex];
    }

    private encodeLength(length: number): Uint8Array {
        if (length < 64) {
            // Single-byte length (6-bit)
            return Uint8Array.from([length]);
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

    private decodeLength(buffer: Buffer<ArrayBufferLike>, index: number): [number, number] {
        let currentIndex = index;
        const lengthEncoding = readBitsAcrossBytes(buffer, currentIndex, 0, 2);
        let length = NaN;
        switch (lengthEncoding) {
            case 0b00:
                // The size is the remaining 6 bits of the byte.
                length = readBitsAcrossBytes(buffer, currentIndex, 2, 6);
                currentIndex += 1;
                break;
            case 0b01:
                /* 
                    The size is the next 14 bits
                    (remaining 6 bits in the first byte, combined with the next byte),
                    in big-endian (read left-to-right).
                */
               length = readBitsAcrossBytes(buffer, currentIndex, 2, 14);
               currentIndex += 2;
               break;
            case 0b10:
                /* 
                    Ignore the remaining 6 bits of the first byte.
                    The size is the next 4 bytes, in big-endian (read left-to-right).
                */
               length = buffer.readUIntBE(currentIndex + 1, 4);
               currentIndex += 5;
               break;
            // case 0b11: TODO
        }

        return [length, currentIndex];
    }

    private encodeString(value: string): Uint8Array {
        const stringLength = this.encodeLength(value.length);
        return Buffer.concat([
            stringLength, // Type
            Buffer.from(value)
        ]);
    }

    private decodeString(buffer: Buffer<ArrayBufferLike>, index: number): [string, number] {
        let currentIndex = index;
        const decodedLength = this.decodeLength(buffer, currentIndex);
        const [length] = decodedLength;
        [, currentIndex] = decodedLength;
        return [buffer.toString(SOURCE_ENCODING, currentIndex, currentIndex + length), currentIndex + length];
    }
}

function readBitsAcrossBytes(buffer: Buffer, byteIndex: number, bitOffset: number, bitLength: number): number {
    let totalBytes = Math.ceil((bitOffset + bitLength) / 8);
    let value = buffer.readUIntBE(byteIndex, totalBytes);

    let shiftRight = (totalBytes * 8) - (bitOffset + bitLength);
    return (value >> shiftRight) & ((1 << bitLength) - 1);
}