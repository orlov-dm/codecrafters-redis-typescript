import { readBitsAcrossBytes } from "./helpers";
import type { StorageState } from "../data/Storage";
import { RDBStorage } from "./const";


type IndexedResult<T> = {
    value: T;
    index: number;
}

interface KeyValue {
    key: string,
    value: string | null,
}

export class RDBStorageDecoder {
    public decodeHeader(buffer: Buffer<ArrayBufferLike>): IndexedResult<string> {
        const magicString = buffer.toString(RDBStorage.SOURCE_ENCODING, 0, RDBStorage.MAGIC_STRING.length);
        const offset = RDBStorage.MAGIC_STRING.length;
        console.log('offset', offset, magicString);
        const version = buffer.toString(RDBStorage.SOURCE_ENCODING, offset, offset + RDBStorage.MAGIC_STRING_VER.length);
        console.log('offset', offset, offset + RDBStorage.MAGIC_STRING_VER.length, version);
        return {
            value: magicString + version,
            index: offset + RDBStorage.MAGIC_STRING_VER.length
        }
    }

    public decodeMetadata(buffer: Buffer<ArrayBufferLike>, index: number): IndexedResult<string | null> {
        let currentIndex = index;
        if (buffer[currentIndex] === RDBStorage.METADATA_SECTION_FLAG) {
            ++currentIndex;
            const redisVerParam = this.decodeString(buffer, currentIndex);
            const redisVer = this.decodeString(buffer, redisVerParam.index);
            console.log('redis', redisVerParam, redisVer);
            return {
                value: redisVerParam.value + redisVer.value,
                index: redisVer.index
            }
        }
        return {
            value: null,
            index: index + 1,
        };
    }

    public decodeDatabase(buffer: Buffer<ArrayBufferLike>, index: number): StorageState | null {
        let currentIndex = index;
                
        const data = new Map<string, string>();
        const expiry = new Map<string, number>();

        if (buffer[index] === RDBStorage.EOF_FLAG) {
            return {
                data,
                expiry
            };
        }
        let hasDBSection = false; 
        let hasDBSizeSection = false;
        while (currentIndex < buffer.length) {
            const currentByte = buffer[currentIndex];            
            switch (currentByte) {
                case RDBStorage.DATABASE_SECTION_FLAG:
                    ++currentIndex;
                    hasDBSection = true;            
                    break;
                case RDBStorage.DATABASE_SIZE_SECTION_FLAG:
                    hasDBSizeSection = true;
                    ++currentIndex;
                    const keyCount = this.decodeLength(buffer, currentIndex);                    
                    const expiresCount = this.decodeLength(buffer, keyCount.index)
                    currentIndex = expiresCount.index;
                    break;
                case RDBStorage.EOF_FLAG:
                    return {
                        data,
                        expiry
                    };    
            }
            if (hasDBSection && hasDBSizeSection) {
                const keyValueResult = this.decodeValue(buffer, currentIndex);
                const {key, value} = keyValueResult.value || {
                    key: null,
                    value: null
                };
                if (key && value) {
                    data.set(key, value);
                }
                currentIndex = keyValueResult.index;
                continue;      
            }
            ++currentIndex;
        }        
        return {
            data,
            expiry
        };        
    }

    public decodeValue(buffer: Buffer<ArrayBufferLike>, index: number): IndexedResult<KeyValue | null> {
        let currentIndex = index;
        const type = buffer.readUint8(index);
        ++currentIndex;
        switch (type) {
            case RDBStorage.STRING_TYPE:
                const key = this.decodeString(buffer, currentIndex);
                const value = this.decodeString(buffer, key.index);
                return {
                    value: {
                        key: key.value,
                        value: value.value
                    },
                    index: value.index
                };            
            default:
                console.error('unknown value type', type);
        }
        return {
            value: null,
            index: currentIndex
        };
    }

    public decodeLength(buffer: Buffer<ArrayBufferLike>, index: number): IndexedResult<number> {
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

        return {
            value: length,
            index: currentIndex
        }
    }

    public decodeString(buffer: Buffer<ArrayBufferLike>, index: number): IndexedResult<string> {        
        const decodedLength = this.decodeLength(buffer, index);

        const {
            value: length,
            index: currentIndex
        } = decodedLength;
        return {
            value: buffer.toString(RDBStorage.SOURCE_ENCODING, currentIndex, currentIndex + length), 
            index: currentIndex + length
        };
    }
}