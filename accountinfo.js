var wsUri = "wss://s1.ripple.com/";
var wsCmdBalanceXRP;
var wsCmdBalanceIOU;
var opStatus = document.getElementById("status");
var opInfo = document.getElementById("info");
var opCredit = document.getElementById("credit");
var opDebt = document.getElementById("debt");
var opTx = document.getElementById("tx");
var opTxCount = document.getElementById("txCount");
var tbDebt = document.getElementById("tb_debt");
var btnTx = document.getElementById("btnTx");
var marker;
var credits;
var credit = {
	currency: '',
	amount: 0,
	recv: 0,
	sent: 0,
	issuer: ''};
var cntTx;
var cntTrust;
var psCur = 0;
var url;
var address;
var txPreLgrSeq;
var txBatch=100;

function init() {
	url = document.URL;
	if (url.indexOf("#") >= 0) {
		document.getElementById("address").value = url.split("#")[1];
		url = url.split("#")[0];
		queryBalance();}
}
function queryBalance() {
	address = document.getElementById("address").value;
	window.location.href = url + "#" + address;
	wsCmdBalanceXRP = cmdAccountInfo(1, "account_info", address);
	wsCmdBalanceIOU = cmdAccountInfo(2, "account_lines", address);
	opCredit.innerHTML = "<tr><th>币种</th><th>金额</th><th>发行者</th></tr>";
	opDebt.innerHTML = "<tr><th>币种</th><th>金额</th><th>信任数</th><th>持有者</th></tr>";	
	opInfo.innerHTML = "";
	opTx.innerHTML = "";
	opTxCount.innerHTML = "";
	tbDebt.className = "hidden";
	btnTx.className = "";
	credits = [];
	cntTx = {};
	cntTrust = 0;
	startWebSocket();
}
function queryTx() {
	wsCmdTx = cmdAccountTx(3, "account_tx", address, txPreLgrSeq , txBatch);
	websocket.send(wsCmdTx);
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
	console.log(evt.data);
	writeToStatus("<span style='color:red;'>错误: </span> " + evt.data);
}
function onClose(evt) {
	
}
function onMessage(evt) {
	var data = JSON.parse(evt.data);
	switch(data.id) {
		case 1: procAccountInfo(data); break;
		case 2: procAccountLines(data); break;
		case 3: procTx(data); break;
	}
}
function procAccountInfo(data) {
	console.log(data);
	if (data.status == "error") {writeToStatus("错误: " + data.error); return; }
	var account_data = data.result.account_data;
	var balance = xrp(account_data.Balance);
	credit.currency = "XRP";
	credit.amount = balance;
	credits.push(credit);
	writeToCredit("XRP",balance,"");
	var avatar = account_data.urlgravatar;
	if(avatar) writeToInfo('<img src="' + avatar + '">');
	var sequence = account_data.Sequence;
	writeToTitle("Sequence", sequence);
	var domain = account_data.Domain;
	if(domain) writeToInfo('域名:　' + ascify(domain));
	var fee = account_data.TransferRate;
	if(fee) writeToInfo('费用:　' + toFee(fee) + '%');
	txPreLgrSeq=account_data.PreviousTxnLgrSeq;
}
function procAccountLines(data) {
	console.log(data);
	if (data.status == "error") {writeToStatus("错误: " + data.error); return; }
	var debt = {};
	var debtCount = {};
	var trustCount = {};
	for (var index in data.result.lines) {
		var node = data.result.lines[index];
		var account = node.account;
		var currency = node.currency;
		var amount = node.balance;
		var limit_peer = node.limit_peer;
		if (amount > 0) {	//credit
			credit.currency = currency;
			credit.amount = amount;
			credit.issuer = account;
			credits.push(credit);
			writeToCredit(currency,amount,account);}
		else if (amount < 0) {	//debt
			cntTrust++;
			if (currency in debt) {
				debt[currency] += +amount;
				debtCount[currency]++;}
			else {
				debt[currency] = +amount;
				debtCount[currency] = 1; }}
		else if(limit_peer > 0) {	//trust only
			if (currency in trustCount) trustCount[currency]++;
			else trustCount[currency] = 1;
		}}
	for(var cur in debt) {
		if(!(cur in debtCount)) debtCount[cur] = 0 ;
		writeToDebt(cur,debt[cur],trustCount[cur]+debtCount[cur],debtCount[cur]);}
	if(cntTrust) tbDebt.className = "";
	writeToStatus("查询完毕!");
}
function procTx(data) {
	console.log(data);
	if (data.result.marker) {
		marker = marker==data.result.marker.ledger ? marker-1 : data.result.marker.ledger;
		wsCmdTransaction = cmdAccountTx(3, "account_tx", address, marker, txBatch);
		websocket.send(wsCmdTransaction);}
	for (var i in data.result.transactions) {
		var tx = data.result.transactions[i];
		var type = tx.tx.TransactionType;		
		switch(type) {
			case "Payment":
				if (tx.Account === address) {
          if (tx.Destination === address) {
            type = 'Exchange';}
          else {
            type = 'Send';}}
        else {
          type = 'Receive';}
				break;
		}
		if(type in cntTx) cntTx[type]++;
		else cntTx[type]=1;
		/* 
			get meta;
			get balance change;
			max 2 currencies, if 3, ignore xrp fee;
			if 1 currency, must be send/recv;
			if 2 currencies, buy/sell/exchange;
			rippling?
		*/
	}
	if (!data.result.marker) {		
		for (var t in cntTx) {	
			writeToTitle(t, cntTx[t]);}
		websocket.close();}
}

function cmdAccountInfo(id, cmd, account) {
	return JSON.stringify({
    	id: id, command: cmd, account: account });}
function cmdAccountTx(id, cmd, account, ledger, limit) {
	return JSON.stringify({
	    id: id, command: cmd, account: account,
	    ledger_index_max: ledger, limit: limit });}
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
	return str;}

/**
 * Determine if the transaction is a "rippling" transaction based on effects
 *
 * @param effects
 */
var isRippling = function(effects){
  if (
    effects
    && effects.length
    && 2 === effects.length
    && 'trust_change_balance' == effects[0].type
    && 'trust_change_balance' == effects[1].type
    && effects[0].currency == effects[1].currency
    && !effects[0].amount.compareTo(effects[1].amount.negate())
  ) {
    return true;
  }
};

function writeToStatus(message) {
	opStatus.innerHTML = message;}
function writeToCredit(cur,amount,issuer) {
	var row = document.createElement("tr");
	row.innerHTML = "<td class='str'>" + markCurrency(cur) + "</td>" +
					"<td class='val'>" + markAmount(amount, psCur) + "</td>" + 
					"<td class='str'>" + addLink(issuer) + "</td>";
	opCredit.appendChild(row);}
function writeToCreditEx(cur,amount,recv,sent,issuer) {
	var row = document.createElement("tr");
	row.innerHTML = "<td class='str'>" + markCurrency(cur) + "</td>" +
					"<td class='val'>" + markAmount(amount, psCur) + "</td>" + 
					"<td class='val'>" + markAmount(recv, psCur) + "</td>" + 
					"<td class='val'>" + markAmount(sent, psCur) + "</td>" + 
					"<td class='val'>" + markAmount(amount-recv+sent, psCur) + "</td>" + 
					"<td class='str'>" + addLink(issuer) + "</td>";
	opCredit.appendChild(row);}
function writeToDebt(cur,amount,lines,lines_funded) {
	var row = document.createElement("tr");
	row.innerHTML = "<td class='str'>" + markCurrency(cur) + "</td>" +
					"<td class='val'>" + markAmount(amount, psCur) + "</td>" +
					"<td class='val'>" + comma(lines) + "</td>" +
					"<td class='val'>" + comma(lines_funded) + "</td>";
	opDebt.appendChild(row);}
function writeToInfo(message) {
	var pre = document.createElement("p");
	pre.style.wordWrap = "break-word";
	pre.innerHTML = message;
	opInfo.appendChild(pre);}
function writeToTitle(type,count) {		
	var row = document.createElement("tr");
	row.innerHTML = "<td>" + type + ": </td>" +
					"<td>" + count + "</td>";
	opTxCount.appendChild(row);}

function markAccount(account) {
	return account in ADDRESS_KNOWN ?  "<span class='gateway' title='" + 
			account + "'>" + ADDRESS_KNOWN[account] + "</span>" : account;}
function markCurrency(cur) {
	return cur == "XRP" ? "<span class='currency' style='background-color:#D1D0CE'>" + cur + "</span>" : 
			"<span class='currency' style='background-color:" + (FIAT.indexOf(cur)>-1 ? "#B5EAAA": "#FFCBA4") + "'>" + cur + "</span>";}
function markAmount(amount, ps, isbold, iscomma) {
	if (arguments.length == 2) {isbold = true; iscomma = true;}
	return "<span " + (isbold ? "class='number'" : "") +" title='" + amount + "'>" + 
		(iscomma ? comma(fix(amount, ps)) : fix(amount, ps)) + "</span>";}
function markMarker(marker, id) {
	return "<span class='marker' id='" + id + "'>" + marker + "</span>";}
function addLink(account) {
	return "<a href='" + url + "#" + account +  "' target='_blank'>" + markAccount(account) + "</a>";}

window.addEventListener("load", init, false);