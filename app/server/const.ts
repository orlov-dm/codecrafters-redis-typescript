export namespace DefaultArguments {
    export const DEFAULT_DIR = '/tmp/redis-files';
    export const DEFAULT_DB_FILENAME = 'dump.rdb';
    export const DEFAULT_PORT = 6379;
    export const DEFAULT_REPLICAOF = '';
}

export namespace Commands {
    export const PING_CMD = 'ping';
    export const ECHO_CMD = 'echo';
    export const GET_CMD = 'get';
    export const SET_CMD = 'set';
    export const CONFIG_CMD = 'config';
    export const CONFIG_DIR_CMD = 'dir';
    export const CONFIG_DB_FILENAME_CMD = 'dbfilename';
    export const KEYS_CMD = 'keys';
    export const INFO_CMD = 'info';
    export const INFO_REPLICATION_CMD = 'replication';
    export const REPLCONF_CMD = 'replconf';
    export const REPLCONF_LISTENING_PORT_CMD = 'listening-port';
    export const REPLCONF_CAPABILITIES_CMD = 'capa';
    export const PSYNC_CMD = 'psync'
}

export namespace Responses {
    export const RESPONSE_OK = 'OK';
    export const RESPONSE_PONG = 'PONG';
    export const RESPONSE_FULLRESYNC = 'FULLRESYNC';
}

export const UNKNOWN = '?';
export const LOCALHOST = '127.0.0.1';
