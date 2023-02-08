import { AdbMock } from '../../mockery/mockAdbServer';
import { Client } from '../../lib/client';
import { UnexpectedDataError } from '../../lib/util';
import { Readable } from 'stream';

describe('Push data to file', () => {
    it('Success with string data', async () => {
        const buff = Buffer.from([0, 0, 0, 4]);
        const adbMock = new AdbMock([
            { cmd: 'host:transport:serial', res: null, rawRes: true },
            {
                cmd: 'sync:',
                res: 'OKAY' + buff.toString(),
                rawRes: true
            }
        ]);
        try {
            const port = await adbMock.start();
            const adb = new Client({ noAutoStart: true, port });
            const result = await adb.pushDataToFile('serial', 'data', 'dest');
            expect(result).toBeUndefined();
        } finally {
            await adbMock.end();
        }
    });

    it('Success with buffer data', async () => {
        const buff = Buffer.from([0, 0, 0, 4]);
        const adbMock = new AdbMock([
            { cmd: 'host:transport:serial', res: null, rawRes: true },
            {
                cmd: 'sync:',
                res: 'OKAY' + buff.toString(),
                rawRes: true
            }
        ]);
        try {
            const port = await adbMock.start();
            const adb = new Client({ noAutoStart: true, port });
            const result = await adb.pushDataToFile(
                'serial',
                Buffer.from('data', 'utf-8'),
                'dest'
            );
            expect(result).toBeUndefined();
        } finally {
            await adbMock.end();
        }
    });

    it('Success with readable data', async () => {
        const buff = Buffer.from([0, 0, 0, 4]);
        const adbMock = new AdbMock([
            { cmd: 'host:transport:serial', res: null, rawRes: true },
            {
                cmd: 'sync:',
                res: 'OKAY' + buff.toString(),
                rawRes: true
            }
        ]);
        try {
            const port = await adbMock.start();
            const adb = new Client({ noAutoStart: true, port });
            const result = await adb.pushDataToFile(
                'serial',
                Readable.from('data'),
                'dest'
            );
            expect(result).toBeUndefined();
        } finally {
            await adbMock.end();
        }
    });

    it('FAIL', async () => {
        const buff = Buffer.from([5, 0, 0, 0]);
        const adbMock = new AdbMock([
            { cmd: 'host:transport:serial', res: null, rawRes: true },
            {
                cmd: 'sync:',
                res: 'FAIL' + buff.toString() + 'Error',
                rawRes: true
            }
        ]);
        try {
            const port = await adbMock.start();
            const adb = new Client({ noAutoStart: true, port });
            try {
                await adb.pushDataToFile(
                    'serial',
                    Readable.from('data'),
                    'dest'
                );
                fail('Expected failure');
            } catch (e: any) {
                expect(e).toEqual(new Error('Error'));
            }
        } finally {
            await adbMock.end();
        }
    });

    it('Unexpected error', async () => {
        const buff = Buffer.from([5, 0, 0, 0]);
        const adbMock = new AdbMock([
            { cmd: 'host:transport:serial', res: null, rawRes: true },
            {
                cmd: 'sync:',
                res: 'UNEX' + buff.toString() + 'Error',
                rawRes: true
            }
        ]);
        try {
            const port = await adbMock.start();
            const adb = new Client({ noAutoStart: true, port });
            try {
                await adb.pushDataToFile(
                    'serial',
                    Readable.from('data'),
                    'dest'
                );
                fail('Expected failure');
            } catch (e: any) {
                expect(e).toEqual(
                    new UnexpectedDataError('UNEX', 'OKAY or FAIL')
                );
            }
        } finally {
            await adbMock.end();
        }
    });
});