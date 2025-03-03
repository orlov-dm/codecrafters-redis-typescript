export namespace RDBStorage {
    export const MAGIC_STRING = 'REDIS';
    export const MAGIC_STRING_VER = '0011';
    export const REDIS_VER_PARAM = 'redis-ver';
    export const REDIS_VER = '6.0.16';

    export const METADATA_SECTION_FLAG: number = 0xFA;
    export const MAGIC_STRING_POS = [0, 5];
    export const MAGIC_STRING_VERSION_POS = [5, 9];
    export const METADATA_SECTION_TYPE_POS = [9, 10];

    export const DATABASE_SECTION_FLAG: number = 0xFE;
    export const DATABASE_SIZE_SECTION_FLAG: number = 0xFB;

    export const EOF_FLAG: number = 0xFF;
    export const SOURCE_ENCODING = 'utf-8';

    export const STRING_TYPE: number = 0x00;
}