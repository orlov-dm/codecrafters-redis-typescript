import { DATA_PREFIXES_CONFIG, DELIMITER, type Data, DataType } from "./types";

export class Encoder {
    constructor() {}
    
    public encode(data: Data): string | null  {
        let parts;
        switch(data.type) {
            case DataType.SimpleString:
                 parts = [DATA_PREFIXES_CONFIG[data.type].prefix + data.value];
                 break;
            case DataType.BulkString:
                const str = data.value ?? '';
                parts = [DATA_PREFIXES_CONFIG[data.type].prefix + (str.length || - 1).toString(), str];
                break;
            default:
                return null;
        }
        return parts.join(DELIMITER) + DELIMITER;
    }

   
}
