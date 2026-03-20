<script>

// ================= SAFE NUMBER HELPER =================
function safeNumber(value, fallback){
let n=parseFloat(value);
return isNaN(n)?fallback:n;
}

// ================= SETTINGS =================
let settings = JSON.parse(localStorage.getItem("settings")) || {
MIN_PROFIT_MARGIN: 0.15,
T: 60,
L_MAX: 10,
S_MAX: 1,
W1: 0.4,
W2: 0.3,
W3: 0.3,
CAP_PERCENT: 0.30,
CAP_DOLLAR: 500,
AI_ADJUSTMENT_FACTOR: 1,
conversionData: {
purchases: 0,
abandonments: 0
}
};

settings.CAP_PERCENT = safeNumber(settings.CAP_PERCENT,0.30);
settings.CAP_DOLLAR = safeNumber(settings.CAP_DOLLAR,500);
settings.AI_ADJUSTMENT_FACTOR = safeNumber(settings.AI_ADJUSTMENT_FACTOR,1);

let user = {
lastLogin: new Date(Date.now() - 10*24*60*60*1000),
loyalty: 2,
psych: 0.5
};

const products = {
1:{name:"Laptop",price:1000,cost:750},
2:{name:"Smartphone",price:700,cost:500},
3:{name:"Headphones",price:150,cost:80},
4:{name:"Smartwatch",price:300,cost:180},
5:{name:"Tablet",price:450,cost:320},
6:{name:"Gaming Mouse",price:80,cost:40}
};

let cart = {};

// ================= PRODUCTS =================
function renderProducts(){
let div=document.getElementById("products");
div.innerHTML="";
for(let id in products){
let p=products[id];
div.innerHTML+=`
<div class="product">
<h4>${p.name}</h4>
<p>$${p.price}</p>
<button onclick="addToCart(${id})">Add to Cart</button>
</div>`;
}
}

// ================= CART =================
function addToCart(id){
if(!cart[id]) cart[id]={...products[id],quantity:1};
else cart[id].quantity++;
updateCart();
}

function removeItem(id){
cart[id].quantity--;
if(cart[id].quantity<=0) delete cart[id];
updateCart();
}

function updateCart(){
let div=document.getElementById("cartItems");
div.innerHTML="";
let total=0;

for(let id in cart){
let item=cart[id];
let sub=item.price*item.quantity;
total+=sub;
div.innerHTML+=`${item.name} x${item.quantity} - $${sub.toFixed(2)}
<button onclick="removeItem(${id})">-</button><br>`;
}

document.getElementById("total").innerText=total.toFixed(2);
updateLiveMetrics(total);
}

// ================= DISCOUNT ENGINE =================
function calculateCoupon(price,cost,daysInactive){

price=safeNumber(price,0);
cost=safeNumber(cost,0);

let minProfit=price*settings.MIN_PROFIT_MARGIN;
let maxDiscountProfit=price-(cost+minProfit);

if(maxDiscountProfit<=0) return [0,0,0];

let timeFactor=Math.min(daysInactive/settings.T,1)*settings.W1;
let loyaltyFactor=Math.min(user.loyalty/settings.L_MAX,1)*settings.W2;
let psychFactor=Math.min(user.psych/settings.S_MAX,1)*settings.W3;

let BW=Math.min(timeFactor+loyaltyFactor+psychFactor,1);

let desired=maxDiscountProfit*BW*settings.AI_ADJUSTMENT_FACTOR;
let capPercentValue=price*settings.CAP_PERCENT;

let finalDiscount=Math.min(
desired,
maxDiscountProfit,
capPercentValue,
settings.CAP_DOLLAR
);

finalDiscount=safeNumber(finalDiscount,0);

return [finalDiscount,maxDiscountProfit,BW];
}

// ================= LIVE METRICS =================
function updateLiveMetrics(totalPrice){

if(totalPrice<=0){
document.getElementById("weightBar").style.width="0%";
document.getElementById("livePreview").innerHTML="";
return;
}

let totalCost=0;
for(let id in cart){
totalCost+=cart[id].cost*cart[id].quantity;
}

let daysInactive=Math.floor((Date.now()-user.lastLogin)/(1000*60*60*24));
let [discount,maxDiscount,BW]=calculateCoupon(totalPrice,totalCost,daysInactive);

document.getElementById("weightBar").style.width=(BW*100)+"%";

document.getElementById("livePreview").innerHTML=
`<div class="result">
Estimated Discount: $${discount.toFixed(2)}<br>
Estimated Final: $${(totalPrice-discount).toFixed(2)}
</div>`;
}

// ================= CHECKOUT =================
function checkout(){

if(Object.keys(cart).length===0){
alert("Cart is empty!");
return;
}

let totalPrice=0;
let totalCost=0;

for(let id in cart){
totalPrice+=cart[id].price*cart[id].quantity;
totalCost+=cart[id].cost*cart[id].quantity;
}

let daysInactive=Math.floor((Date.now()-user.lastLogin)/(1000*60*60*24));
let [discount,maxDiscount,BW]=calculateCoupon(totalPrice,totalCost,daysInactive);
let finalPrice=totalPrice-discount;

document.getElementById("result").innerHTML=
`<div class="result">
<h4>Checkout Summary</h4>
Original Total: $${totalPrice.toFixed(2)}<br>
Discount Applied: -$${discount.toFixed(2)}<br>
Final Price Paid: <b>$${finalPrice.toFixed(2)}</b><br>
Behavioral Weight Used: ${(BW*100).toFixed(1)}%
</div>`;

settings.conversionData.purchases++;
localStorage.setItem("settings",JSON.stringify(settings));

cart={};
updateCart();

user.loyalty++;
user.lastLogin=new Date();
}

// ================= ADMIN =================
function updateAdmin(){

let days=safeNumber(document.getElementById("daysInactive").value,0);
if(days>0) user.lastLogin=new Date(Date.now()-days*24*60*60*1000);

user.psych=safeNumber(document.getElementById("psychSlider").value,0.5);

settings.CAP_PERCENT=safeNumber(document.getElementById("capPercent").value,0.30);
settings.CAP_DOLLAR=safeNumber(document.getElementById("capDollar").value,500);

localStorage.setItem("settings",JSON.stringify(settings));

updateCart();
}

// ================= DARK MODE =================
function toggleDarkMode(){
document.body.classList.toggle("dark");
}

renderProducts();

</script>