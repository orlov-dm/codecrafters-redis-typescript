import { DefaultArguments } from "./const";

enum ArgumentType {
    DIR = 'dir',
    DBFILENAME = 'dbfilename',
    PORT = 'port',
    REPLICA_OF = 'replicaof',
}

interface Arguments {
    dir: string,
    dbfilename: string,
    port: number,
    replicaof: string,
}

export class ArgumentsReader {
    private arguments: Arguments;
    constructor(private readonly args: string[]) {        
        const portString = this.readArgument(ArgumentType.PORT);
        this.arguments = {
            dir: this.readArgument(ArgumentType.DIR) ?? DefaultArguments.DEFAULT_DIR,
            dbfilename: this.readArgument(ArgumentType.DBFILENAME) ?? DefaultArguments.DEFAULT_DB_FILENAME,
            port: portString ? Number(portString) : DefaultArguments.DEFAULT_PORT,
            replicaof: this.readArgument(ArgumentType.REPLICA_OF) ?? DefaultArguments.DEFAULT_REPLICAOF,
        }
    }

    private readArgument(argType: ArgumentType): string | null {        
        const argumentIndex = this.args.findIndex((arg) => arg.startsWith("--" + argType));
        if (argumentIndex !== -1) {
            return this.args[argumentIndex + 1];            
        }
        return null;
    }

    public getArguments(): Arguments {
        return this.arguments;
    }
}