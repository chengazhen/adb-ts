import Command from '../../command';
import { Reply } from '../..';

export default class ForwardCommand extends Command<void> {
    execute(serial: string, local: string, remote: string): Promise<void> {
        return this.initExecute(
            `host-serial:${serial}:forward:${local};${remote}`
        ).then(
            this.handleReply(() =>
                (this.parser.readAscii(4) as Promise<Reply>).then(
                    this.handleReply(void 0)
                )
            )
        );
    }
}
