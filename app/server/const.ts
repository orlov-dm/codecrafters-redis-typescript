export namespace DefaultArguments {
    export const DEFAULT_DIR = '/tmp/redis-files';
    export const DEFAULT_DB_FILENAME = 'dump.rdb';
    export const DEFAULT_PORT = 6379;
    export const DEFAULT_REPLICAOF = '';
}

export enum Command {
    PING_CMD = 'PING',
    ECHO_CMD = 'ECHO',
    GET_CMD = 'GET',
    SET_CMD = 'SET',
    CONFIG_CMD = 'CONFIG',
    KEYS_CMD = 'KEYS',
    INFO_CMD = 'INFO',
    INFO_REPLICATION_CMD = 'replication',
    REPLCONF_CMD = 'REPLCONF',
    REPLCONF_LISTENING_PORT_CMD = 'listening-port',
    REPLCONF_CAPABILITIES_CMD = 'capa',
    REPLCONF_GETACK_CMD = 'GETACK',
    PSYNC_CMD = 'PSYNC',
    WAIT_CMD = 'WAIT',
    TYPE_CMD = 'TYPE',
    XADD_CMD = 'XADD',
    XRANGE_CMD = 'XRANGE',
    XREAD_CMD = 'XREAD',
    INCR_CMD = 'INCR',
    MULTI_CMD = 'MULTI',
    DISCARD_CMD = 'DISCARD',
    EXEC_CMD = 'EXEC',
    RPUSH_CMD = 'RPUSH',
    LPUSH_CMD = 'LPUSH',
    LRANGE_CMD = 'LRANGE',
    LLEN_CMD = 'LLEN',
}

export enum ConfigArgs {
    DIR = 'dir',
    DB_FILENAME = 'dbfilename',
}

export namespace Responses {
    export const RESPONSE_OK = 'OK';
    export const RESPONSE_PONG = 'PONG';
    export const RESPONSE_FULLRESYNC = 'FULLRESYNC';
    export const RESPONSE_ACK = 'ACK';
    export const RESPONSE_QUEUED = 'QUEUED';
}

export const UNKNOWN = '?';
export const LOCALHOST = '127.0.0.1';
