import * as dotenv from "dotenv";
dotenv.config();

import * as express from "express";
const app = express();

import BigNumber from "bignumber.js";
import * as bodyParser from "body-parser";
import * as slpjs from "slpjs";
import { SlpFaucetHandler } from "./slpfaucet";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const slpFaucet = new SlpFaucetHandler(process.env.MNEMONIC!);
const faucetQty = parseInt(process.env.TOKENQTY!);

let users = new Array();
let spamArray = new Array();
let addressArray = new Array();
let spamAddresses = new Array();

function clearFunc() {
	console.log('clearing the users and address arrays, its been 6 hours');
	users = [];
	addressArray = [];
}

//setInterval(clearCookies, 5000);
// 21600000
// interval to run clearFunc every 6 hours in milliseconds
setInterval(clearFunc, 21600000);

function clearDistributedAmnt(){
	totalDistAmnt = Number(0);
}

// interval to run clearFunc every 2 hours in milliseconds
setInterval(clearDistributedAmnt, 7200000);

function removeFromArray(userIP, address){
			//error, remove userIP & address from arrays.
          const indexIP = users.indexOf(userIP);
          const indexAd = addressArray.indexOf(address);
          if (indexIP > -1) {
            users.splice(indexIP, 1);
          }
          if (indexAd > -1) {
          	addressArray.splice(indexAd, 1);
          }
}

let totalDistAmnt = Number(0); 

function addDistAmnt(amount) {

	totalDistAmnt = totalDistAmnt + amount;
	console.log('Just added ' + amount + ' to Total. The total distributed amount in last 2 hours is now ' + totalDistAmnt);

	return totalDistAmnt;
}

let errorMsg = 'You may only claim from the faucet once per 6 hours. Check back soon!';

//permanently block spam users on each restart
//spamArray.push('176.113.74.202');
//spamArray.push('185.65.134.165');

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");

app.get("/", (req, res) => {
	res.render("index", { txid: null, error: null });
});

app.post("/", async (req, res) => {
    const address = req.body.address;

    if (address === process.env.DISTRIBUTE_SECRET!) {

        try {
            await slpFaucet.evenlyDistributeTokens(process.env.TOKENID!);
        } catch (err) {
            console.log(err);
            res.render("index", { txid: null, error: err.message });
            return;
        }
        
        try {
            await slpFaucet.evenlyDistributeBch();
        } catch (err) {
            console.log(err);
            res.render("index", { txid: null, error: err.message });
            return;
        }
        slpFaucet.currentFaucetAddressIndex = 0;
        res.render("index", { txid: null, error: "Token distribution instantiated..." });
        return;
    }

    try {
        if (!slpjs.Utils.isSlpAddress(address)) {
            res.render("index", { txid: null, error: "Not a SLP Address." });
            return;
        }
    } catch (error) {
        res.render("index", { txid: null, error: "Not a SLP Address." });
        return;
    }

    let changeAddr: { address: string, balance: slpjs.SlpBalancesResult };
    try {
        changeAddr = await slpFaucet.selectFaucetAddressForTokens(process.env.TOKENID!);
    } catch (error) {
        res.render("index", { txid: null, error: "Faucet is temporarily empty :(" });
        return;
    }

    let sendTxId: string;
    try {
        let inputs: slpjs.SlpAddressUtxoResult[] = [];
        inputs = inputs.concat(changeAddr.balance.slpTokenUtxos[process.env.TOKENID!]).concat(changeAddr.balance.nonSlpUtxos);
        inputs.map((i) => i.wif = slpFaucet.wifs[changeAddr.address]);
        sendTxId = await slpFaucet.simpleTokenSend(process.env.TOKENID!, new BigNumber(faucetQty), inputs, address, changeAddr.address);
    } catch (error) {
        console.log(error);
        res.render("index", { txid: null, error: "Server error." });
        return;
    }
    console.log(sendTxId);
    const re = /^([A-Fa-f0-9]{2}){32,32}$/;
    if (typeof sendTxId !== "string" || !re.test(sendTxId)) {
        res.render("index", { txid: null, error: sendTxId });
        return;
    }

    res.render("index", { txid: sendTxId, error: null });
});

app.listen(process.env.PORT, () => {
    console.log("SLP faucet server listening on port " + process.env.PORT + "!");
});
