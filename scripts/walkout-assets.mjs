// Builds the 3D walkout assets in public/walkout from two free CC0 packs by Quaternius:
//   Universal Base Characters (Standard) https://quaternius.itch.io/universal-base-characters
//   Universal Animation Library (Standard) https://quaternius.itch.io/universal-animation-library
// Unzip both into one folder as cx/ and ax/, then run:
//   npm i --no-save @gltf-transform/core@4.1.1 @gltf-transform/extensions@4.1.1 @gltf-transform/functions@4.1.1 meshoptimizer@0.22.0
//   node scripts/walkout-assets.mjs <folder> public/walkout Idle_Loop,Walk_Formal_Loop,Jump_Loop
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, textureCompress, resample, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { copyFileSync, mkdirSync, statSync } from 'node:fs';
const root = `${process.argv[2].replace(/\/$/, '')}/`;
const base = `${root}cx/Universal Base Characters[Standard]/Base Characters/Godot - UE/`;
const tex = `${root}cx/Universal Base Characters[Standard]/Base Characters/Textures/`;
const hairDir = `${root}cx/Universal Base Characters[Standard]/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/`;
const out = process.argv[3];
mkdirSync(out, { recursive: true });
// The glTF files name a few textures differently from the files on disk.
copyFileSync(`${tex}T_Hair_1_Normal.png`, `${base}T_Hair_1_Normal_png.png`);
copyFileSync(`${tex}T_Eye_Normal.png`, `${base}T_Eye_Normal_png.png`);
copyFileSync(`${tex}T_Superhero_Male_Ligh.png`, `${base}T_Superhero_Male_Dark.png`);
copyFileSync(`${tex}T_Superhero_Female_Light_BaseColor.png`, `${base}T_Superhero_Female_Dark_BaseColor.png`);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
async function write(doc, name, size) {
  for (const material of doc.getRoot().listMaterials()) {
    // Roughness comes from a constant: the map adds a megabyte for little at walkout size.
    const mr = material.getMetallicRoughnessTexture();
    if (mr) { material.setMetallicRoughnessTexture(null); material.setRoughnessFactor(0.62); }
  }
  await doc.transform(prune(), dedup(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [size, size], quality: 82 }));
  await io.write(`${out}/${name}.glb`, doc);
  console.log(name, Math.round(statSync(`${out}/${name}.glb`).size / 1024), 'KB');
}
await write(await io.read(`${base}Superhero_Male_FullBody.gltf`), 'body-men', 1024);
await write(await io.read(`${base}Superhero_Female_FullBody.gltf`), 'body-women', 1024);
for (const hair of ['Hair_SimpleParted', 'Hair_Buzzed', 'Hair_BuzzedFemale', 'Hair_Long', 'Hair_Buns', 'Hair_Beard']) {
  await write(await io.read(`${hairDir}${hair}.gltf`), hair.toLowerCase().replace('_', '-'), 512);
}
// Clips only: the mannequin mesh of the library is dropped.
const anims = await io.read(`${root}ax/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb`);
const keep = new Set(process.argv[4].split(','));
// Samplers hold their accessors; they go with the animation, or the file keeps every unused clip's keys.
for (const a of anims.getRoot().listAnimations()) if (!keep.has(a.getName())) { for (const sampler of a.listSamplers()) sampler.dispose(); for (const channel of a.listChannels()) channel.dispose(); a.dispose(); }
for (const n of anims.getRoot().listNodes()) if (n.getMesh()) { n.getMesh().dispose(); n.setMesh(null); n.setSkin(null); }
for (const s of anims.getRoot().listSkins()) s.dispose();
// Bones only rotate; position and scale tracks are kept for the root and pelvis alone.
for (const a of anims.getRoot().listAnimations()) for (const c of a.listChannels()) {
  const name = c.getTargetNode()?.getName() ?? '';
  if (c.getTargetPath() !== 'rotation' && !/^(root|pelvis)$/.test(name)) { c.getSampler()?.dispose(); c.dispose(); }
  else if (/_0[34]_|_leaf/.test(name)) { c.getSampler()?.dispose(); c.dispose(); }
}
await MeshoptEncoder.ready;
await anims.transform(resample({ tolerance: 2e-4 }), prune({ keepLeaves: true }), dedup(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
io.registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
await io.write(`${out}/clips.glb`, anims);
console.log('clips', Math.round(statSync(`${out}/clips.glb`).size / 1024), 'KB');
