import { DataType, type Data, type StringData } from './types';

export function isString(data: Data): data is StringData {
    return (
        data.type === DataType.SimpleString ||
        data.type === DataType.VerbatimString ||
        data.type === DataType.BulkString
    );
}
