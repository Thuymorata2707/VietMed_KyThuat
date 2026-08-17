const x=new TextEncoder,b=X();function S({columns:t,filename:e,rows:r,sheetName:l="Bao cao",subtitle:s,title:a}){const c=t.length?t:["Nội dung"],i=w({columns:c,rows:r,subtitle:s,title:a}),n=P([["[Content_Types].xml",T()],["_rels/.rels",k()],["docProps/app.xml",v()],["docProps/core.xml",D()],["xl/workbook.xml",U(l)],["xl/_rels/workbook.xml.rels",C()],["xl/styles.xml",$()],["xl/worksheets/sheet1.xml",i]]),o=new Blob([n],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),m=URL.createObjectURL(o),p=document.createElement("a");p.href=m,p.download=e.endsWith(".xlsx")?e:`${e}.xlsx`,p.click(),URL.revokeObjectURL(m)}function w({columns:t,rows:e,subtitle:r,title:l}){const s=h(t.length),a=[`<row r="1" ht="28" customHeight="1">${f("A1",l,1)}</row>`,`<row r="2" ht="22" customHeight="1">${f("A2",r||"",2)}</row>`,`<row r="4" ht="24" customHeight="1">${t.map((c,i)=>f(`${h(i+1)}4`,c,3)).join("")}</row>`,...e.map((c,i)=>{const n=i+5,o=t.map((m,p)=>I(`${h(p+1)}${n}`,c[p]));return`<row r="${n}">${o.join("")}</row>`})];return d('worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',`
    <sheetViews><sheetView workbookViewId="0"/></sheetViews>
    <sheetFormatPr defaultRowHeight="18"/>
    <cols>${t.map((c,i)=>`<col min="${i+1}" max="${i+1}" width="${F(c)}" customWidth="1"/>`).join("")}</cols>
    <sheetData>${a.join("")}</sheetData>
    <mergeCells count="2"><mergeCell ref="A1:${s}1"/><mergeCell ref="A2:${s}2"/></mergeCells>
    <pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>
  `)}function I(t,e){return typeof e=="number"&&Number.isFinite(e)?`<c r="${t}" s="4"><v>${e}</v></c>`:typeof e=="boolean"?f(t,e?"Có":"Không",4):f(t,e==null?"":String(e),4)}function f(t,e,r){const l=/^\s|\s$|\n/.test(e)?' xml:space="preserve"':"";return`<c r="${t}" t="inlineStr" s="${r}"><is><t${l}>${y(e)}</t></is></c>`}function h(t){let e="",r=t;for(;r>0;){const l=(r-1)%26;e=String.fromCharCode(65+l)+e,r=Math.floor((r-1)/26)}return e}function F(t){const e=Math.max(t.length,8);return Math.min(Math.max(e+4,12),34)}function d(t,e){return`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><${t}>${e}</${t.split(" ")[0]}>`}function T(){return d('Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"',`
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
    <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
    <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
    <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
    <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  `)}function k(){return d('Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"',`
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
    <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
    <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
  `)}function C(){return d('Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"',`
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
    <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  `)}function U(t){return d('workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',`
    <sheets><sheet name="${y(t.slice(0,31)||"Bao cao")}" sheetId="1" r:id="rId1"/></sheets>
  `)}function $(){return d('styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',`
    <fonts count="4">
      <font><sz val="11"/><name val="Calibri"/></font>
      <font><b/><sz val="16"/><color rgb="FF111827"/><name val="Calibri"/></font>
      <font><i/><sz val="11"/><color rgb="FF475569"/><name val="Calibri"/></font>
      <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    </fonts>
    <fills count="3">
      <fill><patternFill patternType="none"/></fill>
      <fill><patternFill patternType="gray125"/></fill>
      <fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/><bgColor indexed="64"/></patternFill></fill>
    </fills>
    <borders count="2">
      <border><left/><right/><top/><bottom/><diagonal/></border>
      <border><left style="thin"><color rgb="FFD9E2EC"/></left><right style="thin"><color rgb="FFD9E2EC"/></right><top style="thin"><color rgb="FFD9E2EC"/></top><bottom style="thin"><color rgb="FFD9E2EC"/></bottom><diagonal/></border>
    </borders>
    <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
    <cellXfs count="5">
      <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
      <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment horizontal="center"/></xf>
      <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment horizontal="center" wrapText="1"/></xf>
      <xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
      <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf>
    </cellXfs>
    <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  `)}function v(){return d('Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"',"<Application>VietMed Ky Thuat</Application>")}function D(){const t=new Date().toISOString();return d('cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',`
    <dc:creator>VietMed Ky Thuat</dc:creator>
    <cp:lastModifiedBy>VietMed Ky Thuat</cp:lastModifiedBy>
    <dcterms:created xsi:type="dcterms:W3CDTF">${t}</dcterms:created>
    <dcterms:modified xsi:type="dcterms:W3CDTF">${t}</dcterms:modified>
  `)}function y(t){return t.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}function P(t){const e=[],r=[];let l=0;t.forEach(([i,n])=>{const o=x.encode(i),m=x.encode(n.replace(/>\s+</g,"><").trim()),p=A(m),u=g(67324752,o,m,p,l);e.push(u,m),r.push(g(33639248,o,m,p,l)),l+=u.length+m.length});const s=l,a=r.reduce((i,n)=>i+n.length,0),c=R(t.length,a,s);return E([...e,...r,c])}function g(t,e,r,l,s){const a=t===33639248,c=a?46+e.length:30+e.length,i=new Uint8Array(c),n=new DataView(i.buffer);let o=0;return n.setUint32(o,t,!0),o+=4,a&&(n.setUint16(o,20,!0),o+=2),n.setUint16(o,20,!0),o+=2,n.setUint16(o,0,!0),o+=2,n.setUint16(o,0,!0),o+=2,n.setUint16(o,0,!0),o+=2,n.setUint16(o,0,!0),o+=2,n.setUint32(o,l,!0),o+=4,n.setUint32(o,r.length,!0),o+=4,n.setUint32(o,r.length,!0),o+=4,n.setUint16(o,e.length,!0),o+=2,n.setUint16(o,0,!0),o+=2,a&&(n.setUint16(o,0,!0),o+=2,n.setUint16(o,0,!0),o+=2,n.setUint16(o,0,!0),o+=2,n.setUint32(o,0,!0),o+=4,n.setUint32(o,s,!0),o+=4),i.set(e,o),i}function R(t,e,r){const l=new Uint8Array(22),s=new DataView(l.buffer);return s.setUint32(0,101010256,!0),s.setUint16(8,t,!0),s.setUint16(10,t,!0),s.setUint32(12,e,!0),s.setUint32(16,r,!0),l}function E(t){const e=t.reduce((s,a)=>s+a.length,0),r=new Uint8Array(e);let l=0;return t.forEach(s=>{r.set(s,l),l+=s.length}),r}function X(){return Array.from({length:256},(t,e)=>{let r=e;for(let l=0;l<8;l+=1)r=r&1?3988292384^r>>>1:r>>>1;return r>>>0})}function A(t){let e=4294967295;return t.forEach(r=>{e=b[(e^r)&255]^e>>>8}),(e^4294967295)>>>0}export{S as e};
