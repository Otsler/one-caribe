function initApp(){
checkAuth();
cargarSelects();
verEntradas();
verSalidas();
verInventario();
mostrar("entradas");
setUserInfo();
}

function setUserInfo(){
document.getElementById("userInfo").innerText = localStorage.getItem("usuario");
}

function mostrar(id){

document.querySelectorAll(".vista").forEach(v=>v.style.display="none");
document.getElementById(id).style.display="block";

}

// ===== SELECTS =====
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

// ===== ENTRADA =====
function entrada(){

let p=document.getElementById("productoE").value;
let r=document.getElementById("referenciaE").value;
let pac=parseInt(document.getElementById("pacasE").value);

if(!pac) return alert("Ingrese cantidad");

db.collection("entradas").add({
fecha:new Date().toLocaleString(),
producto:p,
referencia:r,
pacas:pac,
usuario:localStorage.getItem("usuario")
});

actualizarInventario(p,r,pac);

document.getElementById("pacasE").value="";
alert("Entrada registrada");
}

// ===== SALIDA =====
function salida(){

let p=document.getElementById("productoS").value;
let r=document.getElementById("referenciaS").value;
let pac=parseInt(document.getElementById("pacasS").value);

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

document.getElementById("pacasS").value="";
alert("Salida registrada");

});
}

// ===== VER TABLAS =====
function verEntradas(){
db.collection("entradas").onSnapshot(snap=>{
let tabla = document.getElementById("tablaEntradas");
tabla.innerHTML="";
snap.forEach(doc=>{
let x=doc.data();
tabla.innerHTML+=`
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
db.collection("salidas").onSnapshot(snap=>{
let tabla = document.getElementById("tablaSalidas");
tabla.innerHTML="";
snap.forEach(doc=>{
let x=doc.data();
tabla.innerHTML+=`
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

function verInventario(){
db.collection("inventario").onSnapshot(snap=>{

let tabla = document.getElementById("tablaInventario");
tabla.innerHTML="";
let total=0;

snap.forEach(doc=>{
let x=doc.data();
total+=x.pacas;

tabla.innerHTML+=`
<tr>
<td>${x.producto}</td>
<td>${x.referencia}</td>
<td>${x.pacas}</td>
<td id="estiba-${doc.id}">0</td>
</tr>`;
});

document.getElementById("totales").innerText="TOTAL PACAS: "+total;

});
}

// ===== INVENTARIO =====
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

// ===== LOGOUT =====
function logout(){
localStorage.clear();
location.href="index.html";
}

// ===== DESCARGAR =====
function descargarInventario(){
alert("Descarga funcionando (puedes volver a integrar Excel luego)");
}

// ===== IMPRIMIR =====
function imprimirInventario(){
window.print();
}
