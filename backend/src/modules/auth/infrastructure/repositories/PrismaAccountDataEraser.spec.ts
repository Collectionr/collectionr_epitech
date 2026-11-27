import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '../../../../generated/prisma/client.js';
import { PrismaAccountDataEraser } from './PrismaAccountDataEraser';

describe('PrismaAccountDataEraser', () => {
  function harness(): {
    eraser: PrismaAccountDataEraser;
    deleteSessions: jest.Mock;
    deleteCollections: jest.Mock;
    stripAuditEmail: jest.Mock;
    transaction: jest.Mock;
  } {
    const deleteSessions = jest.fn().mockReturnValue('sessions-op');
    const deleteCollections = jest.fn().mockReturnValue('collections-op');
    const stripAuditEmail = jest.fn().mockReturnValue('audit-op');
    const transaction = jest.fn().mockResolvedValue([]);
    const prismaClient = {
      session: { deleteMany: deleteSessions },
      collection: { deleteMany: deleteCollections },
      $executeRaw: stripAuditEmail,
      $transaction: transaction,
    } as unknown as PrismaClient;
    return {
      eraser: new PrismaAccountDataEraser(prismaClient),
      deleteSessions,
      deleteCollections,
      stripAuditEmail,
      transaction,
    };
  }

  it("deletes the user's sessions and collections and strips the audit emails, in one transaction", async () => {
    const h = harness();
    const userId = randomUUID();

    await h.eraser.eraseAccountData(userId);

    expect(h.deleteSessions).toHaveBeenCalledWith({ where: { userId } });
    expect(h.deleteCollections).toHaveBeenCalledWith({ where: { userId } });
    expect(h.transaction).toHaveBeenCalledWith(['sessions-op', 'collections-op', 'audit-op']);
    const [strings, ...values] = h.stripAuditEmail.mock.calls[0] as [TemplateStringsArray, string];
    expect(strings.join('?')).toContain('"metadata" - \'email\'');
    expect(strings.join('?')).toContain('"userId" = ?::uuid');
    expect(values).toEqual([userId]);
  });

  it('does not query the database for an id that cannot be a uuid', async () => {
    const h = harness();

    await h.eraser.eraseAccountData('not-a-uuid');

    expect(h.transaction).not.toHaveBeenCalled();
  });

  it('lets a database failure through, so the account stays due and is retried', async () => {
    const h = harness();
    h.transaction.mockRejectedValue(new Error('connection lost'));

    await expect(h.eraser.eraseAccountData(randomUUID())).rejects.toThrow('connection lost');
  });
});
