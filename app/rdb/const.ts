export namespace RDBStorage {
    export const MAGIC_STRING = 'REDIS';
    export const MAGIC_STRING_VER = '0011';
    export const REDIS_VER_PARAM = 'redis-ver';
    export const REDIS_VER = '6.0.16';

    export const METADATA_SECTION_FLAG: number = 0xfa;

    export const DATABASE_SECTION_FLAG: number = 0xfe;
    export const DATABASE_SIZE_SECTION_FLAG: number = 0xfb;

    export const EOF_FLAG: number = 0xff;
    export const SOURCE_ENCODING = 'utf-8';

    export const STRING_TYPE: number = 0x00;

    export const EXPIRY_MILISECONDS_FLAG = 0xfc;
    export const EXPIRY_SECONDS_FLAG = 0xfd;
}
