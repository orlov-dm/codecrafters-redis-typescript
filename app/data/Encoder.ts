import { DATA_PREFIXES_CONFIG, DELIMITER, type Data, DataType } from "./types";

export class Encoder {
    constructor() {}
    
    public encode(data: Data, needEndDelimiter = true): string | null  {
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
                return null;
        }
        return parts.join(DELIMITER) + (needEndDelimiter ? DELIMITER : '');
    }    
}
