import { expect, it } from 'vitest';
import { runDiscovery } from '../scripts/discoveries/run.js';

it('keeps software hype out and ranks later author hardware builds ahead of early commentary', async () => {
  const post = (id: string, text: string, repository?: string) => ({ rest_id: id, legacy: {
    full_text: text, created_at: 'Wed Oct 14 10:00:00 +0000 2026',
    entities: { urls: repository ? [{ expanded_url: repository }] : [] },
  } });
  const early = [
    post('2110178596107248101', 'A vibecoder released free Word, Excel and PowerPoint clones. REA can reverse engineer any software.'),
    post('2110178596107248102', 'If your software runs 100% client side it is a couple prompts from being fully reverse engineered.'),
    post('2110178596107248103', 'REA is the most dangerous thing on the internet. AI can reverse engineer any software.'),
    post('2110178596107248104', 'Someone used AI to reverse engineer PS5 security in weeks.'),
  ];
  const owners = [
    post('2110178596107248111', 'I rooted my photo frame for a family calendar.', 'https://github.com/maker/frame'),
    post('2110178596107248112', 'I reverse engineered Philips Hue BLE bulbs for local control.', 'https://github.com/maker/bulbs'),
    post('2110178596107248113', 'I built an ESP32 e-ink calendar display.', 'https://github.com/maker/calendar'),
    post('2110178596107248114', 'My Echo Dot now runs Muse on Linux after I repurposed it.', 'https://github.com/maker/echo'),
    post('2110178596107248115', 'I reverse engineered my Apple Watch protocol to pair with Android.', 'https://github.com/maker/watch'),
  ];
  const all = [...early, ...owners];
  const drafts: any[] = []; let finalSeeds: any[] = []; let searches = 0; let hydrations = 0;
  const run = { id: '90ff176e-12f4-4540-ad30-d77826c00117', status: 'running', checkpoints: {}, provider_status: {}, grok_receipt: null };
  const queue = {
    begin: async () => ({run,replayed:false}), pending: async () => ({candidates:[],runs:[]}),
    checkpoint: async (input: any) => { finalSeeds = input.patch.checkpoints?.discovered_posts ?? finalSeeds; return {run}; },
    finish: async () => ({run}), reserve: async () => ({allowed:true,replayed:false}), settle: async () => ({}),
    ingest: async (input: any) => { drafts.push(...input.items.filter((item: any) => item.draft)); return {candidates:[]}; },
  };
  const result = await runDiscovery({ queue:queue as any,
    queries:Array.from({length:6},(_,i)=>({id:`query-${i}`,query:'hardware'})), examples:[],
    now:new Date('2026-10-14T12:00:00Z'), leaseOwner:'test', scrapeKey:'test-only',
    providerFetch: async (input) => {
      const url = new URL(String(input));
      if (url.pathname.includes('credit-balance')) return Response.json({success:true,creditCount:100,credits_charged:1});
      if (url.pathname.includes('search/posts')) return Response.json({success:true,credits_charged:1,posts:searches++ === 0 ? early : owners});
      hydrations++;
      const id = url.searchParams.get('url')!.split('/').at(-1);
      return Response.json({success:true,credits_charged:1,...all.find((item)=>item.rest_id===id)});
    },
    fetchText: async (url) => ({url,text:'# Owner hardware project\nSource implementation and setup notes.',contentType:'text/plain'}),
  });
  expect(result.candidates).toBe(5); expect(searches).toBe(6); expect(hydrations).toBe(5);
  expect(drafts.map((item)=>item.source.url).sort()).toEqual(owners.map((item)=>`https://x.com/i/status/${item.rest_id}`).sort());
  expect(finalSeeds.map((seed)=>seed.id).sort()).toEqual(owners.map((item)=>item.rest_id).sort());
});

it('screens a completed GrokBot callback before adding unrelated software leads to the hardware queue', async () => {
  const queued: any[] = [];
  const run = { id:'90ff176e-12f4-4540-ad30-d77826c00117',status:'running',checkpoints:{},provider_status:{},grok_receipt:{request_id:'current_receipt_test',status:'pending'} };
  const queue = {
    begin:async()=>({run,replayed:false}), checkpoint:async()=>({run}), finish:async()=>({run}),
    pending:async()=>({runs:[{checkpoints:{},grok_receipt:{request_id:'older_receipt_test',status:'pending',provider:'grokbot_webhook'}}],candidates:[]}),
    harvest:async(input:any)=>{queued.push(...input.items);return {candidates:[]};}, ingest:async()=>({candidates:[]}),
  };
  const result=await runDiscovery({queue:queue as any,
    queries:Array.from({length:6},(_,i)=>({id:`query-${i}`,query:'hardware'})),examples:[],now:new Date('2026-10-14T12:00:00Z'),leaseOwner:'test',
    grok:{cli:async()=>({exitCode:0,stdout:JSON.stringify({request_id:'older_receipt_test',status:'completed',result:{posts:[
      {url:'https://x.com/maker/status/2110178596107248101',note:'A vibecoder reverse engineered Word, Excel and PowerPoint clones.'},
      {url:'https://x.com/maker/status/2110178596107248111',note:'I rooted my photo frame for a calendar.'},
    ]}})})},fetchText:async(url)=>({url,text:'# Public hardware project',contentType:'text/plain'}),
  });
  expect(result.candidates).toBe(1);
  expect(queued.map(item=>item.source.url)).toEqual(['https://x.com/i/status/2110178596107248111']);
});
