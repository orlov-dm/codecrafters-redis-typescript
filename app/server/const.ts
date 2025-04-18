export namespace DefaultArguments {
    export const DEFAULT_DIR = '/tmp/redis-files';
    export const DEFAULT_DB_FILENAME = 'dump.rdb';
    export const DEFAULT_PORT = 6379;
    export const DEFAULT_REPLICAOF = '';
}

export enum Command {
    PING_CMD = 'ping',
    ECHO_CMD = 'echo',
    GET_CMD = 'get',
    SET_CMD = 'set',
    CONFIG_CMD = 'config',
    CONFIG_DIR_CMD = 'dir',
    CONFIG_DB_FILENAME_CMD = 'dbfilename',
    KEYS_CMD = 'keys',
    INFO_CMD = 'info',
    INFO_REPLICATION_CMD = 'replication',
    REPLCONF_CMD = 'replconf',
    REPLCONF_LISTENING_PORT_CMD = 'listening-port',
    REPLCONF_CAPABILITIES_CMD = 'capa',
    REPLCONF_GETACK_CMD = 'getack',
    PSYNC_CMD = 'psync',
    WAIT_CMD = 'wait',
}

export namespace Responses {
    export const RESPONSE_OK = 'OK';
    export const RESPONSE_PONG = 'PONG';
    export const RESPONSE_FULLRESYNC = 'FULLRESYNC';
    export const RESPONSE_ACK = 'ACK';
}

export const UNKNOWN = '?';
export const LOCALHOST = '127.0.0.1';
