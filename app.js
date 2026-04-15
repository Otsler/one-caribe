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

pacasE.value="";

alert("Entrada registrada");
}
// ================= SALIDAS =================
function salida(){

let p=productoS.value;
let r=referenciaS.value;
let pac=parseInt(pacasS.value);

let inv=JSON.parse(localStorage.getItem("inventario"))||[];

let item=inv.find(x=>x.producto==p && x.referencia==r);

if(!item || item.pacas<pac){
alert("Sin inventario");
return;
}

item.pacas-=pac;

let sal=JSON.parse(localStorage.getItem("salidas"))||[];

sal.push({
fecha:new Date().toLocaleString(),
producto:p,
referencia:r,
pacas:pac,
usuario:localStorage.getItem("usuario")
});

localStorage.setItem("salidas",JSON.stringify(sal));
localStorage.setItem("inventario",JSON.stringify(inv));

pacasS.value="";

verSalidas();
verInventario();

alert("Salida registrada");
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
let data=JSON.parse(localStorage.getItem("salidas"))||[];
tablaSalidas.innerHTML="";

data.slice().reverse().forEach(x=>{
tablaSalidas.innerHTML+=`
<tr>
<td>${x.fecha}</td>
<td>${x.producto}</td>
<td>${x.referencia}</td>
<td>${x.pacas}</td>
<td>${x.usuario}</td>
</tr>`;
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

let data=JSON.parse(localStorage.getItem("inventario"))||[];
tablaInventario.innerHTML="";

data.forEach(x=>{
tablaInventario.innerHTML+=`
<tr>
<td>${x.producto}</td>
<td>${x.referencia}</td>
<td>${x.pacas}</td>
<td>${getEstibas(x.producto,x.referencia,x.pacas)}</td>
</tr>`;
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

let val=parseInt(document.getElementById(`c-${p}-${r}`).value);

if(!val){
alert("Ingrese valor");
return;
}

let conf=JSON.parse(localStorage.getItem("estibas"))||[];

let item=conf.find(x=>x.producto==p && x.referencia==r);

if(item) item.pacas=val;
else conf.push({producto:p,referencia:r,pacas:val});

localStorage.setItem("estibas",JSON.stringify(conf));

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

// 🔐 VALIDAR ADMIN
let usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];

let admin = usuarios.find(x=>x.rol==="Admin" && x.clave===clave);

if(!admin){
alert("❌ Clave de administrador incorrecta");
return;
}

// ⚠️ CONFIRMAR
if(!confirm("¿Seguro que deseas eliminar esta información?")) return;

// 🔥 ELIMINAR SEGÚN TIPO
if(tipo==="entradas"){
localStorage.removeItem("entradas");
}

if(tipo==="salidas"){
localStorage.removeItem("salidas");
}

if(tipo==="inventario"){
localStorage.removeItem("inventario");
}

verEntradas();
verSalidas();
verInventario();

alert("✅ Proceso realizado correctamente");

document.getElementById("claveAdmin").value="";
}
// ================= USUARIOS PRO =================

// CREAR USUARIO
function crearUsuario(){

let u = userN.value.trim();
let c = passN.value.trim();
let rol = rolN.value;

if(!u || !c){
alert("Complete los campos");
return;
}

let list = JSON.parse(localStorage.getItem("usuarios")) || [];

// 🔥 VALIDAR DUPLICADOS
let existe = list.find(x=>x.usuario === u);

if(existe){
alert("❌ El usuario ya existe");
return;
}

// 🔥 GUARDAR
list.push({
usuario: u,
clave: c,
rol: rol
});

localStorage.setItem("usuarios", JSON.stringify(list));

verUsuarios();

userN.value="";
passN.value="";

alert("✅ Usuario creado");
}

// MOSTRAR USUARIOS
function verUsuarios(){

let lista = JSON.parse(localStorage.getItem("usuarios")) || [];

tablaUsuarios.innerHTML="";

lista.forEach((u,i)=>{

tablaUsuarios.innerHTML+=`
<tr>
<td>${u.usuario}</td>

<td>
<input type="text" id="pass-${i}" value="${u.clave}">
</td>

<td>${u.rol}</td>

<td>
<button onclick="guardarUsuario(${i})">💾</button>
<button onclick="eliminarUsuario(${i})">🗑</button>
</td>
</tr>
`;

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
function eliminarUsuario(i){

if(!confirm("¿Eliminar usuario?")) return;

let lista = JSON.parse(localStorage.getItem("usuarios"));

lista.splice(i,1);

localStorage.setItem("usuarios", JSON.stringify(lista));

verUsuarios();
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
