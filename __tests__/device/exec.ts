import { Client } from '../../lib/client';
import { Device } from '../../lib/device';
import { AdbExecError } from '../../lib/util';
import { mockExec } from '../../mockery/execMock';

const device = new Device(new Client({ noAutoStart: true }), {
    id: 'serial',
    state: 'device',
    path: 'path',
    device: 'device',
    model: 'model',
    product: 'product',
    transportId: 'transportId',
    transport: 'usb'
});

describe('Device exec tests', () => {
    it('Should execute without error', async () => {
        mockExec(null, '', '');
        const result = await device.exec('cmd');
        expect(result).toBe('');
    });

    it('Should execute with error', async () => {
        mockExec(new Error('message'), '', '');
        await expect(() => device.exec('cmd')).rejects.toThrowError(
            new Error('message')
        );
    });

    it('Should execute with std error', async () => {
        mockExec(null, '', 'message');
        try {
            await device.exec('cmd');
        } catch (e: any) {
            expect(e.message).toBe('message');
            expect(e.command).toBe('-s serial cmd');
            expect(e).toBeInstanceOf(AdbExecError);
        }
    });

    it('Should execute with std out matching error reg exp', async () => {
        mockExec(null, 'Error: message', '');
        try {
            await device.exec('cmd');
        } catch (e: any) {
            expect(e.message).toBe('Error: message');
            expect(e.command).toBe('-s serial cmd');
            expect(e).toBeInstanceOf(AdbExecError);
        }
    });
});