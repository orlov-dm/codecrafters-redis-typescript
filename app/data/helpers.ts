import { DataType, type ArrayData, type Data, type StringData } from './types';

export function isString(data: Data): data is StringData {
    return (
        data.type === DataType.SimpleString ||
        data.type === DataType.VerbatimString ||
        data.type === DataType.BulkString
    );
}

export function isArray(data: Data): data is ArrayData {
    return data.type === DataType.Array;
}
