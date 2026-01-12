
const qs=s=>document.querySelector(s);
let HEAD={},PICTO={},selectedPic=null;
document.addEventListener('DOMContentLoaded',()=>{if(qs('#continue'))initIndex();if(qs('#baRoot'))initEditor();});
function getHEAD(){try{return JSON.parse(localStorage.getItem('BA_HEAD')||'{}')}catch{return{}}}
function setHEAD(h){localStorage.setItem('BA_HEAD',JSON.stringify(h))}
function initIndex(){qs('#continue').onclick=e=>{e.preventDefault();HEAD={type:document.querySelector('input[name="type"]:checked').value||'Maschine',logoUrl:qs('#logoUrl').value||'',title:{assetName:qs('#assetName').value||''}};setHEAD(HEAD);location.href='/editor'}}
function initEditor(){HEAD=getHEAD();fetch('/assets/pictos_index_inline.json').then(r=>r.json()).then(j=>{PICTO=j;renderPicList()});qs('#exportDocx').onclick=makeDocx}
function renderPicList(){const list=qs('#picList');list.innerHTML='';Object.keys(PICTO).forEach(g=>{Object.keys(PICTO[g]).forEach(code=>{const p=PICTO[g][code];const row=document.createElement('div');row.className='picrow';const img=document.createElement('img');img.src=p.thumbDataUrl;img.width=32;img.height=32;row.appendChild(img);row.appendChild(document.createTextNode(code+' '+p.name));row.onclick=()=>selectedPic=p;list.appendChild(row)})})}
function arrayBufferFromDataUrl(d){const b=d.split(',')[1],bin=atob(b),len=bin.length,u=new Uint8Array(len);for(let i=0;i<len;i++)u[i]=bin.charCodeAt(i);return u.buffer}
async function makeDocx(){if(!window.docx){alert('DOCX fehlt');return}const{Document,Packer,Paragraph,TextRun,ImageRun}=window.docx;const paras=[new Paragraph({children:[new TextRun({text:'Betriebsanweisung',bold:true,size:28})]})];if(selectedPic){const ab=arrayBufferFromDataUrl(selectedPic.fullDataUrl);paras.push(new Paragraph({children:[new ImageRun({data:ab,transformation:{width:64,height:64}})]}))}const doc=new Document({sections:[{children:paras}]});const blob=await Packer.toBlob(doc);const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='Betriebsanweisung.docx';a.click()}
