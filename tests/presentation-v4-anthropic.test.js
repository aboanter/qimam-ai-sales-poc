'use strict';
const assert=require('assert');
const {callAnthropicArtDirector,firstText,API_URL}=require('../presentation-v4-anthropic');

(async()=>{
  let captured=null;
  const fakeFetch=async(url,options)=>{
    captured={url,options,body:JSON.parse(options.body)};
    return new Response(JSON.stringify({
      model:'claude-test',
      usage:{input_tokens:111,output_tokens:44},
      content:[{type:'text',text:'```json\n{"title":"X","components":[{"type":"kpi","title":"T","dataset":"sales","field":"amount_total:sum"}]}\n```'}]
    }),{status:200,headers:{'content-type':'application/json'}});
  };
  const out=await callAnthropicArtDirector({prompt:'PROMPT',apiKey:'test-key',fetchImpl:fakeFetch,maxTokens:800,timeoutMs:5000});
  assert.strictEqual(captured.url,API_URL);
  assert.strictEqual(captured.options.method,'POST');
  assert.strictEqual(captured.options.headers['x-api-key'],'test-key');
  assert.strictEqual(captured.body.max_tokens,800);
  assert.strictEqual(captured.body.temperature,0);
  assert.ok(/Never serialize dataset rows/.test(captured.body.system));
  assert.strictEqual(out.manifest.components[0].dataset,'sales');
  assert.strictEqual(out.usage.output_tokens,44);
  assert.strictEqual(firstText({content:[{type:'text',text:'ok'}]}),'ok');
  assert.throws(()=>firstText({content:[]}),/no text block/i);

  const badFetch=async()=>new Response(JSON.stringify({error:{message:'bad request'}}),{status:400,headers:{'content-type':'application/json'}});
  await assert.rejects(()=>callAnthropicArtDirector({prompt:'x',apiKey:'k',fetchImpl:badFetch}),/bad request/);
  await assert.rejects(()=>callAnthropicArtDirector({prompt:'x',apiKey:'',fetchImpl:fakeFetch}),/API_KEY/);
  console.log('presentation-v4-anthropic tests: OK');
})().catch(e=>{console.error(e);process.exit(1)});
