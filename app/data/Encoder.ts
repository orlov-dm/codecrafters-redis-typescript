import { DATA_PREFIXES_CONFIG, DELIMITER, type Data, DataType } from "./types";

export class Encoder {
    constructor() {}
    
    public encode(data: Data, needEndDelimiter = true): string  {
        let parts;
        switch(data.type) {
            case DataType.SimpleString:
                 parts = [DATA_PREFIXES_CONFIG[data.type].prefix + data.value];
                 break;
            case DataType.BulkString:
                const str = data.value ?? '';
                if (str.length) {
                    parts = [DATA_PREFIXES_CONFIG[data.type].prefix + str.length.toString(), str];
                } else {
                    parts = [DATA_PREFIXES_CONFIG[data.type].prefix + '-1'];
                }
                break;
            case DataType.Array:
                const arr = data.value ?? [];
                if (arr.length) {                
                    parts = [DATA_PREFIXES_CONFIG[data.type].prefix + arr.length.toString(), ...(data.value ? data.value.map(data => this.encode(data, false)) : [])]
                } else {
                    parts = [DATA_PREFIXES_CONFIG[data.type].prefix + '-1'];
                }
                break;
            default:
                throw(new Error('Unsupported type'));
        }
        return parts.join(DELIMITER) + (needEndDelimiter ? DELIMITER : '');
    }
    
    public convertString(value: string): Data {
        return {
            type: DataType.BulkString,
            value,
        }
    }
}
