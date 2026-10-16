// Kits of the real clubs represented by the game's established fictional aliases.
const KITS: [RegExp,string,string][] = [
 [/real madreto|galácticos/i,'#ffffff','#242424'],[/barcelon/i,'#a50044','#004d98'],
 [/liverp/i,'#c8102e','#ffffff'],[/manchester cité/i,'#6cabdd','#1c2c5b'],
 [/manchester united/i,'#da291c','#ffffff'],[/bayern/i,'#dc052d','#ffffff'],
 [/arsenal/i,'#ef0107','#063672'],[/chelsea/i,'#034694','#ffffff'],
 [/tottenham/i,'#ffffff','#132257'],[/paris/i,'#004170','#e30613'],
 [/inter milan/i,'#0068a8','#ffffff'],[/ac milan/i,'#fb090b','#111111'],
 [/juventus/i,'#ffffff','#111111'],[/dortmund/i,'#fde100','#111111'],
 [/ajax/i,'#d2122e','#ffffff'],[/napoli/i,'#12a0d7','#ffffff'],
 [/young burs|young boys/i,'#f9d800','#111111'],[/basilea|basel/i,'#d50032','#003da5'],
 [/servette/i,'#8b1e41','#ffffff'],[/zurique|zürich/i,'#ffffff','#004b93'],
 [/miami/i,'#f7b5cd','#231f20'],[/benfica/i,'#e83030','#ffffff'],
 [/porto/i,'#0050a4','#ffffff'],[/psv/i,'#ed1c24','#ffffff'],
 [/galatasaray/i,'#fdb912','#a90432'],[/atléti/i,'#cb3524','#272e61']
];
const luminance=(hex:string)=>{const c=hex.replace('#','');const rgb=[0,2,4].map(i=>parseInt(c.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
const contrast=(a:string,b:string)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
export function matchColours(opponent:string,club:string,visiting:boolean) {
 const kit=KITS.find(([name])=>name.test(opponent)),home=kit?.[1]??'#f4c542';
 let own=club,other=home;
 if(contrast(own,other)<2.5){
  if(visiting)own=['#ffffff','#111111'].sort((a,b)=>contrast(b,other)-contrast(a,other))[0];
  else other=[kit?.[2]??'#ffffff','#ffffff','#111111'].sort((a,b)=>contrast(b,own)-contrast(a,own))[0];
 }
 return {club:own,opponent:other};
}
