import { AdbMock } from '../../mockery/mockAdbServer';
import { Client } from '../../lib/client';

describe('Root', () => {
    it('OKAY', async () => {
        const adbMock = new AdbMock([
            { cmd: 'host:transport:serial', res: null, rawRes: true },
            { cmd: 'root:', res: 'restarting adbd as root', rawRes: true }
        ]);
        try {
            const port = await adbMock.start();
            const adb = new Client({ noAutoStart: true, port });
            const result = await adb.root('serial');
            expect(result).toBeUndefined();
        } finally {
            await adbMock.end();
        }
    });

    it('OKAY invalid response', async () => {
        const adbMock = new AdbMock([
            { cmd: 'host:transport:serial', res: null, rawRes: true },
            { cmd: 'root:', res: 'invalid', rawRes: true }
        ]);
        try {
            const port = await adbMock.start();
            const adb = new Client({ noAutoStart: true, port });
            try {
                await adb.root('serial');
                fail('Expected Failure');
            } catch (e: any) {
                expect(e).toEqual(new Error('invalid'));
            }
        } finally {
            await adbMock.end();
        }
    });

    it('FAIL first response', async () => {
        const adbMock = new AdbMock([
            { cmd: 'fail', res: null, rawRes: true },
            { cmd: 'root:', res: null, rawRes: true }
        ]);
        try {
            const port = await adbMock.start();
            const adb = new Client({ noAutoStart: true, port });
            try {
                await adb.root('serial');
                fail('Expected Failure');
            } catch (e: any) {
                expect(e).toEqual(new Error('Failure'));
            }
        } finally {
            await adbMock.end();
        }
    });

    it('FAIL second response', async () => {
        const adbMock = new AdbMock([
            { cmd: 'host:transport:serial', res: null, rawRes: true },
            { cmd: 'fail', res: null, rawRes: true }
        ]);
        try {
            const port = await adbMock.start();
            const adb = new Client({ noAutoStart: true, port });
            try {
                await adb.root('serial');
                fail('Expected Failure');
            } catch (e: any) {
                expect(e).toEqual(new Error('Failure'));
            }
        } finally {
            await adbMock.end();
        }
    });

    it('Unexpected first response', async () => {
        const adbMock = new AdbMock([
            {
                cmd: 'host:transport:serial',
                res: null,
                rawRes: true,
                unexpected: true
            },
            { cmd: 'root:', res: null, rawRes: true }
        ]);
        try {
            const port = await adbMock.start();
            const adb = new Client({ noAutoStart: true, port });
            try {
                await adb.root('serial');
                fail('Expected Failure');
            } catch (e: any) {
                expect(e).toEqual(
                    new Error("Unexpected 'UNEX', was expecting OKAY or FAIL")
                );
            }
        } finally {
            await adbMock.end();
        }
    });

    it('Unexpected second response', async () => {
        const adbMock = new AdbMock([
            {
                cmd: 'host:transport:serial',
                res: null,
                rawRes: true
            },
            { cmd: 'root:', res: null, rawRes: true, unexpected: true }
        ]);
        try {
            const port = await adbMock.start();
            const adb = new Client({ noAutoStart: true, port });
            try {
                await adb.root('serial');
                fail('Expected Failure');
            } catch (e: any) {
                expect(e).toEqual(
                    new Error("Unexpected 'UNEX', was expecting OKAY or FAIL")
                );
            }
        } finally {
            await adbMock.end();
        }
    });
});