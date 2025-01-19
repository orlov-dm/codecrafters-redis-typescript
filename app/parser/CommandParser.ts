enum DataType {
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

const DATA_PREFIXES: { [key: string]: DataType} = {
    '+': DataType.SimpleString,
    '-': DataType.SimpleError,
    ':': DataType.Integer,
    '$': DataType.BulkString,
    '*': DataType.Array,
    '_': DataType.Null,
    '#': DataType.Boolean,
    ',': DataType.Double,
    '(': DataType.BigNumber,
    '!': DataType.BulkError,
    '=': DataType.VerbatimString,
    '%': DataType.Map,
    '`': DataType.Attribute,
    '~': DataType.Set,
    '>': DataType.Push
}


export class CommandParser {
    constructor() {

    }
    
    public parse(input: string): Data {
        const [firstChar] = input;
        const inputs = input.split('\r\n');
        const type: DataType | null = firstChar in DATA_PREFIXES ? DATA_PREFIXES[firstChar] : null;
        if (type === null) {
            throw(new Error('Unknown data type'));
        }
        if (type === DataType.SimpleString) {
            return {
                type,
                value: input.slice(1)
            }
        } else if (type === DataType.Array) {            
            const arrayLength = Number(input[1]);
            console.log('Array len', arrayLength, inputs);
            const arrayData: ArrayData = {
                type,
                value: inputs.slice(2, arrayLength),
            };
            return arrayData;
        }
        return {
            type,
            value: input
        }
    }
}

interface Data {
    type: DataType;
    value: string | number | string[];
}

interface SimpleStringData extends Data {
    type: DataType.SimpleString;
    value: string;
}

interface ArrayData extends Data {
    type: DataType.Array;
    value: string[];
}