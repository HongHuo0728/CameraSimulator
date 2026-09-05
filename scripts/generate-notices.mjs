import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('node_modules');
const dirs=[];
for(const name of await fs.readdir(root)){
  if(name.startsWith('.'))continue;
  if(name.startsWith('@'))for(const child of await fs.readdir(path.join(root,name)))dirs.push(path.join(name,child));
  else dirs.push(name);
}
const notices=['Third-party notices for locally installed CameraSimulator dependencies.','Individual packages retain their own copyright and license.',''];
for(const name of dirs.sort()){
  const dir=path.join(root,name);
  try{
    const pkg=JSON.parse(await fs.readFile(path.join(dir,'package.json'),'utf8'));
    const files=(await fs.readdir(dir)).filter(n=>/^(licen[sc]e|notice|copying)(\.|$)/i.test(n));
    notices.push(`\n${'='.repeat(72)}\n${pkg.name} ${pkg.version}\nLicense: ${typeof pkg.license==='string'?pkg.license:JSON.stringify(pkg.license??pkg.licenses??'See package source')}\n`);
    for(const file of files)if((await fs.stat(path.join(dir,file))).isFile())notices.push(await fs.readFile(path.join(dir,file),'utf8'));
  }catch{}
}
await fs.writeFile('THIRD-PARTY-NOTICES.txt',notices.join('\n'));
