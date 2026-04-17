
function initApp(){
checkAuth();
cargarSelects();
verEntradas();
verSalidas();
verInventario();
cargarConfig();
verUsuarios();
mostrar("entradas");
setUserInfo();
}

function checkAuth(){
if(!localStorage.getItem("usuario")){
location.href="index.html";
}
}

function setUserInfo(){
userInfo.innerText = localStorage.getItem("usuario");
}

function mostrar(id){

if(!puedeAcceder(id)){
alert("❌ No tienes permiso");
return;
}

if(id==="config" || id==="usuarios"){
if(!pedirClaveAdmin()) return;
}

document.querySelectorAll(".vista").forEach(v=>v.style.display="none");
document.getElementById(id).style.display="block";
}

// ================= SELECTS =================
function cargarSelects(){
llenar("productoE","referenciaE");
llenar("productoS","referenciaS");
}

function llenar(p,r){
let prod=document.getElementById(p);
let ref=document.getElementById(r);

prod.innerHTML="";
catalogo.productos.forEach(x=>{
prod.innerHTML+=`<option>${x}</option>`;
});

prod.onchange=()=>{
ref.innerHTML="";
catalogo.referencias[prod.value].forEach(y=>{
ref.innerHTML+=`<option>${y}</option>`;
});
};

prod.onchange();
}

function entrada(){

let p=productoE.value;
let r=referenciaE.value;
let pac=parseInt(pacasE.value);

if(!pac) return alert("Ingrese cantidad");

db.collection("entradas").add({
fecha:new Date().toLocaleString(),
producto:p,
referencia:r,
pacas:pac,
usuario:localStorage.getItem("usuario")
});

actualizarInventario(p,r,pac);

pacasE.value="";
alert("Entrada registrada");
}

function salida(){

let p=productoS.value;
let r=referenciaS.value;
let pac=parseInt(pacasS.value);

if(!pac) return alert("Ingrese cantidad");

let clave = p+"_"+r;

db.collection("inventario").doc(clave).get()
.then(doc=>{

if(!doc.exists) return alert("Sin inventario");

let data=doc.data();

if(data.pacas<pac) return alert("No hay suficiente");

db.collection("salidas").add({
fecha:new Date().toLocaleString(),
producto:p,
referencia:r,
pacas:pac,
usuario:localStorage.getItem("usuario")
});

db.collection("inventario").doc(clave).update({
pacas:data.pacas-pac
});

pacasS.value="";
alert("Salida registrada");

});
}

function verEntradas(){

db.collection("entradas").orderBy("fecha","desc")
.onSnapshot(snap=>{
tablaEntradas.innerHTML="";
snap.forEach(doc=>{
let x=doc.data();
tablaEntradas.innerHTML+=`
<tr>
<td>${x.fecha}</td>
<td>${x.producto}</td>
<td>${x.referencia}</td>
<td>${x.pacas}</td>
<td>${x.usuario}</td>
</tr>`;
});
});
}

function verSalidas(){

db.collection("salidas").orderBy("fecha","desc")
.onSnapshot(snap=>{
tablaSalidas.innerHTML="";
snap.forEach(doc=>{
let x=doc.data();
tablaSalidas.innerHTML+=`
<tr>
<td>${x.fecha}</td>
<td>${x.producto}</td>
<td>${x.referencia}</td>
<td>${x.pacas}</td>
<td>${x.usuario}</td>
</tr>`;
});
});
}

function actualizarInventario(p,r,pac){

let clave = p+"_"+r;

db.collection("inventario").doc(clave).get()
.then(doc=>{

if(!doc.exists){

db.collection("inventario").doc(clave).set({
producto:p,
referencia:r,
pacas:pac
});

}else{

let data=doc.data();

db.collection("inventario").doc(clave).update({
pacas:data.pacas+pac
});

}

});
}

function verInventario(){

db.collection("inventario").onSnapshot(snap=>{

tablaInventario.innerHTML="";
let total=0;

snap.forEach(doc=>{
let x=doc.data();

total+=x.pacas;

tablaInventario.innerHTML+=`
<tr>
<td>${x.producto}</td>
<td>${x.referencia}</td>
<td>${x.pacas}</td>
<td id="estiba-${doc.id}">0</td>
</tr>`;

calcularEstibas(doc.id,x.producto,x.referencia,x.pacas);

});

totales.innerHTML="TOTAL PACAS: "+total;

});
}

function cargarConfig(){

db.collection("estibas").onSnapshot(snap=>{

let conf=[];
snap.forEach(d=>conf.push(d.data()));

let html="";

catalogo.productos.forEach(p=>{
catalogo.referencias[p].forEach(r=>{

let item=conf.find(x=>x.producto==p && x.referencia==r);

html+=`
<tr>
<td>${p}</td>
<td>${r}</td>
<td><input id="c-${p}-${r}" value="${item?item.pacas:''}"></td>
<td><button onclick="guardarFila('${p}','${r}')">Guardar</button></td>
</tr>`;

});
});

tablaConfig.innerHTML=html;

});
}

function guardarFila(p,r){

let val=parseInt(document.getElementById(`c-${p}-${r}`).value);
if(!val) return alert("Ingrese valor");

let clave=p+"_"+r;

db.collection("estibas").doc(clave).set({
producto:p,
referencia:r,
pacas:val
});

alert("Guardado");
}

function limpiar(tipo){

let clave=document.getElementById("claveAdmin").value;

let usuarios=JSON.parse(localStorage.getItem("usuarios"))||[];
let admin=usuarios.find(x=>x.rol==="Admin" && x.clave===clave);

if(!admin) return alert("Clave incorrecta");
if(!confirm("¿Eliminar datos?")) return;

db.collection(tipo).get().then(snap=>{
snap.forEach(doc=>{
db.collection(tipo).doc(doc.id).delete();
});
});

alert("Eliminado");
}

function crearUsuario(){

let u=userN.value.trim();
let c=passN.value.trim();
let rol=rolN.value;

if(!u||!c) return alert("Complete campos");

db.collection("usuarios").add({usuario:u,clave:c,rol:rol});

userN.value="";
passN.value="";
alert("Usuario creado");
}

function verUsuarios(){

db.collection("usuarios").onSnapshot(snap=>{

tablaUsuarios.innerHTML="";

snap.forEach(doc=>{
let u=doc.data();

tablaUsuarios.innerHTML+=`
<tr>
<td>${u.usuario}</td>

<td>
<input id="pass-${doc.id}" value="${u.clave}">
</td>

<td>${u.rol}</td>

<td>
<button onclick="guardarUsuario('${doc.id}')">💾</button>
<button onclick="eliminarUsuario('${doc.id}')">🗑</button>
</td>
</tr>`;
});

});
}
function guardarUsuario(id){

let nueva=document.getElementById("pass-"+id).value;

if(!nueva) return alert("Ingrese clave");

db.collection("usuarios").doc(id).update({
clave:nueva
});

alert("Contraseña actualizada");

}

function eliminarUsuario(id){
if(!confirm("¿Eliminar usuario?")) return;
db.collection("usuarios").doc(id).delete();
}

function puedeAcceder(id){

let rol=localStorage.getItem("rol");

if(rol==="Admin") return true;
if(rol==="Supervisor") return id!=="config" && id!=="usuarios";
if(rol==="Operador") return id==="entradas"||id==="salidas"||id==="inventario";

return false;
}

function pedirClaveAdmin(){

let clave=prompt("Clave admin:");
if(!clave) return false;

db.collection("usuarios")
.where("rol","==","Admin")
.where("clave","==",clave)
.get()
.then(snap=>{

if(!snap.empty){
return true;
}else{
alert("Clave incorrecta");
return false;
}

});
}

function logout(){

localStorage.removeItem("usuario");
localStorage.removeItem("rol");

location.href="index.html";

}
function calcularEstibas(id,p,r,pac){

db.collection("estibas").doc(p+"_"+r).get()
.then(doc=>{

if(!doc.exists){
document.getElementById("estiba-"+id).innerText="0";
return;
}

let conf=doc.data();

let est=(pac/conf.pacas).toFixed(2);

document.getElementById("estiba-"+id).innerText=est;

});
}
window.descargarInventario = async function(){

try{

if(typeof XLSX === "undefined"){
alert("❌ Error: librería Excel no cargó");
return;
}

let snap = await db.collection("inventario").get();

let data = [];

for (let doc of snap.docs){

let x = doc.data();

let confDoc = await db.collection("estibas").doc(x.producto+"_"+x.referencia).get();

let estibas = 0;

if(confDoc.exists){
let conf = confDoc.data();
estibas = (x.pacas / conf.pacas).toFixed(2);
}

data.push({
Producto: x.producto,
Referencia: x.referencia,
Pacas: x.pacas,
Estibas: estibas
});

}

let ws = XLSX.utils.json_to_sheet(data);

// 🔥 ANCHO DE COLUMNAS (PRO)
ws["!cols"] = [
{ wch: 25 },
{ wch: 15 },
{ wch: 10 },
{ wch: 10 }
];

let wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Inventario");

// 🔥 DESCARGAR
XLSX.writeFile(wb, "Inventario_ONE_CARIBE.xlsx");

}catch(error){

console.error(error);
alert("❌ Error al descargar: " + error.message);

}

}
function imprimirInventario(){

db.collection("inventario").get().then(snap=>{

let total = 0;
let totalEstibas = 0;
let promesas = [];

snap.forEach(doc=>{

let x = doc.data();
total += x.pacas;

let prom = db.collection("estibas").doc(x.producto+"_"+x.referencia).get()
.then(confDoc=>{

let estibas = 0;

if(confDoc.exists){
let conf = confDoc.data();
estibas = (x.pacas / conf.pacas).toFixed(2);

totalEstibas += parseFloat(estibas);
}

return `
<tr>
<td>${x.producto}</td>
<td>${x.referencia}</td>
<td>${x.pacas}</td>
<td>${estibas}</td>
</tr>
`;

});

promesas.push(prom);

});

Promise.all(promesas).then(resultados=>{

let filas = resultados.join("");

let contenido = `
<html>
<head>
<title>Inventario ONE CARIBE</title>

<style>

body{
font-family:Arial;
padding:30px;
color:#111;
}

.header{
display:flex;
justify-content:space-between;
align-items:center;
margin-bottom:20px;
}

.titulo{
font-size:22px;
font-weight:bold;
}

.sub{
font-size:13px;
color:#555;
}

table{
width:90%;
margin:auto;
border-collapse:collapse;
}

th{
background:#1e293b;
color:white;
padding:12px;
text-align:center;
}

td{
padding:12px;
border-bottom:1px solid #ddd;
text-align:center;
}

tr:nth-child(even){
background:#f9fafb;
}

.total{
margin-top:20px;
text-align:right;
font-weight:bold;
font-size:15px;
}

.footer{
margin-top:30px;
text-align:center;
font-size:12px;
color:#555;
}

</style>

</head>

<body>

<div class="header">
<div>
<div class="titulo">ONE CARIBE</div>
<div class="sub">Reporte de Inventario</div>
</div>

<div class="sub">
${new Date().toLocaleString()}
</div>
</div>

<table>
<tr>
<th>Producto</th>
<th>Referencia</th>
<th>Pacas</th>
<th>Estibas</th>
</tr>

${filas}

</table>

<div class="total">
TOTAL PACAS: ${total}<br>
TOTAL ESTIBAS: ${totalEstibas.toFixed(2)}
</div>

<div class="footer">
© 2026 ONE CARIBE
</div>

</body>
</html>
`;

let w = window.open("");
w.document.write(contenido);
w.document.close();
w.print();

});

});
}
