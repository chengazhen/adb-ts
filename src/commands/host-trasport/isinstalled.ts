import { Readable } from 'stream';
import Connection from '../../connection';
import { Reply } from '../..';
import TransportCommand from '../transport';

export default class IsInstalledCommand extends TransportCommand {
    execute(serial: string, pkg: string | Readable) {
        return super
            .execute(serial, `shell:pm path ${pkg} 2>/dev/null`)
            .then((reply) => {
                switch (reply) {
                    case Reply.OKAY:
                        return this.parser
                            .readAscii(8)
                            .then((reply) => {
                                switch (reply) {
                                    case 'package:':
                                        return true;
                                    default:
                                        throw this.parser.unexpected(
                                            reply,
                                            'package:'
                                        );
                                }
                            })
                            .catch((err) => {
                                return false;
                            });
                    case Reply.FAIL:
                        return this.parser.readError().then((e) => {
                            throw e;
                        });
                    default:
                        throw this.parser.unexpected(reply, 'OKAY or FAIL');
                }
            });
    }
}
