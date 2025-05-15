import { isString } from '../../data/helpers';
import type { Entry } from '../../data/Stream';
import type { InternalValueType } from '../../data/types';
import { BaseCommand } from './BaseCommand';

export class XReadCommand extends BaseCommand {
    public async process(): Promise<string | null> {
        const data = this.getData();
        const streamsIndex = data.findIndex((value) => {
            if (!isString(value)) {
                return false;
            }
            return value.value === 'streams';
        });
        if (streamsIndex === -1) {
            return null;
        }
        const streamKeyEntryIds = data.slice(streamsIndex + 1);
        const streamKeysCount = streamKeyEntryIds.length / 2;
        const streamKeys = streamKeyEntryIds.slice(0, streamKeysCount);
        const entryIds = streamKeyEntryIds.slice(streamKeysCount);

        console.log('XRead', streamKeys, entryIds);
        if (streamKeys.length && entryIds.length) {
            const result: Map<string, Entry[]> = new Map();
            for (let i = 0; i < streamKeys.length; ++i) {
                const streamKey = streamKeys[i];
                const entryId = entryIds[i];
                if (!isString(streamKey) || !isString(entryId)) {
                    continue;
                }
                const stream = this.getStorage().getStream(streamKey.value);
                if (!stream) {
                    continue;
                }

                const range = stream.getRangeExclusive(entryId.value);
                result.set(stream.getKey(), range);
            }
            const encodedRange: EncodedStream[] = [...result.entries()].map(
                ([streamKey, entries]) => {
                    const encodedEntries: EncodedEntry[] = entries.map(
                        (entry) => this.encodeEntry(entry)
                    );
                    return this.encodeStream(streamKey, encodedEntries);
                }
            );
            return this.encode(encodedRange);
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
    ): EncodedStream {
        return [streamKey, encodedEntries];
    }
}

type EncodedEntry = [string, InternalValueType[]];
type EncodedStream = [string, EncodedEntry[]];
