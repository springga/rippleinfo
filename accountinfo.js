var address;
var wsUri = "wss://s1.ripple.com/";	
var url;
var wsCmdBalanceXRP;
var wsCmdBalanceIOU;
var opStatus;
var opBalance;
var opInfo;
var psCur = 0;

var COLOR_MAP = {
"USD":"#B5EAAA",	//green
"CNY":"#B5EAAA",
"EUR":"#B5EAAA",
"AUD":"#B5EAAA",
"JPY":"#B5EAAA",
"CHF":"#B5EAAA",
"GBP":"#B5EAAA",
"RUB":"#B5EAAA",
"PLN":"#B5EAAA",
"CAD":"#B5EAAA",
"HKD":"#B5EAAA",
"NOK":"#B5EAAA",
"KPW":"#B5EAAA",
"NZD":"#B5EAAA",}

function init() {
	opStatus = document.getElementById("status");
	opBalance = document.getElementById("balance");
	opInfo = document.getElementById("info");
	url = document.URL;
	if (url.indexOf("#") < 0) url = document.URL + "#rwDewhHaNdq5xA3Ku54VP8ze4UL6wvYCy9";
	document.getElementById("address").value = url.split("#")[1];
	url = url.split("#")[0];
	queryAccount();
}
function queryAccount() {
	address = document.getElementById("address").value;
	window.location.href = url + "#" + address;
	if (!address in ADDRESS_KNOWN) ADDRESS_KNOWN[address] = "self";
	wsCmdBalanceXRP = cmdAccountInfo(1, "account_info", address);
	wsCmdBalanceIOU = cmdAccountInfo(2, "account_lines", address);
	opBalance.innerHTML = "";
	opInfo.innerHTML = "";
	startWebSocket();
}
function startWebSocket() {
	writeToStatus("正在连接...");
	websocket = new WebSocket(wsUri);
	websocket.onopen = function(evt) { onOpen(evt) };
	websocket.onclose = function(evt) { onClose(evt) };
	websocket.onmessage = function(evt) { onMessage(evt) };
	websocket.onerror = function(evt) { onError(evt) };
}
function onOpen(evt) {
	writeToStatus("获取账户信息...");
	websocket.send(wsCmdBalanceXRP);
	websocket.send(wsCmdBalanceIOU);
}
function onError(evt) {
	writeToStatus("<span style='color:red;'>Error: </span> " + evt.data);
}
function onClose(evt) {
	writeToStatus("查询完毕!");
}
function onMessage(evt) {
	var data = JSON.parse(evt.data);
	switch(data.id) {
		case 1: procAccountInfo(data); break;
		case 2: procAccountLines(data); break;
	}
}
function procAccountInfo(data) {
	console.log(data);
	if (data.status == "error") {writeToStatus("错误: " + data.error); return; }
	var account_data = data.result.account_data;
	var balance = xrp(account_data.Balance);
	var text = markCurrency("XRP") + " " + markAmount(balance, psCur);	
	writeToBalance(text);
	var avatar = account_data.urlgravatar;
	if(avatar) writeToInfo('<img src="' + avatar + '">');
	var seq = account_data.Sequence;
	writeToInfo('Sequence:　' + seq);
	var domain = account_data.Domain;
	if(domain) writeToInfo('Domain:　' + ascify(domain));
	var fee = account_data.TransferRate;
	if(fee) writeToInfo('Fee:　' + toFee(fee) + '%');	
}
function procAccountLines(data) {
	console.log(data);
	if (data.status == "error") {writeToStatus("错误: " + data.error); return; }
	var debt = {};
	var debtFunded = {};
	var debtCount = {};
	for (var index in data.result.lines) {
		var node = data.result.lines[index];
		var account = node.account;
		var currency = node.currency;
		var amount = node.balance;
		var limit_peer = node.limit_peer;
		if (amount > 0) {
			var text = markCurrency(currency) + " " + markAmount(amount, psCur) + " " + addLink(account);
			writeToBalance(text);}
		else if (amount < 0) {			
			if (currency in debt) {
				debt[currency] += +amount;
				debtFunded[currency]++;}
			else {
				debt[currency] = +amount;
				debtFunded[currency] = 1; }}
		else if(limit_peer > 0) {
			if (currency in debtCount) {
				debtCount[currency]++;}
			else {
				debtCount[currency] = 1;} 
		}}
	for(cur in debt) {
		if(!(cur in debtCount)) debtCount[cur] = 0 ;
		var text = markCurrency(cur) + " " + markAmount(debt[cur], psCur) + " " + 
				comma(debtCount[cur]+debtFunded[cur]) + " trusts, " + comma(debtFunded[cur]) + " funded";
		writeToBalance(text);}
	websocket.close();
}

function cmdAccountInfo(id, cmd, account) {
	return JSON.stringify({
    	id: id, command: cmd, account: account });}
function xrp(balance) {
	return balance / 1000000;}
function toFee(fee) {
	return (xrp(fee) - 1000) / 10;}
function fix(str,precision){
    return parseFloat(str).toFixed(precision).toString();}
function comma(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");}
function ascify(code){
	var str = '';
	for(i=0;i<code.length;i=i+2){
		str = str + String.fromCharCode('0x'+code.substring(i,i+2))
	}
	return str;
}
function writeToStatus(message) {
	opStatus.innerHTML = message;}
function writeToBalance(message) {
	var pre = document.createElement("p");
	pre.style.wordWrap = "break-word";
	pre.innerHTML = message;
	opBalance.appendChild(pre);}
function writeToInfo(message) {
	var pre = document.createElement("p");
	pre.style.wordWrap = "break-word";
	pre.innerHTML = message;
	opInfo.appendChild(pre);}

function markAccount(account) {
	return account in ADDRESS_KNOWN ?  "<span class='gateway' title='" + 
			account + "'>" + ADDRESS_KNOWN[account] + "</span>" : account;}
function markCurrency(cur) {
	return cur == "XRP" ? "<span class='currency' style='background-color:#D1D0CE'>" + cur + "</span>" : 
			"<span class='currency' style='background-color:" + (cur in COLOR_MAP ? COLOR_MAP[cur] : "#FFCBA4") + "'>" + cur + "</span>";}
function markAmount(amount, ps, isbold, iscomma) {
	if (arguments.length == 2) {isbold = true; iscomma = true;}
	return "<span " + (isbold ? "class='number'" : "") +" title='" + amount + "'>" + 
		(iscomma ? comma(fix(amount, ps)) : fix(amount, ps)) + "</span>";}
function markMarker(marker, id) {
	return "<span class='marker' id='" + id + "'>" + marker + "</span>";}
function addLink(account) {
	return "<a href='" + url + "#" + account +  "' target='_blank'>" + markAccount(account) + "</a>";}

window.addEventListener("load", init, false);