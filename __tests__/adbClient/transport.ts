import AdbClient from '../../lib/client';
import Connection from '../../lib/connection';
import { mockServer } from '../../mockery/mockAdbServer';

describe('Transport tests', () => {
    it('OKAY', async () => {
        const { port, done } = await mockServer({
            expValue: 'host:transport:1234'
        });
        try {
            const client = new AdbClient({
                noAutoStart: true,
                port
            });
            const connection = await client.transport('1234');
            expect(connection).toBeInstanceOf(Connection);
        } finally {
            await done();
        }
    });

    it('FAIL', async () => {
        const { port, done } = await mockServer({
            expValue: 'host:transport:1234'
        });
        try {
            const client = new AdbClient({
                noAutoStart: true,
                port
            });
            try {
                await client.transport('5678');
            } catch (e) {
                expect(e.message).toBe('Failure');
            }
        } finally {
            await done();
        }
    });

    it('unexpected', async () => {
        const { port, done } = await mockServer({
            expValue: 'host:transport:1234',
            unexpected: true
        });
        try {
            const client = new AdbClient({
                noAutoStart: true,
                port
            });
            try {
                await client.transport('5678');
            } catch (e) {
                expect(e.message).toBe(
                    "Unexpected 'YOYO', was expecting OKAY or FAIL"
                );
            }
        } finally {
            await done();
        }
    });
});
