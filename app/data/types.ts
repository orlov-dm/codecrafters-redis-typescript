const CR = '\r';
const LF = '\n';
export const DELIMITER = `${CR}${LF}`;

export enum DataType {
    SimpleString,
    SimpleError,
    Integer,
    BulkString,
    Array,
    Null,
    Boolean,
    Double,
    BigNumber,
    BulkError,
    VerbatimString,
    Map,
    Attribute,
    Set,
    Push,
}

export type UnifiedString =
    | DataType.SimpleString
    | DataType.BulkString
    | DataType.VerbatimString;

export const DATA_PREFIXES: { [key: string]: DataType } = {
    '+': DataType.SimpleString,
    '-': DataType.SimpleError,
    ':': DataType.Integer,
    $: DataType.BulkString,
    '*': DataType.Array,
    _: DataType.Null,
    '#': DataType.Boolean,
    ',': DataType.Double,
    '(': DataType.BigNumber,
    '!': DataType.BulkError,
    '=': DataType.VerbatimString,
    '%': DataType.Map,
    '`': DataType.Attribute,
    '~': DataType.Set,
    '>': DataType.Push,
};

export const DATA_PREFIXES_CONFIG = {
    [DataType.SimpleString]: {
        prefix: '+',
    },
    [DataType.SimpleError]: {
        prefix: '-',
    },
    [DataType.Integer]: {
        prefix: ':',
    },
    [DataType.BulkString]: {
        prefix: '$',
    },
    [DataType.Array]: {
        prefix: '*',
    },
    [DataType.Null]: {
        prefix: '_',
    },
    [DataType.Boolean]: {
        prefix: '#',
    },
    [DataType.Double]: {
        prefix: ',',
    },
    [DataType.BigNumber]: {
        prefix: '(',
    },
    [DataType.BulkError]: {
        prefix: '!',
    },
    [DataType.VerbatimString]: {
        prefix: '=',
    },
    [DataType.Map]: {
        prefix: '%',
    },
    [DataType.Attribute]: {
        prefix: '`',
    },
    [DataType.Set]: {
        prefix: '~',
    },
    [DataType.Push]: {
        prefix: '>',
    },
};

export interface StringData {
    type: UnifiedString;
    value: string;
}

export interface IntegerData {
    type: DataType.Integer;
    value: number;
}

export interface ArrayData {
    type: DataType.Array;
    value: Data[];
}

export type Data = StringData | IntegerData | ArrayData;

export type InternalValueType = string | number | Array<InternalValueType>;
export enum InternalValueDataType {
    TYPE_STRING = 'string',
    TYPE_ARRAY = 'array',
    TYPE_NUMBER = 'number',
    TYPE_STREAM = 'stream',
    TYPE_NONE = 'none',
}
