var wsUri = "wss://s1.ripple.com/";
var websocket;
var wsCmdBalanceXRP;
var wsCmdBalanceIOU;
var wsCmdOffer;
var wsCmdSubscribe;
var opStatus = document.getElementById("status");
var opInfo = document.getElementById("info");
var opCredit = document.getElementById("credit");
var opDebt = document.getElementById("debt");
var opOffer = document.getElementById("offer");
var opTx = document.getElementById("tx");
var opTxCount = document.getElementById("txCount");
var tbDebt = document.getElementById("tb_debt");
var tbOffer = document.getElementById("tb_offer");
var btnTx = document.getElementById("btnTx");
var btnQuery = document.getElementById("btnQuery");
var txAddr = document.getElementById("address");
var marker;
var startday;
var endday;
var credits;
var cntTx;
var cntTrust;
var counter;
var url;
var address;
var txPreLgrSeq;
var TX_BATCH=100;
var PRECISON_RATE = 6;
var PRECISON_AMT = 0;
var DATE_RIPPLE_START = new Date(2000,0,1);
var SHORT = {
	"Exchange":"兑",
	"Send":"发",
	"Receive":"收",
	"OfferCreate":"挂",
	"OfferCancel":"撤",
	"TrustSet":"信"};

function init() {
	url = document.URL;
	if (url.indexOf("#") >= 0) {
		txAddr.value = url.split("#")[1].trim();
		url = url.split("#")[0];
		queryAccount();}
}
function queryAccount() {
	address = txAddr.value;
	window.location.href = url + "#" + address;
	var accounts=[];
	accounts.push(address);
	wsCmdBalanceXRP = cmdAccountInfo(1, "account_info", address);
	wsCmdBalanceIOU = cmdAccountInfo(2, "account_lines", address);
	wsCmdOffer = cmdAccountOffer(4, "account_offers", address);
	wsCmdSubscribe = cmdSubscribe(5, "subscribe", accounts);
	opCredit.innerHTML = "<tr><th>币种</th><th>金额</th><th>发行者</th></tr>";
	opDebt.innerHTML = "<tr><th>币种</th><th>金额</th><th>信任数</th><th>持有者</th></tr>";	
	opInfo.innerHTML = "";
	opTx.innerHTML = "";
	opTxCount.innerHTML = "";
	opOffer.innerHTML = "";
	tbDebt.className = "hidden";
	tbOffer.className = "hidden";
	credits = [];
	cntTx = {};
	cntTrust = 0;
	counter = 0;
	startWebSocket();
}
function queryTx() {
	var wsCmdTx = cmdAccountTx(3, "account_tx", address, txPreLgrSeq , TX_BATCH);
	websocket.send(wsCmdTx);
	btnTx.className = "hidden";	//hide Tx button after requst sent
	writeToStatus("正在查询交易...");
}

function startWebSocket() {
	writeToStatus("正在连接...");
	if(websocket) websocket.close();
	websocket = new WebSocket(wsUri);
	websocket.onopen = function(evt) { onOpen(evt) };
	websocket.onclose = function(evt) { onClose(evt) };
	websocket.onmessage = function(evt) { onMessage(evt) };
	websocket.onerror = function(evt) { onError(evt) };
}
function onOpen(evt) {
	btnTx.className = "";	//enable queryTx after websocket open
	writeToStatus("获取账户信息...");
	websocket.send(wsCmdBalanceXRP);
	websocket.send(wsCmdBalanceIOU);
	websocket.send(wsCmdOffer);
	websocket.send(wsCmdSubscribe);
}
function onError(evt) {
	console.log(evt.data);
	writeToStatus("<span style='color:red;'>错误: </span> " + evt.data);
}
function onClose(evt) {
	btnTx.className = "hidden";
}
function onMessage(evt) {
	var data = JSON.parse(evt.data);
	switch(data.id) {
		case 1: procAccountInfo(data); break;
		case 2: procAccountLines(data); break;
		case 3: procTx(data); break;
		case 4: procOffer(data); break;
		case 5: procWatch(data); break;	
		default: procSubscribe(data);
	}
}

function procAccountInfo(data) {
	console.log(data);
	if (data.status == "error") {writeToStatus("错误: " + data.error); return; }
	var account_data = data.result.account_data;
	var balance = xrp(account_data.Balance);
	var credit = {sent:0, recv:0};
	credit.currency = "XRP";
	credit.amount = balance;
	credit.issuer = "";
	credits.push(credit);
	writeToCredit(credit);
	var avatar = account_data.urlgravatar;
	if(avatar) writeToInfo('<img src="' + avatar + '">');
	var sequence = account_data.Sequence;
	writeToTxCount("Sequence", sequence);
	var domain = account_data.Domain;
	if(domain) writeToInfo('域名:　' + ascify(domain));
	var fee = account_data.TransferRate;
	if(fee) writeToInfo('费用:　' + toFee(fee) + '%');
	txPreLgrSeq=account_data.PreviousTxnLgrSeq;}
function procAccountLines(data) {
	console.log(data);
	if (data.status == "error") {writeToStatus("错误: " + data.error); return; }
	var debt = {};	//amount
	var debtCount = {};	//funded accounts
	var trustCount = {};	//trust without fund
	for (var index in data.result.lines) {
		var node = data.result.lines[index];
		var account = node.account;
		var currency = node.currency;
		var amount = node.balance;
		var limit_peer = node.limit_peer;
		if (amount > 0) {	//credit
			var credit = {currency:currency, amount:amount, sent:0, recv:0, issuer:account};
			credits.push(credit);
			writeToCredit(credit);}
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
		if(!(cur in trustCount)) trustCount[cur] = 0 ;
		writeToDebt(cur,debt[cur],trustCount[cur]+debtCount[cur],debtCount[cur]);}	
	if(cntTrust) tbDebt.className = "";
	writeToStatus("基本信息查询完毕!");}
function procOffer(data) {
	console.log(data);
	var offers = data.result.offers;
	if(offers.length>0) tbOffer.className = "";
	offers.forEach(function (offer) {		
		var get = toAmount(offer.taker_gets);
		var pay = toAmount(offer.taker_pays);
		writeToOffer(get,pay);});}
function procWatch(data) {
	console.log(data);}
function procSubscribe(data) {
	console.log(data);	
	writeToStatus("正在监控...");
	var tx = data.transaction;
	var meta = data.meta;
	procTxLow(tx,meta,false);}
function procTx(data) {
	console.log(data);
	if (data.result.marker) {
		marker = marker===data.result.marker.ledger ? marker-1 : data.result.marker.ledger;
		var wsCmdTx = cmdAccountTx(3, "account_tx", address, marker, TX_BATCH);
		websocket.send(wsCmdTx);}
	var transactions = data.result.transactions;
	for (var i in transactions) {
		var tx = transactions[i].tx;
		var meta = transactions[i].meta;
		procTxLow(tx,meta,true);}
	writeToStatus("已处理" + counter + "条记录...");
	if (!data.result.marker) {
		writeToTxCount("Age/days",calcDays(startday,endday));
		for (var t in cntTx) {
			writeToTxCount(t, cntTx[t]);}
		if (!GATEWAY[address]) {
			opCredit.innerHTML = "<tr><th>币种</th><th>金额</th><th>收</th><th>发</th><th>差额</th><th>发行者</th></tr>";
			credits.forEach(function (c){
				writeToCreditEx(c);});}
		websocket.close();
		writeToStatus("交易信息查询完毕!");}}

function procTxLow(tx,meta,isPast){		
	var type = tx.TransactionType;
	var date = tx.date;
	if(!startday) startday = tx.date;
	endday = tx.date;
	var cdate = calcDate(date);
	var fee = tx.Fee;
	var counterparty;
	var amount = 0;
	switch(type) {
		case "Payment":
			amount = toAmount(tx.Amount,meta);
			if (tx.Account === address) {
		        if (tx.Destination === address) {
		         	type = 'Exchange';}
		        else {
		         	type = 'Send';
		        	counterparty = tx.Destination;
		        	var index = inCredits(amount.currency,amount.issuer);
		        	if(index>=0) credits[index].sent += +amount.value;
		        	else {
		        		var credit = {currency:amount.currency, amount:0, sent:+amount.value, recv:0, issuer:amount.issuer};
		        		credits.push(credit);}}}
	    	else if (tx.Destination === address){
		        type = 'Receive';
		      	counterparty = tx.Account;
		      	var index = inCredits(amount.currency,amount.issuer);
		        if(index>=0) credits[index].recv += +amount.value;
		      	else {
		      		var credit = {currency:amount.currency, amount:0, sent:0, recv:+amount.value, issuer:amount.issuer};
		      		credits.push(credit);}}
	    	else type = "OfferTaken";
				break;
		case "OfferCreate":
			if (tx.Account === address) {
				amount = toAmount(tx.TakerGets);
				var counteramount = toAmount(tx.TakerPays);}
			else type = "OfferTaken";
			break;
		case "OfferCancel":
			var nodes = meta.AffectedNodes;
			var hasFind = false;
			nodes.forEach(function (n) {
				if(n.DeletedNode && n.DeletedNode.LedgerEntryType === "Offer") {
					var ff = n.DeletedNode.FinalFields;
					if(ff.Account === address) {
						amount = toAmount(ff.TakerGets);
						var counteramount = toAmount(ff.TakerPays);
						console.log(amount,counteramount);
						hasFind = true;}}});
			if(nodes.length===1) type = "Fee";
			else if(!hasFind) type = "OfferTaken";
			break;
		case "TrustSet":
			amount = toAmount(tx.LimitAmount);
			break;
	}
	if(type in cntTx) cntTx[type]++;
	else cntTx[type] = 1;

	var toWrite = false;
	if (type === 'Send' || type === 'Receive') {
		var record = {
			date:cdate, 
			type:type, 
			amount:amount, 
			address:counterparty};
		toWrite = true;}
	else if (type === 'OfferCreate' || type === 'OfferCancel') {
		var record = {
			date:cdate, 
			type:type, 
			amount:amount,
			counteramount:counteramount};
		toWrite = true;}
	else if (type === 'TrustSet') {
		var record = {
			date:cdate, 
			type:type, 
			amount:amount, 
			address:amount.issuer};
		toWrite = true;}
	if(isPast) counter += 1;
	if(toWrite) {
		writeToTx(record,isPast);
		console.log(counter, type, amount.value + " " + amount.currency, amount.issuer);}
}

function cmdAccountInfo(id, cmd, account) {
	return JSON.stringify({
    	id: id, command: cmd, account: account });}
function cmdAccountTx(id, cmd, account, ledger, limit) {
	return JSON.stringify({
	    id: id, command: cmd, account: account,
	    ledger_index_max: ledger, limit: limit });}
function cmdAccountOffer(id, cmd, account){
	return JSON.stringify({
	    id: id, command: cmd, account: account});}
function cmdSubscribe(id, cmd, accounts) {
	return JSON.stringify({
	    id: id, command: cmd, accounts: accounts});}

function calcDate(date) {
	var d = new Date(DATE_RIPPLE_START.getTime() - DATE_RIPPLE_START.getTimezoneOffset() * 60 * 1000 + date * 1000);
	var year = d.getFullYear();
	var month = d.getMonth() + 1;
	var day = d.getDate();
	var hour = d.getHours();
	var min = d.getMinutes();
	var sec = d.getSeconds();
	return year + "/" + (month < 10 ? "0" + month : month) + "/"
        + (day < 10 ? "0" + day : day) + " "
     	+ (hour < 10 ? "0" + hour : hour) + ":"
        + (min < 10 ? "0" + min : min) + ":"
        + (sec < 10 ? "0" + sec : sec);}
function calcDays(d1,d2) {
	return parseInt((d1>d2 ? d1-d2 : d2-d1)/3600/24);}
function xrp(balance) {
	return balance / 1000000;}
function toFee(fee) {
	return (xrp(fee) - 1000) / 10;}
function toAmount(amount,meta) {
	var amt = {value: 0, currency: '', issuer: ''};
	if(amount.currency) {
		amt.value = amount.value;
		amt.currency = amount.currency;
		amt.issuer = meta ? getIssuer(meta,amount) : amount.issuer;
	} else {
		amt.value = xrp(amount);
		amt.currency = 'XRP';
		amt.issuer = '';
	}
	return amt;}
function getIssuer(meta,amount){	
	for(i in meta.AffectedNodes){
		var n = meta.AffectedNodes[i].ModifiedNode;
		if(n && n.LedgerEntryType === "RippleState" && n.FinalFields.HighLimit && 
			n.FinalFields.HighLimit.currency === amount.currency) {
			var high = n.FinalFields.HighLimit;
			var low = n.FinalFields.LowLimit;
			if(high.issuer === address) return low.issuer;
			else if(low.issuer === address) return high.issuer;}}
	return amount.issuer;}
function inCredits(currency,issuer){
	for(i in credits) {
		c = credits[i];
		if(c.currency == currency && c.issuer == issuer) return i;
	}
	return -1;}
function rate(num){
    var s = num.toString().split('.');
    if(s.length===1) return	num;
    var i = s[0];
    if(i.length>2) return i;
    var d = s[1].substring(0,PRECISON_RATE);
    if(i==="0") return i + "." + (d==="000000" ? "" : d);
  	return i + "." + d.substring(0,3-i.length);}
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

function writeToStatus(message) {
	opStatus.innerHTML = message;}
function writeToCredit(credit) {
	var row = document.createElement("tr");
	row.innerHTML = "<td class='str'>" + markCurrency(credit) + "</td>" +
					"<td class='val'>" + markAmount(credit.amount) + "</td>" + 
					"<td class='str'>" + addLink(credit.issuer) + "</td>";
	opCredit.appendChild(row);}
function writeToCreditEx(credit) {
	var row = document.createElement("tr");
	row.innerHTML = "<td class='str'>" + markCurrency(credit) + "</td>" +
					"<td class='val'>" + markAmount(credit.amount) + "</td>" + 
					"<td class='val'>" + markAmount(credit.recv) + "</td>" + 
					"<td class='val'>" + markAmount(credit.sent) + "</td>" + 
					"<td class='val'>" + markAmount(credit.amount-credit.recv+credit.sent) + "</td>" + 
					"<td class='str'>" + addLink(credit.issuer) + "</td>";
	opCredit.appendChild(row);}
function writeToDebt(cur,amount,lines,lines_funded) {
	var row = document.createElement("tr");
	var amt = {currency:cur, issuer:address};
	row.innerHTML = "<td class='str'>" + markCurrency(amt) + "</td>" +
					"<td class='val'>" + markAmount(amount) + "</td>" +
					"<td class='val'>" + comma(lines) + "</td>" +
					"<td class='val'>" + comma(lines_funded) + "</td>";
	opDebt.appendChild(row);}
function writeToInfo(message) {
	var pre = document.createElement("p");
	pre.style.wordWrap = "break-word";
	pre.innerHTML = message;
	opInfo.appendChild(pre);}
function writeToTxCount(type,count) {		
	var row = document.createElement("tr");
	row.innerHTML = "<td>" + type + ": </td>" +
					"<td>" + count + "</td>";
	opTxCount.appendChild(row);}
function writeToTx(rec,isPast) {
	var row = document.createElement("tr");
	var html;
	if(rec.type==="Send" || rec.type==="Receive" || rec.type==='TrustSet') {
		html = "<td>" + rec.date + "</td>" +
					"<td>" + markMarker(SHORT[rec.type],rec.type) + "</td>"+
					"<td class='val'>" + markAmount(rec.amount.value) + " " + markCurrency(rec.amount) + "</td>" +
					"<td colspan=3>" + addLink(rec.address) + "</td>";}
	else if(rec.type==="OfferCreate" || rec.type==="OfferCancel") {
		html = "<td>" + rec.date + "</td>" +
					"<td>" + markMarker(SHORT[rec.type],rec.type) + "</td>"+
					"<td class='val'>" + markAmount(rec.amount.value) + " " + markCurrency(rec.amount) + "</td>" +
					"<td>换</td>" +
					"<td class='val'>" + markAmount(rec.counteramount.value) + " " + markCurrency(rec.counteramount) + "</td>" +
					"<td>@ " + markRate(rec.amount.value,rec.counteramount.value) + "</td>";}
	row.innerHTML = html;
	if(isPast) {
		opTx.appendChild(row);}
	else {
		opTx.insertBefore(row, opTx.firstChild);}}
function writeToOffer(get,pay) {
	var row = document.createElement("tr");
	row.innerHTML = "<td class='val'>" + markAmount(get.value) + "<span title='" + 
					(get.issuer in GATEWAY ? GATEWAY[get.issuer] : get.issuer) + 
					"'> " + markCurrency(get) + "</span></td>" +
					"<td><span class='mark'>换</td>"+
					"<td class='val'>" + markAmount(pay.value) + "<span title='" + 
					(pay.issuer in GATEWAY ? GATEWAY[pay.issuer] : pay.issuer) + 
					"'> " + markCurrency(pay) + "</span></td>" +
					"<td>@" +markRate(get.value,pay.value) + "</td>";
	opOffer.appendChild(row);}

function markAccount(account) {
	return "<span title='" + account + "'" + (account in GATEWAY ?  " class='gateway'>" + 
			GATEWAY[account] : ">" + shortenString(account))  + "</span>";}
function markCurrency(amount) {
	return "<span class='currency' title='" + amount.issuer + "' style='background-color:" + 
				colorMap(amount.currency) + "'>" + shortenString(amount.currency) + "</span>";}
function colorMap(cur) {
	if(cur==="XRP") 
		return "#D1D0CE"; //grey
	else if(FIAT.indexOf(cur)>-1)
		return "#B5EAAA"; //green
	else
		return "#FFCBA4"; //pink
}
function shortenString(str) {
	return str.length>7 ? str.substring(0,3) + '..' + str.substring(str.length-3) : str;}
function markAmount(amount) {
	return "<span class='number' title='" + amount + "'>" + 
		comma(fix(amount)) + "</span>";}
function markRate(pay,get) {
	return "<span class='number' title='" + pay/get + " / " +　rate(get/pay) +
		"'>" + rate(pay/get) + "</span>";}
function markMarker(marker, id) {
	return "<span class='marker' id='" + id + "'>" + marker + "</span>";}
function addLink(account) {
	return "<a href='" + url + "#" + account +  "' target='_blank'>" + markAccount(account) + "</a>";}

window.addEventListener("load", init, false);
btnQuery.addEventListener("click", queryAccount, false);
txAddr.addEventListener("keyup",function(event){
    if(event.keyCode == 13) queryAccount();
});