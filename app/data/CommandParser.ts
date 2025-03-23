import { RDBStorage } from '../rdb/const';
import { DataType, DATA_PREFIXES, DELIMITER } from './types';
import type { Data, StringData } from './types';

export class CommandParser {
    constructor() {}

    public parse(buffer: Buffer): (Data | null)[] {
        let nextIndex = 0;
        const results: (Data | null)[] = [];
        while (nextIndex < buffer.length) {
            const [result, tempNextIndex] = this.parseElement(
                nextIndex,
                buffer
            );
            nextIndex = tempNextIndex;
            results.push(result);
        }
        return results;
    }

    private parseElement(index: number, buffer: Buffer): [Data | null, number] {
        const [firstChar] = buffer.subarray(index, index + 1).toString();
        index++;
        const type: DataType | null =
            firstChar in DATA_PREFIXES ? DATA_PREFIXES[firstChar] : null;
        if (type === null) {
            console.error(
                'Unknown data type',
                firstChar,
                index,
                JSON.stringify(buffer.toString(RDBStorage.SOURCE_ENCODING))
            );
            return [null, index];
        }
        let nextDelimiterIndex = buffer.indexOf(DELIMITER, index);
        if (nextDelimiterIndex === -1) {
            console.error('no delimiter after data prefix');
            return [null, index];
        }
        let data: Data | null = null;
        switch (type) {
            case DataType.Integer:
                //
                data = {
                    type,
                    value: Number(
                        buffer
                            .subarray(index, nextDelimiterIndex)
                            .toString(RDBStorage.SOURCE_ENCODING)
                    ),
                };
                break;
            case DataType.SimpleString:
                // +OK\r\n
                data = {
                    type,
                    value: buffer
                        .subarray(index, nextDelimiterIndex)
                        .toString(RDBStorage.SOURCE_ENCODING),
                };
                break;
            case DataType.BulkString:
                // $4\r\nECHO\r\n
                if (nextDelimiterIndex === -1) {
                    console.error("Can't find length in BulkString");
                    break;
                }
                const strLength = Number(
                    buffer
                        .subarray(index, nextDelimiterIndex)
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
                index = nextDelimiterIndex + DELIMITER.length;
                nextDelimiterIndex = index + strLength;
                data = {
                    type,
                    value: buffer
                        .subarray(index, nextDelimiterIndex)
                        .toString(RDBStorage.SOURCE_ENCODING),
                };
                if (
                    !buffer
                        .subarray(nextDelimiterIndex)
                        .toString(RDBStorage.SOURCE_ENCODING)
                        .startsWith(DELIMITER)
                ) {
                    return [data, nextDelimiterIndex];
                }
                break;
            case DataType.Array:
                // *2\r\n$4\r\nECHO\r\n$3\r\nhey\r\n'
                if (nextDelimiterIndex === -1) {
                    console.error("Can't find length in Array");
                    break;
                }
                let arrLength = Number(
                    buffer
                        .subarray(index, nextDelimiterIndex)
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
                index = nextDelimiterIndex + DELIMITER.length;
                while (arrLength--) {
                    const [arrayDataItem, newIndex] = this.parseElement(
                        index,
                        buffer
                    );
                    if (!arrayDataItem) {
                        console.error("Can't parse element in Array");
                        break;
                    }
                    index = newIndex;
                    arrayData.push(arrayDataItem);
                }
                data = {
                    type,
                    value: arrayData,
                };
                return [data, index];
        }
        return [data, nextDelimiterIndex + DELIMITER.length];
    }
}
