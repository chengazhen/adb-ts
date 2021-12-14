import { SettingsMode, PrimitiveType, stringToType } from '../..';
import TransportParseAllCommand from '../transport-parse-all-command';

export default class GetSetting extends TransportParseAllCommand {
    protected parse(value: string) {
        return stringToType(value);
    }

    execute(
        serial: string,
        mode: SettingsMode,
        name: string
    ): Promise<PrimitiveType> {
        return super.execute(serial, 'shell:settings get', mode, name);
    }
}
