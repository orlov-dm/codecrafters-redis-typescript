import { RDBStorage } from '../rdb/const';
import { DataType, DATA_PREFIXES, DELIMITER } from './types';
import type { Data, StringData } from './types';

interface ParseElementResult {
    element: Data | null;
    nextIndex: number;
    bytesProcessed: number;
}

export interface ParseResult {
    data: Data[];
    bytesProcessed: number;
}

export class CommandParser {
    constructor() {}

    public parse(buffer: Buffer): ParseResult {
        let nextIndex = 0;
        const results: Data[] = [];
        let bytesProcessed = 0;
        while (nextIndex < buffer.length) {
            const {
                element,
                nextIndex: elementNextIndex,
                bytesProcessed: elementBytesProcessed,
            } = this.parseElement(nextIndex, buffer);
            nextIndex = elementNextIndex;
            if (element) {
                results.push(element);
            }
            bytesProcessed += elementBytesProcessed;
        }
        return {
            data: results,
            bytesProcessed,
        };
    }

    private parseElement(index: number, buffer: Buffer): ParseElementResult {
        console.log('Start parsing');
        const [firstChar] = buffer.subarray(index, index + 1).toString();
        let currentIndex = index;
        currentIndex++;
        const type: DataType | null =
            firstChar in DATA_PREFIXES ? DATA_PREFIXES[firstChar] : null;
        if (type === null) {
            console.error(
                'Unknown data type',
                firstChar,
                currentIndex,
                JSON.stringify(buffer.toString(RDBStorage.SOURCE_ENCODING))
            );
            return {
                element: null,
                nextIndex: currentIndex,
                bytesProcessed: currentIndex - index,
            };
        }
        let nextDelimiterIndex = buffer.indexOf(DELIMITER, currentIndex);
        if (nextDelimiterIndex === -1) {
            console.error('no delimiter after data prefix');
            return {
                element: null,
                nextIndex: currentIndex,
                bytesProcessed: currentIndex - index,
            };
        }
        let data: Data | null = null;
        let bytesProcessed = 0;
        switch (type) {
            case DataType.Integer: {
                // :[<+|->]<value>\r\n
                const rawData = buffer.subarray(
                    currentIndex,
                    nextDelimiterIndex
                );
                data = {
                    type,
                    value: Number(rawData.toString(RDBStorage.SOURCE_ENCODING)),
                };
                bytesProcessed = nextDelimiterIndex - index + DELIMITER.length;
                break;
            }
            case DataType.SimpleString: {
                // +OK\r\n
                const rawData = buffer.subarray(
                    currentIndex,
                    nextDelimiterIndex
                );
                data = {
                    type,
                    value: rawData.toString(RDBStorage.SOURCE_ENCODING),
                };
                bytesProcessed = nextDelimiterIndex - index + DELIMITER.length;
                break;
            }
            case DataType.BulkString: {
                // $4\r\nECHO\r\n
                if (nextDelimiterIndex === -1) {
                    console.error("Can't find length in BulkString");
                    break;
                }
                const strLength = Number(
                    buffer
                        .subarray(currentIndex, nextDelimiterIndex)
                        .toString(RDBStorage.SOURCE_ENCODING)
                );
                if (Number.isNaN(strLength)) {
                    console.error('Malformed length in BulkString');
                    break;
                }
                if (strLength === -1) {
                    data = null;
                    break;
                }
                currentIndex = nextDelimiterIndex + DELIMITER.length;
                nextDelimiterIndex = currentIndex + strLength;
                const rawData = buffer.subarray(
                    currentIndex,
                    nextDelimiterIndex
                );
                data = {
                    type,
                    value: rawData.toString(RDBStorage.SOURCE_ENCODING),
                };
                bytesProcessed = nextDelimiterIndex - index + DELIMITER.length;
                if (
                    !buffer
                        .subarray(nextDelimiterIndex)
                        .toString(RDBStorage.SOURCE_ENCODING)
                        .startsWith(DELIMITER)
                ) {
                    return {
                        element: data,
                        nextIndex: nextDelimiterIndex,
                        bytesProcessed: nextDelimiterIndex - index,
                    };
                }
                break;
            }
            case DataType.Array:
                // *2\r\n$4\r\nECHO\r\n$3\r\nhey\r\n'
                if (nextDelimiterIndex === -1) {
                    console.error("Can't find length in Array");
                    break;
                }
                let arrLength = Number(
                    buffer
                        .subarray(currentIndex, nextDelimiterIndex)
                        .toString(RDBStorage.SOURCE_ENCODING)
                );
                if (Number.isNaN(arrLength)) {
                    console.error('Malformed length in Array');
                    break;
                }
                if (arrLength === -1) {
                    data = null;
                    break;
                }
                const arrayData: Data[] = [];
                currentIndex = nextDelimiterIndex + DELIMITER.length;
                while (arrLength--) {
                    const { element: arrayDataItem, nextIndex: newIndex } =
                        this.parseElement(currentIndex, buffer);
                    if (!arrayDataItem) {
                        console.error("Can't parse element in Array");
                        break;
                    }
                    currentIndex = newIndex;
                    arrayData.push(arrayDataItem);
                }
                data = {
                    type,
                    value: arrayData,
                };
                return {
                    element: data,
                    nextIndex: currentIndex,
                    bytesProcessed: currentIndex - index,
                };
        }
        return {
            element: data,
            nextIndex: nextDelimiterIndex + DELIMITER.length,
            bytesProcessed,
        };
    }
}
