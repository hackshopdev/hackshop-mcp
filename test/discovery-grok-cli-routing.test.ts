import { describe, it, expect } from 'vitest';
import { runDiscovery } from '../scripts/discoveries/run.js';
const grok = await import('../scripts/discoveries/grok.js');
const future = grok as typeof grok & Record<string, any>;

describe('CLI-only GrokBot research', () => {
  it('routes a daily run through the CLI even when legacy Gateway settings are supplied', async () => {
    let sends = 0; let networkCalls = 0; let receipt: any;
    const queue = {
      begin: async () => ({ run: { id: 'd1bf8e33-d398-47cd-ad1f-2f9a9d745984', status: 'running', checkpoints: {}, provider_status: {}, grok_receipt: null }, replayed: false }),
      pending: async () => ({ runs: [], candidates: [] }),
      checkpoint: async (input: any) => { if (input.patch.grok_receipt) receipt = input.patch.grok_receipt; },
      reserveGrok: async () => ({ allowed: true, replayed: false }), finish: async () => ({}),
    };
    const result = await runDiscovery({ queue, queries: Array.from({length:6},(_,i)=>({id:`query-${i}`,query:'hardware'})), examples: [], now: new Date('2026-10-14T12:00:00Z'), leaseOwner: 'test',
      gateway: { apiKey: 'obsolete-test-only', capsVerified: false },
      providerFetch: async () => { networkCalls++; throw Error('Direct provider contact forbidden'); },
      grok: { cli: async (args: string[]) => { if(args[0] === 'check-config') return {exitCode:0,stdout:'{"configured":true}'}; sends++; return {exitCode:0,stdout:'{"request_id":"discovery_20261014","status":"accepted"}'}; } },
    } as any);
    expect(sends).toBe(1); expect(networkCalls).toBe(0);
    expect(receipt.provider).toBe('grokbot_webhook'); expect(receipt.status).toBe('accepted');
    expect(result.provider_status.grok).toBe('accepted');
  });
  it('reserves and persists a known request ID before spawning the send command', async () => {
    const order: string[] = [];
    const receipt = await future.sendGrokCliRequest?.({
      requestId: 'discovery_20261014', task: 'Public hardware only', now: new Date('2026-10-14T12:00:00Z'),
      reserve: async () => { order.push('reserve'); return { allowed: true, replayed: false }; },
      persist: async (value: any) => { order.push(value.status); },
      cli: async (args: string[], options: any) => {
        if (args[0] === 'check-config') return { exitCode: 0, stdout: JSON.stringify({ configured: true }) };
        order.push('cli-send');
        expect(args).toEqual(['send', '--request-id', 'discovery_20261014', '--task-stdin', '--wait', '0', '--keep-remote', '--json']);
        expect(options.input).toBe('Public hardware only');
        expect(args).not.toContain('Public hardware only');
        return { exitCode: 0, stdout: JSON.stringify({ request_id: 'discovery_20261014', status: 'accepted', http_status: 200, provider_run_id: '49ad95f9-40d1-469c-bfbc-357eaf0aa5b6' }) };
      },
    });
    expect(order).toEqual(['reserve', 'sending', 'cli-send', 'accepted']);
    expect(receipt.status).toBe('accepted');
    expect(receipt.provider).toBe('grokbot_webhook');
    expect(receipt).not.toHaveProperty('result');
  });
  it('does not send when a durable attempt already exists or credentials are missing', async () => {
    for (const configured of [true, false]) {
      let sends = 0; let reserves = 0;
      const result = await future.sendGrokCliRequest?.({
        requestId: 'discovery_20261014', task: 'Public hardware only', now: new Date(),
        reserve: async () => { reserves++; return { allowed: true, replayed: true }; }, persist: async () => {},
        cli: async (args: string[]) => { if(args[0] === 'send') sends++; return { exitCode: 0, stdout: JSON.stringify({ configured }) }; },
      });
      expect(result?.status).toBe(configured ? 'replayed' : 'unavailable');
      expect(sends).toBe(0); expect(reserves).toBe(configured ? 1 : 0);
    }
  });
  it('keeps ambiguous CLI acceptance unknown without retrying', async () => {
    let sends = 0; const states: string[] = [];
    const result = await future.sendGrokCliRequest?.({
      requestId: 'discovery_20261014', task: 'Hardware', now: new Date(),
      reserve: async () => ({ allowed: true }), persist: async (receipt: any) => { states.push(receipt.status); },
      cli: async (args: string[]) => { if(args[0] === 'check-config') return { exitCode: 0, stdout: '{"configured":true}' }; sends++; throw new Error('secret-bearing provider timeout'); },
    });
    expect(result?.status).toBe('send_unknown'); expect(sends).toBe(1);
    expect(states).toEqual(['sending', 'send_unknown']);
  });
  it.each([
    { exitCode: 1, value: { error: 'invalid_configuration' } },
    { exitCode: 1, value: { status: 'accepted' } },
    { exitCode: 0, value: { status: 'unexpected_status' } },
    { exitCode: 0, value: {} },
  ])('does not invent acceptance for an invalid CLI acknowledgement: %j', async ({ exitCode, value }) => {
    const states: string[] = [];
    const result = await future.sendGrokCliRequest({
      requestId: 'discovery_20261014', task: 'Hardware', now: new Date(),
      reserve: async () => ({ allowed: true }), persist: async (receipt: any) => { states.push(receipt.status); },
      cli: async (args: string[]) => args[0] === 'check-config'
        ? { exitCode: 0, stdout: '{"configured":true}' }
        : { exitCode, stdout: JSON.stringify({ request_id: 'discovery_20261014', ...value }) },
    });
    expect(result.status).toBe('send_unknown');
    expect(states).toEqual(['sending', 'send_unknown']);
  });
  it('does not reserve or send after a failed CLI configuration check', async () => {
    let reserves = 0; let writes = 0; let sends = 0;
    const result = await future.sendGrokCliRequest({
      requestId: 'discovery_20261014', task: 'Hardware', now: new Date(),
      reserve: async () => { reserves++; return { allowed: true }; }, persist: async () => { writes++; },
      cli: async (args: string[]) => { if (args[0] !== 'check-config') sends++; return { exitCode: 1, stdout: '{"configured":true}' }; },
    });
    expect(result.status).toBe('unavailable');
    expect(reserves + writes + sends).toBe(0);
  });
  it('recovers a relay reply via stateless CLI and ingests it before terminal state', async () => {
    const order: string[] = [];
    const result = await future.harvestGrokCliResult?.({
      requestId: 'discovery_20261014',
      cli: async (args: string[]) => { expect(args).toEqual(['status', '--request-id', 'discovery_20261014', '--remote', '--keep-remote', '--json']); order.push('cli-status'); return { exitCode: 0, stdout: JSON.stringify({ request_id: 'discovery_20261014', status: 'completed', result: { posts: [{ url: 'https://x.com/wesbos/status/2110012409582874908', note: 'Author linked a photo-frame guide' }] } }) }; },
      ingest: async (result: any) => { expect(result.posts).toHaveLength(1); order.push('ingest'); },
      complete: async () => { order.push('complete'); },
    });
    expect(result?.status).toBe('completed'); expect(order).toEqual(['cli-status', 'ingest', 'complete']);
  });
  it('keeps a pending callback pending and rejects a different request identity', async () => {
    let writes = 0;
    const base = { requestId: 'discovery_20261014', ingest: async () => { writes++; }, complete: async () => { writes++; } };
    expect((await future.harvestGrokCliResult?.({ ...base, cli: async () => ({ exitCode: 0, stdout: '{"request_id":"discovery_20261014","status":"pending"}' }) }))?.status).toBe('pending');
    expect(writes).toBe(0);
    await expect(future.harvestGrokCliResult?.({ ...base, cli: async () => ({ exitCode: 0, stdout: '{"request_id":"different_request","status":"completed","result":{}}' }) })).rejects.toThrow('cli_request_identity_mismatch');
  });
  it('queues every bounded callback lead before completion while researching only five', async () => {
    const receipts = ['prior_receipt_one', 'prior_receipt_two'];
    const harvested: any[] = []; let researched = 0; let reads = 0;
    const queue = {
      begin: async () => ({ run: { id: 'd1bf8e33-d398-47cd-ad1f-2f9a9d745984', status: 'running', checkpoints: {}, provider_status: {}, grok_receipt: { request_id: 'discovery_20261014', status: 'accepted' } }, replayed: false }),
      pending: async () => ({ runs: receipts.map((request_id) => ({ checkpoints: {}, grok_receipt: { request_id, status: 'accepted', provider: 'grokbot_webhook' } })), candidates: [] }),
      checkpoint: async () => {}, finish: async () => {},
      harvest: async (input: any) => { harvested.push(input); return { candidates: [] }; },
      ingest: async (input: any) => { if (input.items[0].draft) researched++; return { candidates: [] }; },
    };
    const result = await runDiscovery({ queue, queries: Array.from({length:6},(_,i)=>({id:`query-${i}`,query:'hardware'})), examples: [], now: new Date('2026-10-14T12:00:00Z'), leaseOwner: 'test',
      grok: { cli: async (args: string[]) => {
        expect(args[0]).toBe('status'); reads++;
        const requestId = args[2]; const index = receipts.indexOf(requestId);
        return { exitCode: 0, stdout: JSON.stringify({ request_id: requestId, status: 'completed', result: { posts: Array.from({length:6},(_,i)=>({ url: `https://x.com/maker/status/${2110178596107248127n + BigInt(index * 6 + i)}`, note: 'Rooted photo frame for calendar dashboard' })) } }) };
      } },
      fetchText: async () => { throw new Error('fixture_source_unavailable'); },
    } as any);
    expect(reads).toBe(2);
    expect(harvested.map((input) => input.items.length)).toEqual([6, 6]);
    expect(new Set(harvested.flatMap((input) => input.items.map((item: any) => item.source.url))).size).toBe(12);
    expect(result.candidates).toBe(5); expect(researched).toBe(5);
  });
  it('rotates bounded relay checks so old pending jobs cannot starve newer completions', async () => {
    const checked = new Set<string>();
    const runs = Array.from({length:30},(_,i)=>({ checkpoints: {}, grok_receipt: { request_id: `prior_receipt_${String(i).padStart(3,'0')}`, status: 'pending', provider: 'grokbot_webhook' } }));
    for (const day of [14,15,16]) {
      const queue = {
        begin: async () => ({ run: { id: 'd1bf8e33-d398-47cd-ad1f-2f9a9d745984', status: 'running', checkpoints: {}, provider_status: {}, grok_receipt: { request_id: `discovery_202610${day}`, status: 'accepted' } }, replayed: false }),
        pending: async () => ({ runs, candidates: [] }), checkpoint: async () => {}, finish: async () => {},
      };
      let dailyChecks = 0;
      await runDiscovery({ queue, queries: Array.from({length:6},(_,i)=>({id:`query-${i}`,query:'hardware'})), examples: [], now: new Date(`2026-10-${day}T12:00:00Z`), leaseOwner: 'test',
        grok: { cli: async (args: string[]) => { expect(args[0]).toBe('status'); dailyChecks++; checked.add(args[2]); return { exitCode: 0, stdout: JSON.stringify({ request_id: args[2], status: 'pending' }) }; } },
      } as any);
      expect(dailyChecks).toBe(10);
    }
    expect(checked.size).toBe(30);
  });
});
