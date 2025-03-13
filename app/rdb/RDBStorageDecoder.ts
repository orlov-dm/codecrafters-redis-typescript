import { readBitsAcrossBytes } from './helpers';
import type { StorageState } from '../data/Storage';
import { RDBStorage } from './const';

type IndexedResult<T> = {
    value: T;
    index: number;
};

interface KeyValue {
    key: string;
    value: string | null;
    expiryMs: number | null;
}

interface LengthResult {
    length: number;
    isStringValue: boolean;
}

export class RDBStorageDecoder {
    public decodeHeader(
        buffer: Buffer<ArrayBufferLike>
    ): IndexedResult<string> {
        const magicString = buffer.toString(
            RDBStorage.SOURCE_ENCODING,
            0,
            RDBStorage.MAGIC_STRING.length
        );
        const offset = RDBStorage.MAGIC_STRING.length;
        console.log('offset', offset, magicString);
        const version = buffer.toString(
            RDBStorage.SOURCE_ENCODING,
            offset,
            offset + RDBStorage.MAGIC_STRING_VER.length
        );
        console.log(
            'offset',
            offset,
            offset + RDBStorage.MAGIC_STRING_VER.length,
            version
        );
        return {
            value: magicString + version,
            index: offset + RDBStorage.MAGIC_STRING_VER.length,
        };
    }

    public decodeMetadata(
        buffer: Buffer<ArrayBufferLike>,
        index: number
    ): IndexedResult<string | null> {
        let currentIndex = index;
        if (buffer[currentIndex] === RDBStorage.METADATA_SECTION_FLAG) {
            ++currentIndex;
            const redisVerParam = this.decodeString(buffer, currentIndex);
            const redisVer = this.decodeString(buffer, redisVerParam.index);
            return {
                value: redisVerParam.value + redisVer.value,
                index: redisVer.index,
            };
        }
        return {
            value: null,
            index: index,
        };
    }

    public decodeDatabase(
        buffer: Buffer<ArrayBufferLike>,
        index: number
    ): StorageState | null {
        let currentIndex = index;

        const data = new Map<string, string>();
        const expiry = new Map<string, number>();

        if (buffer[index] === RDBStorage.EOF_FLAG) {
            return {
                data,
                expiry,
            };
        }
        let hasDBSection = false;
        let hasDBSizeSection = false;
        let keyLeft: number = 0;
        while (currentIndex < buffer.length) {
            const currentByte = buffer[currentIndex];
            console.log('Byte', currentByte.toString(16));
            switch (currentByte) {
                case RDBStorage.DATABASE_SECTION_FLAG:
                    ++currentIndex;
                    hasDBSection = true;
                    console.log('Found Database Section');
                    break;
                case RDBStorage.DATABASE_SIZE_SECTION_FLAG:
                    hasDBSizeSection = true;
                    ++currentIndex;
                    const keyCount = this.decodeLength(buffer, currentIndex);
                    keyLeft = keyCount.value.length;
                    const expiresCount = this.decodeLength(
                        buffer,
                        keyCount.index
                    );
                    currentIndex = expiresCount.index;

                    console.log(
                        'Found Database Size Section: keys ',
                        keyCount,
                        ', expires: ',
                        expiresCount
                    );
                    break;
                case RDBStorage.EOF_FLAG:
                    console.log('Found EOF');
                    if (keyLeft) {
                        console.warn(
                            'Key left to parse, but we have EOF',
                            keyLeft
                        );
                    }
                    return {
                        data,
                        expiry,
                    };
            }
            if (hasDBSection && hasDBSizeSection && keyLeft) {
                console.log('Parsing db values');
                const keyValueResult = this.decodeValue(buffer, currentIndex);
                const { key, value, expiryMs } = keyValueResult.value || {
                    key: null,
                    value: null,
                    expiry: null,
                };
                if (key && value) {
                    data.set(key, value);
                    if (expiryMs !== null) {
                        expiry.set(key, expiryMs);
                    }
                }
                currentIndex = keyValueResult.index;
                --keyLeft;
                continue;
            }
            ++currentIndex;
        }
        return {
            data,
            expiry,
        };
    }

    public decodeValue(
        buffer: Buffer<ArrayBufferLike>,
        index: number
    ): IndexedResult<KeyValue | null> {
        let currentIndex = index;
        let type = buffer.readUint8(index);
        ++currentIndex;

        // has expiry
        let expiryMs: number | null = null;
        if (
            type === RDBStorage.EXPIRY_SECONDS_FLAG ||
            type == RDBStorage.EXPIRY_MILISECONDS_FLAG
        ) {
            console.log('has expiry', type.toString(16), currentIndex);
            switch (type) {
                case RDBStorage.EXPIRY_MILISECONDS_FLAG:
                    expiryMs = Number(buffer.readBigInt64LE(currentIndex));
                    currentIndex += 8;
                    console.log('MS expiry', currentIndex);
                    break;
                case RDBStorage.EXPIRY_SECONDS_FLAG:
                    expiryMs = buffer.readUInt32LE(currentIndex) * 1000;
                    currentIndex += 4;
                    console.log('S expiry', currentIndex);
                    break;
                default:
                    console.error('Unknown expiry flag');
                    throw new Error('Unknown expiry flag');
            }
            console.log('expiry is', expiryMs, new Date(expiryMs));
            type = buffer.readUint8(currentIndex);
            ++currentIndex;
        }

        switch (type) {
            case RDBStorage.STRING_TYPE:
                console.log('string type', type.toString(16));
                const key = this.decodeString(buffer, currentIndex);
                const value = this.decodeString(buffer, key.index);
                return {
                    value: {
                        key: key.value,
                        value: value.value,
                        expiryMs,
                    },
                    index: value.index,
                };
            default:
                console.error(
                    'unknown value type',
                    type.toString(16),
                    type.toString(2)
                );
        }
        return {
            value: null,
            index: currentIndex,
        };
    }

    public decodeLength(
        buffer: Buffer<ArrayBufferLike>,
        index: number
    ): IndexedResult<LengthResult> {
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
            case 0b11:
                const prefix = buffer.readUIntBE(currentIndex, 1);
                console.log('Prefix', prefix.toString(16), currentIndex);
                switch (prefix) {
                    case 0xc0:
                        length = buffer.readUIntBE(currentIndex + 1, 1);
                        currentIndex += 2;
                        break;
                    case 0xc1:
                        length = buffer.readUIntBE(currentIndex + 1, 2);
                        currentIndex += 3;
                        break;
                    case 0xc2:
                        length = buffer.readUIntBE(currentIndex + 1, 4);
                        currentIndex += 5;
                        break;
                }
        }

        return {
            value: {
                length,
                isStringValue: lengthEncoding === 0b11,
            },
            index: currentIndex,
        };
    }

    public decodeString(
        buffer: Buffer<ArrayBufferLike>,
        index: number
    ): IndexedResult<string> {
        const decodedLength = this.decodeLength(buffer, index);

        const { value: lengthValue, index: currentIndex } = decodedLength;
        if (lengthValue.isStringValue) {
            console.log('Found string value for length', currentIndex);
            return {
                value: lengthValue.length.toString(),
                index: currentIndex,
            };
        }
        return {
            value: buffer.toString(
                RDBStorage.SOURCE_ENCODING,
                currentIndex,
                currentIndex + lengthValue.length
            ),
            index: currentIndex + lengthValue.length,
        };
    }
}
