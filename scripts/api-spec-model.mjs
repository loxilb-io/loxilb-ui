import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export function productModel(value = process.env.PRODUCT_MODEL ?? 'general') {
  if (!['general', 'kcmvp'].includes(value)) throw new Error('unknown Product model');
  return value;
}
export function specRelative(file, model = productModel()) {
  productModel(model);
  if (!['gateway-swagger.yml','gateway-swagger-extras.yml','oam-swagger.json','SOURCES.json'].includes(file)) throw new Error('unknown model spec');
  return model === 'general' ? `api-spec/${file}` : `api-spec/models/${model}/${file}`;
}
export function verifyModelSpecs(root, model = productModel()) {
  productModel(model);
  const sources = JSON.parse(fs.readFileSync(path.join(root,specRelative('SOURCES.json',model)), 'utf8'));
  const gateway = model === 'general' ? 'https://github.com/loxilb-io/loxilb-inference-gateway' : 'https://github.com/netlox-io/loxilb-igw';
  if (sources.model !== model) throw new Error('wrong-model spec provenance');
  for (const [name,origin,files] of [['gateway',gateway,['gateway-swagger.yml','gateway-swagger-extras.yml']],
                                  ['oam','https://github.com/loxilb-io/loxilb-oam',['oam-swagger.json']]]) {
    const entry = sources[name];
    if (!entry || entry.repository !== origin || entry.repo !== origin.split('/').at(-1) ||
        !/^[0-9a-f]{40}$/.test(entry.commit) || entry.dirty !== false) throw new Error('unverified producer identity');
    for (const file of files) {
      const bytes=fs.readFileSync(path.join(root,specRelative(file,model)));
      if (crypto.createHash('sha256').update(bytes).digest('hex') !== entry.sha256[file]) throw new Error('vendored spec digest drift');
    }
  }
  return sources;
}
