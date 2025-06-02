import {
    DATA_PREFIXES_CONFIG,
    DELIMITER,
    DataType,
    InternalValueDataType,
    type InternalValueType,
} from './types';

interface EncodeOptions {
    needEndDelimiter?: boolean;
    enforceDataType?: DataType;
    enforceDataTypePerArrayItem?: Map<string, DataType>;
}

export interface EncodeData {
    data: InternalValueType;
    dataType?: DataType;
}

export class Encoder {
    constructor() {}

    public encode(
        data: InternalValueType,
        encodeOptions: EncodeOptions = {
            needEndDelimiter: true,
        }
    ): string {
        const { needEndDelimiter = true, enforceDataType = null } =
            encodeOptions;
        let parts;
        if (data === null) {
            return (
                this.parseNull().join(DELIMITER) +
                (needEndDelimiter ? DELIMITER : '')
            );
        }
        switch (typeof data) {
            case 'string': {
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
                parts = this.parseString(data, dataType);
                break;
            }
            case 'object': {
                if (Array.isArray(data)) {
                    parts = this.parseArray(
                        data.map((item) => ({ data: item })),
                        enforceDataType
                    );
                } else {
                    console.error('data', data);
                    throw new Error('Unsupported object type');
                }
                break;
            }
            case 'number': {
                let dataType: DataType = DataType.BulkString;
                if (enforceDataType) {
                    if (
                        Encoder.isStringDataType(enforceDataType) ||
                        Encoder.isNumberDataType(enforceDataType)
                    ) {
                        dataType = enforceDataType;
                    } else {
                        console.warn(
                            'Encoder: enforced data type is wrong',
                            typeof data,
                            enforceDataType
                        );
                    }
                }

                if (Encoder.isNumberDataType(dataType)) {
                    parts = this.parseInteger(data);
                } else if (Encoder.isStringDataType(dataType)) {
                    parts = this.parseString(String(data), dataType);
                } else {
                    console.error('data', data);
                    throw new Error('Unsupported object type');
                }
                break;
            }

            default:
                throw new Error('Unsupported type');
        }
        return parts.join(DELIMITER) + (needEndDelimiter ? DELIMITER : '');
    }

    public encodeArray(
        data: EncodeData[],
        encodeOptions: EncodeOptions = {
            needEndDelimiter: true,
        }
    ) {
        const { needEndDelimiter = true, enforceDataType = null } =
            encodeOptions;
        const parts = this.parseArray(data, enforceDataType);
        return parts.join(DELIMITER) + (needEndDelimiter ? DELIMITER : '');
    }

    private parseArray(
        data: EncodeData[],
        enforceDataType: DataType | null = null
    ): string[] {
        let parts: string[] = [];
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
                    ? data.map((item) => {
                          return this.encode(item.data, {
                              needEndDelimiter: false,
                              enforceDataType: item.dataType,
                          });
                      })
                    : []),
            ];
        } else {
            parts = [prefix + '0'];
        }

        return parts;
    }

    private parseNull() {
        return [DATA_PREFIXES_CONFIG[DataType.BulkString].prefix + '-1'];
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

    private parseString(data: string, dataType: DataType): string[] {
        const str = data ?? '';
        const prefix = DATA_PREFIXES_CONFIG[dataType].prefix;
        if (!str.length) {
            return [prefix + '-1'];
        }

        if (
            dataType === DataType.SimpleString ||
            dataType === DataType.SimpleError
        ) {
            return [prefix + str];
        }
        return [prefix + str.length.toString(), str];
    }
    private parseInteger(data: number): string[] {
        const num = data ?? -1;
        let dataType = DataType.Integer;
        const prefix = DATA_PREFIXES_CONFIG[dataType].prefix;
        return [prefix + num.toString()];
    }

    private static isStringDataType(dataType: DataType) {
        return (
            dataType === DataType.BulkString ||
            dataType === DataType.SimpleString ||
            dataType === DataType.VerbatimString ||
            dataType === DataType.SimpleError
        );
    }

    private static isNumberDataType(dataType: DataType) {
        return dataType === DataType.Integer;
    }
}
