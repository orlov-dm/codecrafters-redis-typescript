import { DataType, DATA_PREFIXES, DELIMITER } from './types';
import type { Data, StringData } from './types';

export class CommandParser {
    constructor() {}

    public parse(input: string): Data | null {
        const [result] = this.parseElement(input);
        return result;
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
        let nextPrefixIndex = this.findNextPrefix(input, index) ?? input.length;
        let data: Data | null = null;
        switch (type) {
            case DataType.Integer:
                //
                let sign = 1;
                if (input[index] === '-' || input[index] === '+') {
                    if (input[index] === '-') {
                        sign = -1;
                    }
                    index++;
                }
                data = {
                    type,
                    value:
                        sign *
                        Number(
                            input.slice(
                                index,
                                nextPrefixIndex - DELIMITER.length
                            )
                        ),
                };
                break;
            case DataType.SimpleString:
                // +OK\r\n
                data = {
                    type,
                    value: input.slice(
                        index,
                        nextPrefixIndex - DELIMITER.length
                    ),
                };
                break;
            case DataType.BulkString:
                // $4\r\nECHO\r\n
                const strLengthEndIndex = input.indexOf(DELIMITER, index);
                if (strLengthEndIndex === -1) {
                    console.error("Can't find length in BulkString");
                    break;
                }
                const strLength = Number(input.slice(index, strLengthEndIndex));
                if (Number.isNaN(strLength)) {
                    console.error('Malformed length in BulkString');
                    break;
                }
                if (strLength === -1) {
                    data = null;
                    break;
                }
                index = strLengthEndIndex + DELIMITER.length;
                data = {
                    type,
                    value: input.slice(
                        index,
                        nextPrefixIndex - DELIMITER.length
                    ),
                };
                break;
            case DataType.Array:
                // *2\r\n$4\r\nECHO\r\n$3\r\nhey\r\n'
                const arrLengthEndIndex = input.indexOf(DELIMITER, index);
                if (arrLengthEndIndex === -1) {
                    console.error("Can't find length in Array");
                    break;
                }
                let arrLength = Number(input.slice(index, arrLengthEndIndex));
                if (Number.isNaN(arrLength)) {
                    console.error('Malformed length in Array');
                    break;
                }
                if (arrLength === -1) {
                    data = null;
                    break;
                }
                const arrayData: Data[] = [];
                index = arrLengthEndIndex + DELIMITER.length;
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
                break;
        }
        return [data, nextPrefixIndex];
    }

    private findNextPrefix(input: string, index: number): number | null {
        let nextPrefixIndex = 0;
        let tempNextIndex = index;
        while (nextPrefixIndex === 0) {
            tempNextIndex = input.indexOf(DELIMITER, tempNextIndex);
            if (tempNextIndex === -1) {
                console.error("Can't find next delimiter");
                return null;
            }
            tempNextIndex += +DELIMITER.length;
            if (tempNextIndex >= input.length) {
                // reached end
                return null;
            }
            if (DATA_PREFIXES[input[tempNextIndex]]) {
                nextPrefixIndex = tempNextIndex;
            }
        }
        return nextPrefixIndex;
    }
}
