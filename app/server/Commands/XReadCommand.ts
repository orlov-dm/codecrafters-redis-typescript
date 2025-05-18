import type { Encoder } from '../../data/Encoder';
import type { Storage } from '../../data/Storage';
import { isString } from '../../data/helpers';
import type { Entry } from '../../data/Stream';
import type { Data, InternalValueType } from '../../data/types';
import { BaseCommand } from './BaseCommand';
import { isNull } from 'util';

export class XReadCommand extends BaseCommand {
    private waitingStreams: Set<string> = new Set();
    constructor(encoder: Encoder, storage: Storage, commandData: Data[] = []) {
        super(encoder, storage, commandData);
    }

    public async process(): Promise<string | null> {
        const data = this.getData();
        const streamsIndex = data.findIndex((value) => {
            if (!isString(value)) {
                return false;
            }
            return value.value.toLowerCase() === 'streams';
        });
        if (streamsIndex === -1) {
            return null;
        }
        const blockIndex = data.findIndex((value) => {
            if (!isString(value)) {
                return false;
            }
            return value.value.toLowerCase() === 'block';
        });
        const blockMs: number | null =
            blockIndex !== -1 && isString(data[blockIndex + 1])
                ? Number(data[blockIndex + 1].value)
                : null;

        const streamKeyEntryIds = data.slice(streamsIndex + 1);
        const streamKeysCount = streamKeyEntryIds.length / 2;
        const streamKeysData = streamKeyEntryIds.slice(0, streamKeysCount);
        const entryIdsData = streamKeyEntryIds.slice(streamKeysCount);

        console.log('XRead', streamKeysData, entryIdsData);
        if (streamKeysData.length && entryIdsData.length) {
            const streamKeys = streamKeysData
                .map((streamKeyData) =>
                    isString(streamKeyData) ? streamKeyData.value : null
                )
                .filter((streamKey) => !!streamKey) as string[];
            let entryIds: (string | null)[] = entryIdsData
                .map((entryIdData) =>
                    isString(entryIdData) ? entryIdData.value : null
                )
                .filter((entryId) => !!entryId) as string[];
            if (blockMs !== null) {
                entryIds = await this.blockThread(
                    blockMs,
                    streamKeys,
                    entryIds
                );
            }

            const result: Map<string, Entry[]> = new Map();
            for (let i = 0; i < streamKeys.length; ++i) {
                const streamKey = streamKeys[i];
                const entryId = entryIds[i] ?? '-';
                const stream = this.getStorage().getStream(streamKey);
                if (!stream) {
                    continue;
                }

                const range = stream.getRangeExclusive(entryId);
                result.set(stream.getKey(), range);
            }
            const encodedRange: EncodedStream[] = [...result.entries()]
                .map(([streamKey, entries]) => {
                    const encodedEntries: EncodedEntry[] = entries.map(
                        (entry) => this.encodeEntry(entry)
                    );
                    return this.encodeStream(streamKey, encodedEntries);
                })
                .filter((encodedStream) => !!encodedStream);
            return this.encode(encodedRange.length ? encodedRange : null);
        }
        return null;
    }

    private encodeEntry(entry: Entry): [string, InternalValueType[]] {
        const data: InternalValueType[] = entry.data.reduce((res, pair) => {
            res.push(pair.key, pair.value);
            return res;
        }, [] as InternalValueType[]);
        return [entry.id, data];
    }

    private encodeStream(
        streamKey: string,
        encodedEntries: EncodedEntry[]
    ): EncodedStream | null {
        if (!encodedEntries.length) {
            return null;
        }
        return [streamKey, encodedEntries];
    }

    private async blockThread(
        ms: number,
        streamKeys: string[],
        entryIds: (string | null)[]
    ): Promise<(string | null)[]> {
        if (entryIds.every((entryId) => entryId === '$')) {
            let newEntryIds: (string | null)[] = [];
            for (let i = 0; i < streamKeys.length; ++i) {
                const streamKey = streamKeys[i];
                const latestEntry =
                    this.getStorage().getStream(streamKey)?.getLatestEntry() ??
                    null;
                newEntryIds[i] = latestEntry?.id ?? null;
            }
            entryIds = newEntryIds;
        }
        if (ms === 0 && streamKeys.length) {
            const storage = this.getStorage();
            streamKeys.forEach((streamKey) => {
                this.waitingStreams.add(streamKey);
                storage.addStreamAddObserver(streamKey, () =>
                    this.waitingStreams.delete(streamKey)
                );
            });

            return new Promise((resolve) => {
                let count = 0;
                setInterval(() => {
                    if (!(count % 10)) {
                        console.log('Waiting for ms: ', count * 100);
                    }
                    if (!this.waitingStreams.size) {
                        resolve(entryIds);
                    }
                    ++count;
                }, 100);
            });
        }

        return new Promise((resolve) => {
            setTimeout(() => resolve(entryIds), ms);
        });
    }
}

type EncodedEntry = [string, InternalValueType[]];
type EncodedStream = [string, EncodedEntry[]];
