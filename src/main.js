// load DNS rtypes from json into the select menu in the addon popup
function readTextFile(file, callback) {
    var rawFile = new XMLHttpRequest();
    rawFile.overrideMimeType("application/json");
    rawFile.open("GET", file, true);
    rawFile.onreadystatechange = function() {
        if (rawFile.readyState === 4 && rawFile.status == "200") {
            callback(rawFile.responseText);
        }
    }
    rawFile.send(null);
}

readTextFile("./dns-rtypes.json", function(text){
    //console.log("Text:", text)
    var options = JSON.parse(text);
    //console.log(options);
      for (i in options) {
        rtype = options[i].value;
        document.getElementById("dns-query-type").insertAdjacentHTML('beforeend', `<option value="${rtype}">${options[i].name || rtype}</option>`);
      }
});

async function DnsAPIQuery(dns_api_url, query_hostname, query_type)
{
    var dns_query_url = dns_api_url + `?name=${query_hostname}&type=${query_type}`;

    const response = await fetch(dns_query_url, {
      headers: {
        'Accept': 'application/dns-json'
      }
    });
    return response;
}

function formatResultData(baseString, resultIter) {
    for (var item of resultIter) {
        var dataFmt = `${item.name.toString()}, ${item.data.toString()}\n`;
        baseString = baseString + dataFmt;
    }
    return baseString;
}

async function processQuery() {
    var dns_base_url = "https://cloudflare-dns.com/dns-query";
    
    var query_name = document.getElementById("dns-query").value;
    var query_type = document.getElementById("dns-query-type").value;
    
    if (query_name) {
        const result = await browser.storage.local.get("dns_url").then(
        // https://stackoverflow.com/questions/29516390/how-can-i-access-the-value-of-a-promise
        function (result) {
            dns_base_url = result.dns_url || dns_base_url;
        }).catch(function (error) {
            console.log("Encountered error loading preferred DNS API URL.", error, "\nTrying query with default DNS API " + dns_base_url);
        });

        console.log("using DNS server", dns_base_url);
        DnsAPIQuery(dns_base_url, query_name, query_type).then((response) => {
            // Check if the response is ok
            if (!response.ok) {
            errMsg = `Error: ${response.status} - ${response.statusText}`;
            console.log(errMsg);
            }
            // Check if the response is in JSON format
            if (response.headers.get("Content-Type")
                .includes("json")) {
                response.json().then(
                    function (result) {
                        console.log(query_name, query_type, result);
                        var resultStr = "";

                        if (result.Answer) {
                            resultStr = formatResultData(resultStr, result.Answer);
                        }

                        /* handle case where SOA is in Authority field
                        This happens when there is a CNAME record, or on certain sites like www.google.com
                        */
                        if ((result.Question[0].type == 6 || result.Question[0].type == 2) && result.Authority) {
                            resultStr = formatResultData(resultStr, result.Authority);
                        }

                        /* 
                        add comments at end. Google server provides comments on certain queries

                        This also handles cases where response has no answer but an OPT (RFC6891) message. 
                        This includes RFC8914 errors
                        https://developers.cloudflare.com/1.1.1.1/infrastructure/extended-dns-error-codes/
                    
                        Cloudflare returns the comment in an array, Google in a string.
                        Google has a separated extended_dns_errors field with the specific error messages
                        */
                        if (result.Comment)
                            resultStr = resultStr + `\nComment:\n${result.Comment}`;

                        document.getElementById("result").innerText = resultStr;

                    }).catch(function (error) {
                        console.log("error processing result:", error);
                    })
            } else {
                throw new Error("Unexpected Content-Type");
            }
        })
        .catch((error) => {
            console.log(`Error with fetch(): ${error.message}`);
        });
    }
}

document.addEventListener('DOMContentLoaded', function () {
  var clickyButton = document.querySelector('#send-query');
  clickyButton.addEventListener('click', processQuery);
});
