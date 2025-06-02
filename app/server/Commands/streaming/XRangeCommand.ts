import { isString } from '../../../data/helpers';
import type { Entry } from '../../../data/Stream';
import type { InternalValueType } from '../../../data/types';
import { BaseCommand, type CommandResponse } from '../BaseCommand';

export class XRangeCommand extends BaseCommand {
    public async process(): Promise<CommandResponse | null> {
        const [streamKey, entryFrom, entryTo] = this.getData();
        console.log('XRange', streamKey, entryFrom, entryTo);
        if (isString(streamKey)) {
            const stream = this.getStorage().getStream(streamKey.value);
            if (!stream) {
                return null;
            }

            if (isString(entryFrom) && isString(entryTo)) {
                const range = stream.getRange(entryFrom.value, entryTo.value);
                const encodedRange = range.map((entry) =>
                    this.encodeEntry(entry)
                );
                return {
                    data: encodedRange,
                };
            }
        }
        return null;
    }

    private encodeEntry(entry: Entry) {
        const data: InternalValueType[] = entry.data.reduce((res, pair) => {
            res.push(pair.key, pair.value);
            return res;
        }, [] as InternalValueType[]);
        return [entry.id, data];
    }
}
