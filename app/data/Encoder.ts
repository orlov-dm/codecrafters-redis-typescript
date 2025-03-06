import { DATA_PREFIXES_CONFIG, DELIMITER, type Data, DataType, type InternalValueType } from "./types";

export class Encoder {
    constructor() {}
    
    public encode(data: InternalValueType | null, needEndDelimiter = true): string  {
        let parts;
        if (!data) {
            return [DATA_PREFIXES_CONFIG[DataType.BulkString].prefix + '-1'].join(DELIMITER) + (needEndDelimiter ? DELIMITER : '');
        }
        switch(typeof data) {
            case 'string':  {
                const str = data ?? '';
                const prefix = DATA_PREFIXES_CONFIG[DataType.BulkString].prefix; 
                if (str.length) {
                    parts = [prefix + str.length.toString(), str];
                } else {
                    parts = [prefix + '-1'];
                }
                break;
            }
            case 'object':  {
                if (Array.isArray(data)) {
                    const arr = data ?? [];
                    const prefix = DATA_PREFIXES_CONFIG[DataType.Array].prefix;
                    if (arr.length) {                
                        parts = [prefix + arr.length.toString(), ...(data ? data.map(item => this.encode(item, false)) : [])]
                    } else {
                        parts = [prefix + '0'];
                    }
                } else {
                    console.error('data', data);
                    throw(new Error('Unsupported object type'));
                }
                break;
            }
            default:
                throw(new Error('Unsupported type'));
        }
        return parts.join(DELIMITER) + (needEndDelimiter ? DELIMITER : '');
    }
}
