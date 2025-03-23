import { DataType, DATA_PREFIXES, DELIMITER } from './types';
import type { Data, StringData } from './types';

export class CommandParser {
    constructor() {}

    public parse(input: string): (Data | null)[] {
        let nextIndex = 0;
        const results: (Data | null)[] = [];
        while (nextIndex < input.length) {
            const [result, tempNextIndex] = this.parseElement(input, nextIndex);
            nextIndex = tempNextIndex;
            results.push(result);
        }
        return results;
    }

    private parseElement(
        input: string,
        index: number = 0
    ): [Data | null, number] {
        const [firstChar] = input[index];
        index++;
        const type: DataType | null =
            firstChar in DATA_PREFIXES ? DATA_PREFIXES[firstChar] : null;
        if (type === null) {
            console.error('Unknown data type', firstChar);
            return [null, index];
        }
        let nextDelimiterIndex = input.indexOf(DELIMITER, index);
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
                    value: Number(input.slice(index, nextDelimiterIndex)),
                };
                break;
            case DataType.SimpleString:
                // +OK\r\n
                data = {
                    type,
                    value: input.slice(index, nextDelimiterIndex),
                };
                break;
            case DataType.BulkString:
                // $4\r\nECHO\r\n
                if (nextDelimiterIndex === -1) {
                    console.error("Can't find length in BulkString");
                    break;
                }
                const strLength = Number(
                    input.slice(index, nextDelimiterIndex)
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
                    value: input.slice(index, nextDelimiterIndex),
                };

                break;
            case DataType.Array:
                // *2\r\n$4\r\nECHO\r\n$3\r\nhey\r\n'
                if (nextDelimiterIndex === -1) {
                    console.error("Can't find length in Array");
                    break;
                }
                let arrLength = Number(input.slice(index, nextDelimiterIndex));
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
                        input,
                        index
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
