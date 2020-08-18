// ==UserScript==
// @name         KlseScreener
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @include      /https://www.klsescreener.com/v2/stocks/view/.*/
// @grant        none
// ==/UserScript==
var NUMBER_OF_YEAR = 5;
var today = new Date();
var todayYear = today.getFullYear();
var divTable = $('span:contains(Category : )').parent().find('div[class="table-responsive"]');
var table = $(divTable.children()[0]).find('tbody > tr');

function getNativeTableValue(word) {
    return table.find('td:contains('+word+')').next().text();
}

(function() {
    'use strict';
    getMaxNumberOfYear();
    let fifthRow = $(divTable.children()[0]).find('tbody > tr').eq(5);
    let trToWrite = '';

    //Growth
    let cagr = getCagr();
    trToWrite = '<tr><td>G: ' + NUMBER_OF_YEAR + ' Yr(s) CAGR</td><td class="number">'+cagr+'</td></tr>';

    //Dividend
    let dy = getNativeTableValue('DY');
    trToWrite = trToWrite + '<tr><td>D: DY</td><td class="number">'+dy+'</td></tr>';

    //Price
    let pe = table.find('td:contains(P/E)').next().text();

    getPeRatio().then(function(res) {
        for (var i = 0; i < res.length; i++) {
            trToWrite = trToWrite + '<tr><td>P/E: '+ (i == res.length - 1 ? 'Today' : res[i].year) +'</td><td class="number">'+res[i].pe+'</td></tr>';
        }

        trToWrite = trToWrite + '<tr><td>&nbsp;</td><td>&nbsp;</td></tr>'; //blank row
        fifthRow.after(trToWrite);
    });

    // GDP PRC
})();

function getMaxNumberOfYear() {
    let annualTable = $('div[id=annual]').find('table tr');
    let reportCol = 4;
    let isFinancialYrEnd = $(annualTable.eq(1).children()[reportCol]).children().length != 0;
    if (annualTable.length - 1 >= NUMBER_OF_YEAR) return;
    NUMBER_OF_YEAR = annualTable.length - 1;
    if (!isFinancialYrEnd) NUMBER_OF_YEAR--;
}

function getCagr() {
    let annualTable = $('div[id=annual]').find('table tr');
    let patCol = 2, reportCol = 4;
    let cagr = 0; let startYear = 0; let endYear = 0;
    let isFinancialYrEnd = $(annualTable.eq(1).children()[reportCol]).children().length != 0; //check if first report is not full year

    startYear = parseInt($(annualTable.eq(isFinancialYrEnd ? NUMBER_OF_YEAR : NUMBER_OF_YEAR + 1).children()[patCol]).text().replace(',',''));
    endYear = parseInt($(annualTable.eq(isFinancialYrEnd ? 1 : 2).children()[patCol]).text().replace(',',''));

    cagr = ((Math.pow(endYear/startYear, (1/NUMBER_OF_YEAR)) - 1)*100).toFixed(2);
    return cagr + '%';
}

function getEps() {
    let annualTable = $('div[id=annual]').find('table tr');
    let epsCol = 3, reportCol = 4;
    let eps = [];
    let isFinancialYrEnd = $(annualTable.eq(1).children()[reportCol]).children().length != 0; //check if first report is not full year

    let startIndex = isFinancialYrEnd ? 1 : 2;

    for (let i = 0; i < NUMBER_OF_YEAR; i++) {
        eps.unshift($(annualTable.eq(startIndex++).children()[epsCol]).text());
    }

    eps.push(getNativeTableValue('EPS'));
    return eps;
}

function getPeRatio() {
    return getChart().then(function(res) {
        let result = getHistoricalPrice(res);
        let epochArray = []
        for (let i = 0; i < NUMBER_OF_YEAR; i++) {
            epochArray.push(new Date((todayYear + i - NUMBER_OF_YEAR)+'-12-31T00:00:00Z').getTime())
        }
        let lastFewYear = [];
        let price = [];
        let historicalPeRatio = [];
        for (let i = 0; i < epochArray.length; i++) {
            while (res.indexOf(epochArray[i]) == -1) {
                epochArray[i] -= 86400000;
            }
            lastFewYear.push({ "year": todayYear + i - NUMBER_OF_YEAR, "epoch": epochArray[i] });
        }
        lastFewYear.push({ "year": 2020, "epoch": result[result.length - 1][0] });

        let count = 0;
        for (let i = 0; i < result.length; i++) {
            if (result[i][0] == lastFewYear[count].epoch) {
                price.push({ "year": todayYear + count - NUMBER_OF_YEAR, "price": result[i][4] });
                count++;
                if (count == lastFewYear.length) break;
            }
        }
        let eps = getEps();

        for (let i = 0; i < NUMBER_OF_YEAR + 1; i++) {
            historicalPeRatio.push({"year": todayYear + i - NUMBER_OF_YEAR, "pe": (price[i].price * 100 / eps[i]).toFixed(2)});
        }
        return historicalPeRatio;
    });
}

async function getChart() {
    let stockCode = getStockCode();
    let url = 'https://www.klsescreener.com/v2/stocks/chart/' + stockCode;
    let priceArray = [];

    return await $.get(url);
}

function getHistoricalPrice(res) {
    let result = res;
    let indexOfData = res.indexOf('data');
    result = res.substring(indexOfData);
    let indexOfSemicolon = result.indexOf(';');
    result = result.substring(0, indexOfSemicolon);
    result = result.replace('data = ', '');

    var a = result.split('');
    a[result.lastIndexOf(',')] = '';
    result = a.join('');

    return JSON.parse(result);
}

function getStockCode() {
//     let url = window.location.toString();
    let url = $('a[id=load_more]').attr('href');
    let indexOfCode = url.lastIndexOf('/') + 1;
    return url.substring(indexOfCode);
}