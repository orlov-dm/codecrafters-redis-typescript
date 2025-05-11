import {
    DATA_PREFIXES_CONFIG,
    DELIMITER,
    type Data,
    DataType,
    InternalValueDataType,
    type InternalValueType,
} from './types';

export class Encoder {
    constructor() {}

    public encode(
        data: InternalValueType | null,
        enforceDataType: DataType | null = null,
        needEndDelimiter = true
    ): string {
        let parts;
        if (data === null) {
            return (
                [DATA_PREFIXES_CONFIG[DataType.BulkString].prefix + '-1'].join(
                    DELIMITER
                ) + (needEndDelimiter ? DELIMITER : '')
            );
        }
        switch (typeof data) {
            case 'string': {
                const str = data ?? '';
                let dataType: DataType = DataType.BulkString;
                if (enforceDataType) {
                    if (Encoder.isStringDataType(enforceDataType)) {
                        dataType = enforceDataType;
                    } else {
                        console.warn(
                            'Encoder: enforced data type is wrong',
                            typeof data,
                            enforceDataType
                        );
                    }
                }
                const prefix = DATA_PREFIXES_CONFIG[dataType].prefix;
                if (
                    dataType === DataType.SimpleString ||
                    dataType === DataType.SimpleError
                ) {
                    parts = [prefix + str];
                } else {
                    if (str.length) {
                        parts = [prefix + str.length.toString(), str];
                    } else {
                        parts = [prefix + '-1'];
                    }
                }
                console.log('Encoding result', data, parts);
                break;
            }
            case 'object': {
                if (Array.isArray(data)) {
                    if (enforceDataType) {
                        console.warn(
                            'Encoder: enforced data type is set for array, not supported'
                        );
                    }
                    const arr = data ?? [];
                    const prefix = DATA_PREFIXES_CONFIG[DataType.Array].prefix;
                    if (arr.length) {
                        parts = [
                            prefix + arr.length.toString(),
                            ...(data
                                ? data.map((item) =>
                                      this.encode(item, null, false)
                                  )
                                : []),
                        ];
                    } else {
                        parts = [prefix + '0'];
                    }
                } else {
                    console.error('data', data);
                    throw new Error('Unsupported object type');
                }
                break;
            }
            case 'number': {
                const num = data ?? -1;
                let dataType = DataType.Integer;
                const prefix = DATA_PREFIXES_CONFIG[dataType].prefix;
                parts = [prefix + num.toString()];
                break;
            }
            default:
                throw new Error('Unsupported type');
        }
        return parts.join(DELIMITER) + (needEndDelimiter ? DELIMITER : '');
    }

    public getDataType(data: InternalValueType): InternalValueDataType {
        switch (typeof data) {
            case 'string':
                return InternalValueDataType.TYPE_STRING;
            case 'number':
                return InternalValueDataType.TYPE_NUMBER;
            case 'object': {
                if (Array.isArray(data)) {
                    return InternalValueDataType.TYPE_ARRAY;
                }
            }
        }
        return InternalValueDataType.TYPE_NONE;
    }

    private static isStringDataType(dataType: DataType) {
        return (
            dataType === DataType.BulkString ||
            dataType === DataType.SimpleString ||
            dataType === DataType.VerbatimString ||
            dataType === DataType.SimpleError
        );
    }
}
