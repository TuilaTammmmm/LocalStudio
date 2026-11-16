import { AutoModelRouter, DEFAULT_AUTO_ROUTE_CONFIG } from '../src/auto-router.js';

async function run() {
  console.log('Testing AutoModelRouter & Vision Routing...');

  // 1. Coding query
  const codeRes = AutoModelRouter.routePrompt('Please write a typescript function to parse json safely');
  if (codeRes.category !== 'coder') throw new Error(`Expected coder, got ${codeRes.category}`);
  console.log(`[Code routing passed]: ${codeRes.targetModel} (${codeRes.category})`);

  // 2. Reasoning query
  const reasonRes = AutoModelRouter.routePrompt('Hãy suy luận logic từng bước để chứng minh định lý này:');
  if (reasonRes.category !== 'reasoner') throw new Error(`Expected reasoner, got ${reasonRes.category}`);
  console.log(`[Reasoner routing passed]: ${reasonRes.targetModel} (${reasonRes.category})`);

  // 3. Vision keyword query
  const visionRes = AutoModelRouter.routePrompt('Hãy đọc sơ đồ trong bức ảnh screenshot này và giải thích luồng dữ liệu');
  if (visionRes.category !== 'vision') throw new Error(`Expected vision, got ${visionRes.category}`);
  console.log(`[Vision keyword routing passed]: ${visionRes.targetModel} (${visionRes.category})`);

  // 4. Vision with hasImageAttachment = true
  const imageAttachRes = AutoModelRouter.routePrompt('What do you think of this design?', 0, true);
  if (imageAttachRes.category !== 'vision') throw new Error(`Expected vision for attachment, got ${imageAttachRes.category}`);
  console.log(`[Vision image attachment routing passed]: ${imageAttachRes.targetModel} (${imageAttachRes.category})`);

  // 5. Heavy context query (> 6000 tokens)
  const heavyRes = AutoModelRouter.routePrompt('Summarize everything', 7500);
  if (heavyRes.category !== 'heavy') throw new Error(`Expected heavy, got ${heavyRes.category}`);
  console.log(`[Heavy context routing passed]: ${heavyRes.targetModel} (${heavyRes.category})`);

  // 6. General fast query
  const genRes = AutoModelRouter.routePrompt('Xin chào, bạn khỏe không?');
  if (genRes.category !== 'general') throw new Error(`Expected general, got ${genRes.category}`);
  console.log(`[General chat routing passed]: ${genRes.targetModel} (${genRes.category})`);

  console.log('All AutoModelRouter tests passed successfully!');
}

run().catch((err) => {
  console.error('AutoModelRouter test failed:', err);
  process.exit(1);
});
