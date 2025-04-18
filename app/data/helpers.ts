import {
    DataType,
    type ArrayData,
    type Data,
    type IntegerData,
    type StringData,
} from './types';

export function isString(data: Data): data is StringData {
    return (
        data.type === DataType.SimpleString ||
        data.type === DataType.VerbatimString ||
        data.type === DataType.BulkString
    );
}

export function isNumber(data: Data): data is IntegerData {
    return data.type === DataType.Integer;
}

export function isArray(data: Data): data is ArrayData {
    return data.type === DataType.Array;
}
