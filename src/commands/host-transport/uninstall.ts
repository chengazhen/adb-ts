import { UninstallOptions } from '../../util';
import TransportCommand from '../abstract/transport';

export default class UninstallCommand extends TransportCommand<void> {
    protected keepAlive = false;
    protected Cmd = 'shell:pm uninstall';
    protected postExecute(): Promise<void> {
        return this.parser
            .searchLine(/^(Success|Failure.*|.*Unknown package:.*)$/)
            .then(() => {})
            .finally(() => this.parser.readAll());
    }
    execute(
        serial: string,
        pkg: string,
        options?: UninstallOptions
    ): Promise<void> {
        this.Cmd = [this.Cmd]
            .concat(options?.keepCache ? '-k' : [])
            .concat(pkg)
            .join(' ');

        return this.preExecute(serial);
    }
}
