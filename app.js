// ================= INIT =================
function initApp(){
initUsuarios();
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

// ================= LOGIN =================
function initUsuarios(){
let u=JSON.parse(localStorage.getItem("usuarios"));
if(!u){
localStorage.setItem("usuarios",JSON.stringify([
{usuario:"admin",clave:"123",rol:"Admin"}
]));
}
}

function checkAuth(){
if(!localStorage.getItem("usuario")){
location.href="index.html";
}
}

function setUserInfo(){
document.getElementById("userInfo").innerText=
localStorage.getItem("usuario");
}

// ================= UI =================
function mostrar(id){

// 🔐 VALIDAR ROL
if(!puedeAcceder(id)){
alert("❌ No tienes permiso para entrar aquí");
return;
}

// 🔐 SI ES CONFIG O USUARIOS → PEDIR CLAVE
if(id === "config" || id === "usuarios"){

if(!pedirClaveAdmin()){
return;
}

}

document.querySelectorAll(".vista").forEach(v=>v.style.display="none");
document.getElementById(id).style.display="block";

detenerQR();

if(id==="entradas") iniciarQRE();
if(id==="salidas") iniciarQRS();
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
// ================= REPORTES SELECTS =================
function cargarReportesSelects(){

let prod = document.getElementById("prodR");
let ref = document.getElementById("refR");

if(!prod || !ref) return;

// limpiar
prod.innerHTML = "<option value=''>Todos los productos</option>";
ref.innerHTML = "<option value=''>Todas las referencias</option>";

// llenar productos
catalogo.productos.forEach(p=>{
let opt = document.createElement("option");
opt.value = p;
opt.text = p;
prod.appendChild(opt);
});

// cuando cambia producto
prod.onchange = ()=>{

ref.innerHTML = "<option value=''>Todas las referencias</option>";

if(!catalogo.referencias[prod.value]) return;

catalogo.referencias[prod.value].forEach(r=>{
let opt = document.createElement("option");
opt.value = r;
opt.text = r;
ref.appendChild(opt);
});

};

}
// ================= ENTRADAS =================
function entrada(){

let p=productoE.value;
let r=referenciaE.value;
let pac=parseInt(pacasE.value);

if(!pac){
alert("Ingrese cantidad");
return;
}

// 🔥 GUARDAR EN FIREBASE
db.collection("entradas").add({
fecha: new Date().toLocaleString(),
producto: p,
referencia: r,
pacas: pac,
usuario: localStorage.getItem("usuario")
});

// 🔥 ACTUALIZAR INVENTARIO (AQUÍ VA)
actualizarInventario(p,r,pac);

pacasE.value="";

alert("Entrada registrada");
}
// ================= SALIDAS =================
function salida(){

let p = productoS.value;
let r = referenciaS.value;
let pac = parseInt(pacasS.value);

if(!pac){
alert("Ingrese cantidad");
return;
}

// 🔥 validar inventario en nube
db.collection("inventario")
.where("producto","==",p)
.where("referencia","==",r)
.get()
.then(snapshot=>{

if(snapshot.empty){
alert("Sin inventario");
return;
}

let doc = snapshot.docs[0];
let data = doc.data();

if(data.pacas < pac){
alert("No hay suficiente inventario");
return;
}

// 🔥 guardar salida
db.collection("salidas").add({
fecha: new Date().toLocaleString(),
producto: p,
referencia: r,
pacas: pac,
usuario: localStorage.getItem("usuario")
});

// 🔥 descontar inventario
db.collection("inventario").doc(doc.id).update({
pacas: data.pacas - pac
});

pacasS.value="";

alert("Salida registrada");

});
}

// ================= TABLAS =================
function verEntradas(){

db.collection("entradas")
.orderBy("fecha","desc")
.onSnapshot(snapshot=>{

tablaEntradas.innerHTML="";

snapshot.forEach(doc=>{

let x = doc.data();

tablaEntradas.innerHTML+=`
<tr>
<td>${x.fecha}</td>
<td>${x.producto}</td>
<td>${x.referencia}</td>
<td>${x.pacas}</td>
<td>${x.usuario}</td>
</tr>
`;

});

});
}

function verSalidas(){

db.collection("salidas")
.orderBy("fecha","desc")
.onSnapshot(snapshot=>{

tablaSalidas.innerHTML="";

snapshot.forEach(doc=>{
let x = doc.data();

tablaSalidas.innerHTML+=`
<tr>
<td>${x.fecha}</td>
<td>${x.producto}</td>
<td>${x.referencia}</td>
<td>${x.pacas}</td>
<td>${x.usuario}</td>
</tr>
`;

});

});
}

// ================= INVENTARIO =================
function getEstibas(p,r,pac){

let conf=JSON.parse(localStorage.getItem("estibas"))||[];

let c=conf.find(x=>x.producto==p && x.referencia==r);

// 🔥 SI NO ESTÁ CONFIGURADO → NO CALCULA
if(!c || !c.pacas || c.pacas<=0){
return 0;
}

// 🔥 SOLO CALCULA SI EXISTE CONFIG
return (pac / c.pacas).toFixed(2);
}

function verInventario(){

db.collection("inventario")
.onSnapshot(snapshot=>{

tablaInventario.innerHTML="";

snapshot.forEach(doc=>{

let x = doc.data();

tablaInventario.innerHTML+=`
<tr>
<td>${x.producto}</td>
<td>${x.referencia}</td>
<td>${x.pacas}</td>
<td>${(x.pacas/42).toFixed(2)}</td>
</tr>
`;

});

});
}

// ================= CONFIG (ARREGLADO) =================
function cargarConfig(){

let conf=JSON.parse(localStorage.getItem("estibas"))||[];

let html="";

catalogo.productos.forEach(p=>{
catalogo.referencias[p].forEach(r=>{

let item=conf.find(x=>x.producto==p && x.referencia==r);

html+=`
<tr>
<td>${p}</td>
<td>${r}</td>
<td>
<input type="number" id="c-${p}-${r}" value="${item?item.pacas:''}">
</td>
<td>
<button onclick="guardarFila('${p}','${r}')">Guardar</button>
</td>
</tr>
`;

});
});

tablaConfig.innerHTML=html;
}

function guardarFila(p,r){

let val = parseInt(document.getElementById(`c-${p}-${r}`).value);

if(!val){
alert("Ingrese valor");
return;
}

db.collection("estibas")
.where("producto","==",p)
.where("referencia","==",r)
.get()
.then(snapshot=>{

if(snapshot.empty){

db.collection("estibas").add({
producto:p,
referencia:r,
pacas:val
});

}else{

let doc = snapshot.docs[0];

db.collection("estibas").doc(doc.id).update({
pacas:val
});

}

});

alert("Guardado");
}
// ================= DESCARGAR =================
function descargarInventario(){

let data = JSON.parse(localStorage.getItem("inventario")) || [];

let fecha = new Date().toLocaleString();

let html = `
<table border="1">
<tr>
<th colspan="4" style="font-size:20px;">Inventario ONE CARIBE</th>
</tr>

<tr>
<td colspan="4">Fecha: ${fecha}</td>
</tr>

<tr style="background:#1e293b;color:white;">
<th>Producto</th>
<th>Referencia</th>
<th>Pacas</th>
<th>Estibas</th>
</tr>
`;

data.forEach(x=>{
html += `
<tr>
<td>${x.producto}</td>
<td>${x.referencia}</td>
<td>${x.pacas}</td>
<td>${(x.pacas/42).toFixed(2)}</td>
</tr>
`;
});

html += "</table>";

let blob = new Blob([html], { type: "application/vnd.ms-excel" });

let a = document.createElement("a");
a.href = URL.createObjectURL(blob);
a.download = "Inventario_ONE_CARIBE.xls";
a.click();
}

// ================= IMPRIMIR =================
function imprimirInventario(){

let data = JSON.parse(localStorage.getItem("inventario")) || [];

let fecha = new Date().toLocaleString();

let filas = "";

data.forEach(x=>{
filas += `
<tr>
<td>${x.producto}</td>
<td>${x.referencia}</td>
<td>${x.pacas}</td>
<td>${(x.pacas/42).toFixed(2)}</td>
</tr>
`;
});

let contenido = `
<html>
<head>
<title>Inventario ONE CARIBE</title>

<style>
body{
font-family: Arial;
padding:30px;
color:#111;
}

.header{
display:flex;
justify-content:space-between;
margin-bottom:20px;
}

.titulo{
font-size:22px;
font-weight:bold;
}

.sub{
font-size:12px;
color:#555;
}

table{
width:100%;
border-collapse:collapse;
margin-top:20px;
}

th{
background:#1e293b;
color:white;
padding:10px;
text-align:left;
}

td{
padding:10px;
border-bottom:1px solid #ddd;
}

.footer{
margin-top:30px;
font-size:12px;
text-align:center;
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
${fecha}
</div>
</div>

<table>
<thead>
<tr>
<th>Producto</th>
<th>Referencia</th>
<th>Pacas</th>
<th>Estibas</th>
</tr>
</thead>

<tbody>
${filas}
</tbody>
</table>

<div class="footer">
© 2026 ONE CARIBE | Autor: Otsler Suarez
</div>

</body>
</html>
`;

let w = window.open("");
w.document.write(contenido);
w.document.close();
w.print();
}
// ================= REPORTES =================
function reporte(){

let entradas = JSON.parse(localStorage.getItem("entradas")) || [];
let salidas = JSON.parse(localStorage.getItem("salidas")) || [];

let f1 = document.getElementById("fInicio").value;
let f2 = document.getElementById("fFin").value;
let prod = document.getElementById("prodR").value;
let ref = document.getElementById("refR").value;

// 🔥 FILTRO
function filtrar(data){

return data.filter(x=>{

let fecha = x.fecha.split(",")[0];

if(f1 && fecha < f1) return false;
if(f2 && fecha > f2) return false;

if(prod && x.producto !== prod) return false;
if(ref && x.referencia !== ref) return false;

return true;

});
}

// 🔥 AGRUPAR POR DÍA
function agrupar(data){

let map = {};

data.forEach(x=>{
let d = x.fecha.split(",")[0];
map[d] = (map[d] || 0) + x.pacas;
});

return map;
}

let ent = agrupar(filtrar(entradas));
let sal = agrupar(filtrar(salidas));

// 🔥 UNIR FECHAS
let dias = Array.from(new Set([
...Object.keys(ent),
...Object.keys(sal)
])).sort();

let dataEnt = dias.map(d=>ent[d] || 0);
let dataSal = dias.map(d=>sal[d] || 0);

// 🔥 LIMPIAR GRÁFICO ANTERIOR
if(window.chart) window.chart.destroy();

// 🔥 CREAR GRÁFICO
window.chart = new Chart(document.getElementById("grafico"),{

type:'bar',

data:{
labels: dias,
datasets:[
{
label:"Entradas",
data: dataEnt,
backgroundColor:"#22c55e"
},
{
label:"Salidas",
data: dataSal,
backgroundColor:"#ef4444"
}
]
},

options:{
responsive:true,
plugins:{
legend:{position:"top"}
}
}

});
}

// ================= LOGOUT =================
function logout(){
localStorage.removeItem("usuario");
localStorage.removeItem("rol");
location.href="index.html";
}
// ================= LIMPIAR DATOS =================
function limpiar(tipo){

let clave = document.getElementById("claveAdmin").value;

// 🔐 VALIDAR ADMIN (sigue usando local por ahora)
let usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];

let admin = usuarios.find(x=>x.rol==="Admin" && x.clave===clave);

if(!admin){
alert("❌ Clave de administrador incorrecta");
return;
}

// ⚠️ CONFIRMAR
if(!confirm("¿Seguro que deseas eliminar esta información?")) return;

// 🔥 ELIMINAR EN FIREBASE
db.collection(tipo).get().then(snapshot=>{

let total = snapshot.size;

if(total === 0){
alert("No hay datos para eliminar");
return;
}

let contador = 0;

snapshot.forEach(doc=>{

db.collection(tipo).doc(doc.id).delete()
.then(()=>{
contador++;

if(contador === total){

// 🔄 refrescar tablas
if(tipo==="entradas") verEntradas();
if(tipo==="salidas") verSalidas();
if(tipo==="inventario") verInventario();

alert("✅ Datos eliminados correctamente");

document.getElementById("claveAdmin").value="";
}

});

});

});

}
// ================= USUARIOS PRO =================

// CREAR USUARIO
function crearUsuario(){

let u = userN.value.trim();
let c = passN.value.trim();
let rol = rolN.value;

if(!u || !c){
alert("Complete campos");
return;
}

db.collection("usuarios").add({
usuario:u,
clave:c,
rol:rol
});

alert("Usuario creado");

userN.value="";
passN.value="";
}
// MOSTRAR USUARIOS
function verUsuarios(){

db.collection("usuarios")
.onSnapshot(snapshot=>{

tablaUsuarios.innerHTML="";

snapshot.forEach(doc=>{

let u = doc.data();

tablaUsuarios.innerHTML+=`
<tr>
<td>${u.usuario}</td>
<td>${u.clave}</td>
<td>${u.rol}</td>
<td>
<button onclick="eliminarUsuario('${doc.id}')">🗑</button>
</td>
</tr>
`;

});

});
}
// EDITAR CONTRASEÑA
function guardarUsuario(i){

let lista = JSON.parse(localStorage.getItem("usuarios"));

let nueva = document.getElementById(`pass-${i}`).value.trim();

if(!nueva){
alert("Ingrese contraseña válida");
return;
}

lista[i].clave = nueva;

localStorage.setItem("usuarios", JSON.stringify(lista));

alert("✅ Contraseña actualizada");

verUsuarios();
}

// ELIMINAR
function eliminarUsuario(id){

if(!confirm("¿Eliminar usuario?")) return;

// 🔥 eliminar en firebase
db.collection("usuarios").doc(id).delete()
.then(()=>{
alert("Usuario eliminado");
verUsuarios();
});

}
// ================= CONTROL DE ACCESO =================
function puedeAcceder(id){

let rol = localStorage.getItem("rol");

// ADMIN → todo
if(rol === "Admin") return true;

// SUPERVISOR
if(rol === "Supervisor"){
if(id === "config" || id === "usuarios"){
return false;
}
return true;
}

// OPERADOR
if(rol === "Operador"){
if(id === "entradas" || id === "salidas"){
return true;
}
return false;
}

return false;
}
function pedirClaveAdmin(){

let clave = prompt("Ingrese clave de administrador:");

if(!clave) return false;

let usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];

let admin = usuarios.find(x=>x.rol==="Admin" && x.clave===clave);

if(admin){
return true;
}else{
alert("❌ Clave incorrecta");
return false;
}

}
function actualizarInventario(p,r,pac){

db.collection("inventario")
.where("producto","==",p)
.where("referencia","==",r)
.get()
.then(snapshot=>{

if(snapshot.empty){

db.collection("inventario").add({
producto:p,
referencia:r,
pacas:pac
});

}else{

let doc = snapshot.docs[0];
let data = doc.data();

db.collection("inventario").doc(doc.id).update({
pacas: data.pacas + pac
});

}

});
}
