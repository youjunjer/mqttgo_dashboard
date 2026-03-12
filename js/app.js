/**
 * Copyright 2013 dc-square GmbH
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @author: Christoph Schäbel
 */

var websocketclient = {
    'client': null,
    'lastMessageId': 1,
    'lastSubId': 1,
    'subscriptions': [],  // 每一筆 = 一個 widget 設定（可同 topic 多筆）
    'messages': [],
    'connected': false,
    'infos': [],          // dashboard widget 設定（id 會跟 subscriptions 的 id 一致）

    // -------- helpers --------
    '_trim': function (s) {
        return (s === null || s === undefined) ? "" : String(s).trim();
    },

    '_isImageType': function (chartType) {
        const t = this._trim(chartType);
        return (t === "圖片" || t === "圖片(base64)");
    },

    '_needsMainSubscribe': function (chartType) {
        // 主頁 Paho 訂閱：用來更新「messages 列表」
        // 圖片類型不訂閱（Paho 主要拿 payloadString，不適合）
        return !this._isImageType(chartType);
    },

    '_existsChartName': function (chartName) {
        const name = this._trim(chartName);
        return websocketclient.infos.some(x => websocketclient._trim(x.chartName) === name);
    },

    '_getFirstColorByTopic': function (topic) {
        const t = this._trim(topic);
        const sub = websocketclient.subscriptions.find(s => websocketclient._trim(s.topic) === t);
        return sub ? sub.color : null;
    },

    '_hasAnyMainSubscriptionForTopic': function (topic, excludeId) {
        const t = this._trim(topic);
        return websocketclient.subscriptions.some(s => {
            if (excludeId !== undefined && s.id === excludeId) return false;
            return websocketclient._trim(s.topic) === t && websocketclient._needsMainSubscribe(s.chartType);
        });
    },

    '_parseRange': function (chartValueRange) {
        const raw = this._trim(chartValueRange);
        if (!raw) return ["0", "0"];
        const parts = raw.split(",");
        if (parts.length >= 2) return [this._trim(parts[0]) || "0", this._trim(parts[1]) || "0"];
        return [this._trim(parts[0]) || "0", "0"];
    },

    '_defaultSizeByType': function (chartType) {
        const t = this._trim(chartType);
        if (t === "甜甜圈圖") return { w: 200, h: 200, sizeUnit: 1 };
        if (t === "溫度圖")   return { w: 100, h: 100, sizeUnit: 1 };
        if (t === "類比圖")   return { w: 200, h: 200, sizeUnit: 1 };
        if (t === "水位圖")   return { w: 180, h: 180, sizeUnit: 1 };
        if (t === "折線圖")   return { w: 400, h: 200, sizeUnit: 2 };
        if (t === "長條圖")   return { w: 400, h: 200, sizeUnit: 2 };
        if (t === "圖片")     return { w: 200, h: 200, sizeUnit: 1 };
        if (t === "圖片(base64)") return { w: 200, h: 200, sizeUnit: 1 };
        if (t === "文字方塊") return { w: 200, h: 120, sizeUnit: 1 };
        if (t === "滑動開關") return { w: 200, h: 200, sizeUnit: 1 };
        return { w: 0, h: 0, sizeUnit: 1 };
    },

    // -------- original --------
    'prefill': function () {
        let parameters = new URLSearchParams(window.location.search)
        if (parameters.get('host') != null) { $('#urlInput').val(parameters.get('host')) };
        if (parameters.get('port') != null) { $('#portInput').val(parameters.get('port')) };
        if (parameters.get('host') != null) { $('#sslInput').click() };
    },

    'connect': function () {
        var host = $('#urlInput').val();
        var port = parseInt($('#portInput').val(), 10);
        var clientId = $('#clientIdInput').val();
        var keepAlive = parseInt($('#keepAliveInput').val());
        var cleanSession = $('#cleanSessionInput').is(':checked');
        var lwTopic = $('#lwTopicInput').val();
        var lwQos = parseInt($('#lwQosInput').val());
        var lwRetain = $('#LWRInput').is(':checked');
        var lwMessage = $('#LWMInput').val();
        var ssl = $('#sslInput').is(':checked');

        this.client = new Messaging.Client(host, port, clientId);
        this.client.onConnectionLost = this.onConnectionLost;
        this.client.onMessageArrived = this.onMessageArrived;
        websocketclient.infos = [];

        var options = {
            timeout: 3,
            keepAliveInterval: keepAlive,
            cleanSession: cleanSession,
            useSSL: ssl,
            onSuccess: this.onConnect,
            onFailure: this.onFail
        };

        if (lwTopic.length > 0) {
            var willmsg = new Messaging.Message(lwMessage);
            willmsg.qos = lwQos;
            willmsg.destinationName = lwTopic;
            willmsg.retained = lwRetain;
            options.willMessage = willmsg;
        }

        this.client.connect(options);
    },

    'onConnect': function () {
        websocketclient.connected = true;
        console.log("connected");
        $('body').addClass('connected').removeClass('notconnected').removeClass('connectionbroke');

        websocketclient.render.hide('conni');
        websocketclient.render.show('publish');
        websocketclient.render.show('sub');
        websocketclient.render.show('messages');
        $('#dashboardButton').show();
        $('#mapsButton').show();
    },

    'onFail': function (message) {
        websocketclient.connected = false;
        console.log("error: " + message.errorMessage);
        websocketclient.render.showError('Connect failed: ' + message.errorMessage);
    },

    'onConnectionLost': function (responseObject) {
        websocketclient.connected = false;
        if (responseObject.errorCode !== 0) {
            console.log("onConnectionLost:" + responseObject.errorMessage);
        }
        $('body.connected').removeClass('connected').addClass('notconnected').addClass('connectionbroke');
        websocketclient.render.show('conni');
        websocketclient.render.hide('publish');
        websocketclient.render.hide('sub');
        websocketclient.render.hide('messages');
        $('#dashboardButton').hide();
        $('#mapsButton').hide();

        //Cleanup messages
        websocketclient.messages = [];
        websocketclient.render.clearMessages();

        //Cleanup subscriptions
        websocketclient.subscriptions = [];
        websocketclient.render.clearSubscriptions();

        // Cleanup infos
        websocketclient.infos = [];
        websocketclient.render.clearDashboard();
    },

    'onMessageArrived': function (message) {
        var subscription = websocketclient.getSubscriptionForTopic(message.destinationName);
        if (!subscription) return;

        var messageObj = {
            'topic': message.destinationName,
            'retained': message.retained,
            'qos': message.qos,
            'payload': message.payloadString,
            'timestamp': moment(),
            'subscriptionId': subscription.id,
            'color': websocketclient.getColorForSubscription(subscription.id)
        };

        // 地圖功能
        let str = String(messageObj['payload']);
        let re = /gps@(.+),(.+)/i;
        let found = str.match(re);
        if (found !== null && found.length >= 3) {
            websocketclient.settingMaps(found[1], found[2])
        }

        messageObj.id = websocketclient.render.message(messageObj);
        websocketclient.messages.push(messageObj);
    },

    'disconnect': function () {
        this.client.disconnect();
    },

    'publish': function (topic, payload, qos, retain) {
        if (!websocketclient.connected) {
            websocketclient.render.showError("尚未連線到伺服器，請按Connect起始連線");
            return false;
        }

        var message = new Messaging.Message(payload);
        message.destinationName = topic;
        message.qos = qos;
        message.retained = retain;
        this.client.send(message);
    },

    // =========================
    // subscribe: 允許同 topic 多個 widget
    // chartName 重複 => 提示並 return false
    // 主頁 Paho 訂閱同 topic 只做一次（非圖片類型）
    // =========================
    'subscribe': function (topic, qosNr, color, chartType, chartName, chartValueRange, chartValueUnit) {

        if (!websocketclient.connected) {
            websocketclient.render.showError("尚未連線到伺服器，請按Connect起始連線");
            return false;
        }

        topic = this._trim(topic);
        chartType = this._trim(chartType);
        chartName = this._trim(chartName);
        chartValueUnit = this._trim(chartValueUnit);

        if (topic.length < 1) {
            websocketclient.render.showError("主題名稱不可為空值");
            return false;
        }

        // chartName 重複檢查
        if (chartName.length < 1) {

		const base = chartName;
		let tries = 0;

	    do {
	        const r = Math.floor(Math.random() * 1000); // 0~999
	        chartName = `${base}_${r}`;
	        tries++;
	    } while (tries < 3000 && this._existsChartName(chartName));

    // 可選：如果真的抽到 3000 次還重複（極低機率），再加時間戳保底
	    if (this._existsChartName(chartName)) {
        	chartName = `${base}_${Date.now()}`;
        }




        }
        if (this._existsChartName(chartName)) {
          const base = chartName;
          let tries = 0;
      
          do {
              const r = Math.floor(Math.random() * 1000); // 0~999
              chartName = `${base}_${r}`;
              tries++;
          } while (tries < 3000 && this._existsChartName(chartName));
      
          // 可選：如果真的抽到 3000 次還重複（極低機率），再加時間戳保底
          if (this._existsChartName(chartName)) {
              chartName = `${base}_${Date.now()}`;
          }       
 
        }

        // color：空值就沿用同 topic 第一個顏色，否則預設 999999
        color = this._trim(color);
        if (color.length < 1) {
            const existingColor = this._getFirstColorByTopic(topic);
            color = existingColor ? existingColor : '999999';
        }

        // 主頁 Paho subscribe（非圖片類型才需要，且同 topic 只做一次）
        if (this._needsMainSubscribe(chartType)) {
            const already = this._hasAnyMainSubscriptionForTopic(topic);
            if (!already) {
                this.client.subscribe(topic, { qos: qosNr });
            }
        }

        // 建立 subscription item（每個 widget 一筆）
        var subscription = {
            'topic': topic,
            'qos': qosNr,
            'color': color,
            'chartType': chartType,
            'chartName': chartName
        };
        subscription.id = websocketclient.render.subscription(subscription);
        this.subscriptions.push(subscription);

        // infos（dashboard widget 設定）
        const range = this._parseRange(chartValueRange);
        const size = this._defaultSizeByType(chartType);

        // 目前座標是由 createWidgetsJS 自動排版，因此 left/top 先填 0
        websocketclient.infos.push({
            'id': subscription.id,        // ✅ 這個 id 用來精準刪除
            'topic': topic,
            'chartName': chartName,
            'chartType': chartType,
            'color': color,
            'unit': chartValueUnit,
            'left': "0",
            'top': "0",
            'min': range[0],
            'max': range[1],
            'width': String(size.w),
            'height': String(size.h),
            'sizeUnit': size.sizeUnit
        });

        this.renderDashboard();
        return true;
    },

    // =========================
    // unsubscribe: 精準刪除指定 id 的 widget
    // 若同 topic 還有其他「非圖片」widget => 不 unsubscribe(topic)
    // =========================
    'unsubscribe': function (id) {
        var subs = _.find(websocketclient.subscriptions, { 'id': id });
        if (!subs) return;

        // 先從 subscriptions 移除
        websocketclient.subscriptions = websocketclient.subscriptions.filter(item => item.id !== id);

        // 清 messages（僅清掉跟這個 subscriptionId 綁定的訊息）
        websocketclient.render.removeSubscriptionsMessages(id);

        // infos 精準刪除
        websocketclient.infos = websocketclient.infos.filter(x => x.id !== id);
        this.renderDashboard();

        // 只有在：這筆是需要主頁訂閱的類型，且同 topic 不再有其他需要主頁訂閱的 widget 時，才真的 unsubscribe(topic)
        if (websocketclient._needsMainSubscribe(subs.chartType)) {
            const stillUsed = websocketclient._hasAnyMainSubscriptionForTopic(subs.topic, id);
            if (!stillUsed) {
                this.client.unsubscribe(subs.topic);
            }
        }
    },

    'deleteSubscription': function (id) {
        var elem = $("#sub" + id);

        if (confirm('確定?')) {
            elem.remove();
            this.unsubscribe(id);
        }
    },

    'getRandomColor': function () {
        var r = (Math.round(Math.random() * 255)).toString(16);
        var g = (Math.round(Math.random() * 255)).toString(16);
        var b = (Math.round(Math.random() * 255)).toString(16);
        return r + g + b;
    },

    'getSubscriptionForTopic': function (topic) {
        // 回傳第一個匹配的 subscription（若同 topic 多筆，messages 列表會以第一筆為主）
        for (let i = 0; i < this.subscriptions.length; i++) {
            if (this.compareTopics(topic, this.subscriptions[i].topic)) {
                return this.subscriptions[i];
            }
        }
        return false;
    },

    'getColorForPublishTopic': function (topic) {
        var sub = this.getSubscriptionForTopic(topic);
        return this.getColorForSubscription(sub ? sub.id : null);
    },

    'getColorForSubscription': function (id) {
        try {
            if (!id) return '999999';
            var sub = _.find(this.subscriptions, { 'id': id });
            return sub ? sub.color : '999999';
        } catch (e) {
            return '999999';
        }
    },

    'compareTopics': function (topic, subTopic) {
        var pattern = subTopic.replace("+", "(.*?)").replace("#", "(.*)");
        var regex = new RegExp("^" + pattern + "$");
        return regex.test(topic);
    },

    'render': {
        'showError': function (message) {
            alert(message);
        },

        'messages': function () {
            websocketclient.render.clearMessages();
            _.forEach(websocketclient.messages, function (message) {
                message.id = websocketclient.render.message(message);
            });
        },

        'message': function (message) {
            var largest = websocketclient.lastMessageId++;

            var html = '<li class="messLine id="' + largest + '">' +
                '   <div class="row large-12 mess' + largest + '" style="border-left: solid 10px #' + message.color + '; ">' +
                '       <div class="large-12 columns messageText">' +
                '           <div class="large-3 columns date">' + message.timestamp.format("YYYY-MM-DD HH:mm:ss") + '</div>' +
                '           <div class="large-5 columns topicM truncate" id="topicM' + largest + '" title="' + Encoder.htmlEncode(message.topic, 0) + '">Topic: ' + Encoder.htmlEncode(message.topic) + '</div>' +
                '           <div class="large-2 columns qos">Qos: ' + message.qos + '</div>' +
                '           <div class="large-2 columns retain">';
            if (message.retained) html += 'Retained';
            html += '           </div>' +
                '           <div class="large-12 columns message break-words">' + Encoder.htmlEncode(message.payload) + '</div>' +
                '       </div>' +
                '   </div>' +
                '</li>';

            $("#messEdit").prepend(html);
            return largest;
        },

        'subscriptions': function () {
            websocketclient.render.clearSubscriptions();
            _.forEach(websocketclient.subscriptions, function (subs) {
                subs.id = websocketclient.render.subscription(subs);
            });
        },

        'subscription': function (subscription) {
            var largest = websocketclient.lastSubId++;

            // 顯示 topic + chartType + chartName，方便你分辨刪哪個
            const t = Encoder.htmlEncode(subscription.topic);
            const ct = Encoder.htmlEncode(subscription.chartType || "");
            const cn = Encoder.htmlEncode(subscription.chartName || "");

            $("#innerEdit").append(
                '<li class="subLine" id="sub' + largest + '">' +
                '   <div class="row large-12 subs' + largest + '" style="border-left: solid 10px #' + subscription.color + '; background-color: #ffffff">' +
                '       <div class="large-12 columns subText">' +
                '           <div class="large-1 columns right closer">' +
                '              <a href="#" onclick="websocketclient.deleteSubscription(' + largest + '); return false;">x</a>' +
                '           </div>' +
                '           <div class="qos">Qos: ' + subscription.qos + '</div>' +
                '           <div class="topic truncate" id="topic' + largest + '" title="' + Encoder.htmlEncode(subscription.topic, 0) + '">' +
                '               ' + t + ' | ' + ct + ' | ' + cn +
                '           </div>' +
                '       </div>' +
                '   </div>' +
                '</li>'
            );

            return largest;
        },

        'toggleAll': function () {
            websocketclient.render.toggle('conni');
            websocketclient.render.toggle('publish');
            websocketclient.render.toggle('messages');
            websocketclient.render.toggle('sub');
        },

        'toggle': function (name) {
            $('.' + name + 'Arrow').toggleClass("closed");
            $('.' + name + 'Top').toggleClass("closed");
            var elem = $('#' + name + 'Main');
            elem.slideToggle();
        },

        'hide': function (name) {
            $('.' + name + 'Arrow').addClass("closed");
            $('.' + name + 'Top').addClass("closed");
            var elem = $('#' + name + 'Main');
            elem.slideUp();
        },

        'show': function (name) {
            $('.' + name + 'Arrow').removeClass("closed");
            $('.' + name + 'Top').removeClass("closed");
            var elem = $('#' + name + 'Main');
            elem.slideDown();
        },

        'removeSubscriptionsMessages': function (id) {
            websocketclient.messages = websocketclient.messages.filter(item => item.subscriptionId != id);
            websocketclient.render.messages();
        },

        'clearMessages': function () {
            $("#messEdit").empty();
        },

        'clearSubscriptions': function () {
            $("#innerEdit").empty();
        },

        'clearDashboard': function () {
            let iframe = document.getElementById("dashboardIframe");
            iframe.srcdoc = "";
        }
    },

    'generateUID': function () {
        var firstPart = (Math.random() * 46656) | 0;
        var secondPart = (Math.random() * 46656) | 0;
        firstPart = ("000" + firstPart.toString(36)).slice(-3);
        secondPart = ("000" + secondPart.toString(36)).slice(-3);
        return firstPart + secondPart;
    },

    'createDoughnutWidgetJS': function (name, color, unit, left, top, min, max, width, height) {
        return `
        doughnutWidget.chartname["${name}"] = {
            container: "chart_" + "${websocketclient.generateUID()}",
            width: ${parseInt(width)},
            height: ${parseInt(height)},
            left: ${parseInt(left)},
            top: ${parseInt(top)},
            cutout: 50,
            data: {
                val: 0,
                min: ${parseInt(min)},
                max: ${parseInt(max)},
                color: "#"+"${color}",
                unit: " "+"${unit}",
                decimal: 0,
                labelsize: 14,
                valuesize: 10,
            }
        };
        doughnutWidget.createChart("${name}");
        `
    },

    'createTemperatureGaugeJS': function (name, color, unit, left, top, min, max, width, height) {
        return `
        temperatureGauge({
            id: "${name}",
            name: "${name}",
            width: ${parseInt(width)},
            left: ${parseInt(left)},
            top: ${parseInt(top)},
            val: 0,
            min: ${parseInt(min)},
            max: ${parseInt(max)},
            fillColor: "#"+"${color}",
            borderWidth: 4,
            unit: " "+"${unit}",
            decimal: 0,
            showLabel: true,
            labelSize: 14,
        });
        `
    },

    'createWaterbubbleJS': function (name, color, unit, left, top, min, max, width, height) {
        return `
        waterbubble({
            id: "${name}",
            name: '水位',
            radius: 100,
            left: ${parseInt(left)},
            top: ${parseInt(top)},
            val: 0,
            min: ${parseInt(min)},
            max: ${parseInt(max)},
            unit: " "+"${unit}",
            decimal: 0,
            waterColor: "#"+"${color}",
            textColor: '#000000',
            lineWidth: 4,
            wave: true,
            animation: true,
            width: ${parseInt(width)},
            height: ${parseInt(height)},
        });
        `
    },

    'createSimpleGaugeJS': function (name, color, unit, left, top, min, max, width, height) {
        return `
        simpleGauge({
            id:  "${name}",
            value: 0,
            min: ${parseInt(min)},
            max: ${parseInt(max)},
            width: ${parseInt(width)},
            height: ${parseInt(height)},
            left: ${parseInt(left)},
            top: ${parseInt(top)},
            decimal: 0,
            unit: " "+"${unit}",
            template: [
                "<div class='simpleGauge_container'>",
                "<div class='simpleGauge'>",
                "<div class='simpleGauge_title'></div>",
                "<svg class='simpleGauge_bars simpleGauge_block' version='1.1' xmlns='http://www.w3.org/2000/svg'></svg>",
                "<div class='simpleGauge_labels simpleGauge_block'></div>",
                "<div class='simpleGauge_ticks simpleGauge_block'></div>",
                "<svg class='simpleGauge_pointers simpleGauge_block' version='1.1' xmlns='http://www.w3.org/2000/svg'></svg>",
                "<div class='simpleGauge_digital'></div>",
                "</div>",
                "</div>"
            ].join(""),
            type:   "analog digital",
            container: { scale: 90, style: {} },
            title: { text: name, style: {} },
            digital: { text: "{value.1}", style: { color: "auto" } },
            analog: { minAngle: -120, maxAngle: 120 },
            labels: { text: "{value}", count: 10, scale: 95, style: "" },
            ticks: { count: 10, scale1: 77, scale2: 83, style: "" },
            subTicks: { count: 0, scale1: 80, scale2: 83, style: "" },
            bars: { scale1: 75, scale2: 80, style: "", colors: [[0, "#"+"${color}", 0, 0]] },
            pointer: {
                scale: 85,
                shape: [
                    "-2,-10","2,-10","2.1,-5.3","4,-4","5.3,-2.1","5.7,0","5.3,2.1","4,4","2.1,5.3",
                    "2,50","1.5,96","0,100","-1,96","-2,50","-2.1,5.3","-4,4","-5.3,2.1","-5.7,0",
                    "-5.3,-2.1","-4,-4","-2.1,-5.3","-2,-10"
                ].join(" "),
                style: { color: "#8778", borderWidth: 0, borderColor: "#8778" }
            }
        });
        `
    },

    'createLineChartJS': function (name, color, unit, left, top, min, max, width, height) {
        return `
        var config = {
            id: '${name}',
            type: "line",
            data: {
                labels: [],
                datasets: [{ label: '${name}', data: [], borderColor: '#${color}', backgroundColor: '#000000' }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: "top" },
                    title: { display: true, text: '${name}圖表' }
                },
                scales: {
                    yAxes: { title: { display: true, text: '數值' }, ticks: { precision: 0 } },
                    xAxes: { title: { display: true, text: '時間' } }
                }
            },
            width: ${parseInt(width)},
            height: ${parseInt(height)},
            left: ${parseInt(left)},
            top: ${parseInt(top)},
            count: 20
        };
        linechart(config);
        `
    },

    'createBarChartJS': function (name, color, unit, left, top, min, max, width, height) {
        return `
        var config = {
            id: '${name}',
            type: "bar",
            data: {
                labels: [],
                datasets: [{ label: '${name}', data: [], borderColor: '#${color}', backgroundColor: '#${color}' }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: "top" },
                    title: { display: true, text: '${name}圖表' }
                },
                scales: {
                    yAxes: { title: { display: true, text: '數值' }, ticks: { precision: 0 } },
                    xAxes: { title: { display: true, text: '時間' } }
                }
            },
            width: ${parseInt(width)},
            height: ${parseInt(height)},
            left: ${parseInt(left)},
            top: ${parseInt(top)},
            count: 20
        };
        barchart(config);
        `
    },

    // 保留原本 binary 圖片邏輯（不更動）
    'createImageJS': function (name, color, unit, left, top, min, max, width, height) {
        return `
        function mqttBinarytobase64(input_array) {
            const content = new Uint8Array(input_array);
            return btoa(String.fromCharCode.apply(null, content));
        }
        image_create_stream('${name}','',${parseInt(left)},${parseInt(top)},999,true,${parseInt(width)},${parseInt(height)});
        `
    },

    // 新增：base64 圖片
    'createImagebase64JS': function (name, color, unit, left, top, min, max, width, height) {
        return `
        function mqttBase64ToDataUrl(b64text) {
            let s = (b64text || "").trim();
            if (/^data:image\\//i.test(s)) return s;
            s = s.replace(/\\s+/g, "");
            return "data:image/jpeg;base64," + s;
        }
        image_create_stream('${name}','',${parseInt(left)},${parseInt(top)},999,true,${parseInt(width)},${parseInt(height)});
        `
    },

    'createSimpleSwitchJS': function (name, color, unit, left, top, min, max, width, height, topic) {
        return `
        simpleSwitch({
            id: '${name}',
            width: 50,
            height: 20,
            left: ${parseInt(left)},
            top: ${parseInt(top)},
            text: '${name}',
            size: 14,
            color: '#${color}',
            val: 1,
            func: switch_${name}
        });

        function switch_${name}() {
            mqtt_client.publish('${topic}', String(($("#gamecheckbox_"+'${name}').is(":checked"))) === "true" ? "1" : "0");
        }
        `
    },

    'createTextBoxJS': function (name, color, unit, left, top, min, max, width, height) {
        return `
        ;(function() {
            document.body.style.position = 'relative';
            document.body.style.minHeight = '510px';
            document.body.style.margin = '0';
            document.body.style.background = '#ffffff';

            const widget = document.createElement('div');
            widget.id = 'text_box_${name}';
            widget.style.position = 'absolute';
            widget.style.left = '${parseInt(left)}px';
            widget.style.top = '${parseInt(top)}px';
            widget.style.width = '${parseInt(width)}px';
            widget.style.height = '${parseInt(height)}px';
            widget.style.boxSizing = 'border-box';
            widget.style.border = '2px solid #${color}';
            widget.style.borderRadius = '12px';
            widget.style.background = '#ffffff';
            widget.style.boxShadow = '0 6px 18px rgba(0, 0, 0, 0.08)';
            widget.style.padding = '12px';
            widget.style.display = 'flex';
            widget.style.flexDirection = 'column';
            widget.style.justifyContent = 'space-between';
            widget.style.overflow = 'hidden';
            widget.style.zIndex = '10';

            const title = document.createElement('div');
            title.textContent = '${name}';
            title.style.fontSize = '14px';
            title.style.fontWeight = '700';
            title.style.color = '#333333';
            title.style.marginBottom = '8px';

            const value = document.createElement('div');
            value.id = 'text_box_value_${name}';
            value.textContent = '--';
            value.dataset.unit = '${unit}';
            value.style.flex = '1';
            value.style.display = 'flex';
            value.style.alignItems = 'center';
            value.style.justifyContent = 'center';
            value.style.textAlign = 'center';
            value.style.fontSize = '30px';
            value.style.fontWeight = '700';
            value.style.color = '#111111';
            value.style.wordBreak = 'break-word';

            widget.appendChild(title);
            widget.appendChild(value);
            document.body.appendChild(widget);
        })();
        `;
    },

    'createDashboardHTML': function (charts) {
        const host = this._trim($('#urlInput').val()) || "mqttgo.io";
        const portRaw = parseInt($('#portInput').val(), 10);
        const port = Number.isFinite(portRaw) ? portRaw : 8084;
        const ssl = $('#sslInput').is(':checked');
        const protocol = ssl ? "wss" : "ws";
        const mqttUrl = `${protocol}://${host}:${port}/mqtt`;

        return `
        <!DOCTYPE html><html><head><meta charset='utf-8'><meta http-equiv='Access-Control-Allow-Origin' content='*'>
        <meta http-equiv='Access-Control-Allow-Credentials' content='true'>
        <script src='https://ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js'></script>
        <script src='https://riddleling.github.io/SpBlocklyJS/gameelements.js'></script>
        <script src='https://fustyles.github.io/webduino/SpBlocklyJS/MQTT_20220324/mqtt.min.js'></script>
        <script src='https://fustyles.github.io/webduino/SpBlocklyJS/chart_20220723/Chart.min.js'></script>
        <script src='https://fustyles.github.io/webduino/SpBlocklyJS/chart_20220723/pretty-doughtnut.js'></script>
        <script src='https://fustyles.github.io/webduino/SpBlocklyJS/chart_20220723/jquery.tempgauge.js'></script>
        <script src='https://fustyles.github.io/webduino/SpBlocklyJS/chart_20220723/jquery.simplegauge.js'></script>
        <script src='https://riddleling.github.io/SpBlocklyJS/waterbubble.js'></script>
        <script src='https://fustyles.github.io/webduino/SpBlocklyJS/chart_20220723/linechart.js'></script>
        <script src='https://fustyles.github.io/webduino/SpBlocklyJS/chart_20220723/barchart.js'></script>
        <script src='https://fustyles.github.io/webduino/SpBlocklyJS/chart_20220723/jquery.simpleswitch.js'></script>
        <link href='https://fustyles.github.io/webduino/SpBlocklyJS/chart_20220723/jquery.simplegauge.css' type='text/css' rel='stylesheet'>
        <link href='https://fustyles.github.io/webduino/SpBlocklyJS/chart_20220723/simpleswitch.css' type='text/css' rel='stylesheet'>
        </head><body style="margin:0; min-height:510px; position:relative; background:#ffffff;"><script>const delay=(seconds)=>{return new Promise((resolve)=>{setTimeout(resolve,seconds*1000);});};const main=async()=>{

        var newdate;
        const clientId = "mqtt_" + Math.random().toString(16).substr(2, 8);
        const options = {
            keepalive: 60,
            clientId: clientId,
            protocolId: "MQTT",
            protocolVersion: 4,
            clean: true,
            reconnectPeriod: 1000,
            connectTimeout: 30 * 1000
        }

        ${websocketclient.createWidgetsJS()}

        if (typeof mqtt === "undefined") {
            console.error("mqtt library not loaded");
            return;
        }

        var mqtt_client = mqtt.connect(${JSON.stringify(mqttUrl)}, options);
        mqtt_client.on("connect", ()=>{
            console.log("connected");
            ${websocketclient.createClientSubscribeJS()}
            mqtt_client.on("message", async function (topic, payload) {
                ${websocketclient.createClientOnJS(charts)}
            })
        })

        };main();</script></body></html>
        `
    },

    // 去重 topic，避免同 topic 多 widget 產生重複 subscribe
    'createClientSubscribeJS': function () {
        let topics = Array.from(new Set(websocketclient.infos.map(x => x.topic)));
        let str = "";
        for (let i = 0; i < topics.length; i++) {
            str += `mqtt_client.subscribe("${topics[i]}");\n`;
        }
        return str;
    },

    'createClientOnJS': function () {
        let str = "";
        let charts = websocketclient.infos;
        for (let i = 0; i < charts.length; i++) {
            let value = charts[i];
            let topic = value['topic'];
            let chartName = value['chartName'];
            let chartType = value['chartType'];
            str += `
                if (topic == "${topic}") {
                    ${websocketclient.createClientUpdateJS(chartName, chartType)}
                }
            `;
        }
        return str;
    },

    'createClientUpdateJS': function (chartName, chartType) {
        var str = "";
        if (chartType === "甜甜圈圖") {
            str = `doughnutWidget.updateData("${chartName}", (new TextDecoder().decode(payload)));`;
        } else if (chartType === "溫度圖") {
            str = `temperatureGauge({id: "${chartName}", val: (new TextDecoder().decode(payload))});`;
        } else if (chartType === "類比圖") {
            str = `simpleGauge({id: "${chartName}", value: (new TextDecoder().decode(payload))});`;
        } else if (chartType === "水位圖") {
            str = `waterbubble({id: "${chartName}", val: (new TextDecoder().decode(payload))});`;
        } else if (chartType === "折線圖") {
            str = `linechart({id: "${chartName}", data: [(getDatetime(newdate, "time")), new TextDecoder().decode(payload), new TextDecoder().decode(payload)]});`;
        } else if (chartType === "長條圖") {
            str = `barchart({id: "${chartName}", data: [(getDatetime(newdate, "time")), new TextDecoder().decode(payload), null]});`;
        } else if (chartType === "圖片") {
            str = `image_set('${chartName}',"url",("data:image/jpeg;base64,"+mqttBinarytobase64(payload)));`;
        } else if (chartType === "圖片(base64)") {
            str = `image_set('${chartName}',"url",mqttBase64ToDataUrl(new TextDecoder().decode(payload)));`;
        } else if (chartType === "文字方塊") {
            str = `
            (function() {
                const elem = document.getElementById('text_box_value_${chartName}');
                if (!elem) return;
                const value = new TextDecoder().decode(payload);
                const unit = elem.dataset.unit || '';
                elem.textContent = value.length ? (unit.length ? (value + ' ' + unit) : value) : '--';
            })();
            `;
        } else if (chartType === "滑動開關") {
            str = `
            if ((new TextDecoder().decode(payload)) == '1') {
                simpleSwitch({id: '${chartName}',val: 1});
            }
            if ((new TextDecoder().decode(payload)) == '0') {
                simpleSwitch({id: '${chartName}',val: 0});
            }
            `;
        }
        return str;
    },

    'createWidgetsJS': function () {
        var str = "";
        let charts = websocketclient.infos;

        let line = 0;
        let col = 0;
        let x_offset = 230;
        let y_offset = 260;
        let left = 0;
        let top = 0;

        for (let i = 0; i < charts.length; i++) {
            let value = charts[i];
            let topic = value['topic'];
            let name = value['chartName'];
            let type = value['chartType'];
            let color = value['color'];
            let unit = value['unit'];
            let min = value['min'];
            let max = value['max'];
            let width = value['width'];
            let height = value['height'];
            let sizeUnit = value['sizeUnit'];

            left = col * x_offset;
            col += sizeUnit;

            let s = "";
            if (type === "甜甜圈圖") {
                s = websocketclient.createDoughnutWidgetJS(name, color, unit, left, top, min, max, width, height);
            } else if (type === "溫度圖") {
                s = websocketclient.createTemperatureGaugeJS(name, color, unit, left + 45, top, min, max, width, height);
            } else if (type === "類比圖") {
                s = websocketclient.createSimpleGaugeJS(name, color, unit, left, top, min, max, width, height);
            } else if (type === "水位圖") {
                s = websocketclient.createWaterbubbleJS(name, color, unit, left + 10, top + 10, min, max, width, height);
            } else if (type === "折線圖") {
                s = websocketclient.createLineChartJS(name, color, unit, left, top, min, max, width, height);
            } else if (type === "長條圖") {
                s = websocketclient.createBarChartJS(name, color, unit, left, top, min, max, width, height);
            } else if (type === "圖片") {
                s = websocketclient.createImageJS(name, color, unit, left, top, min, max, width, height);
            } else if (type === "圖片(base64)") {
                s = websocketclient.createImagebase64JS(name, color, unit, left, top, min, max, width, height);
            } else if (type === "文字方塊") {
                s = websocketclient.createTextBoxJS(name, color, unit, left, top, min, max, width, height);
            } else if (type === "滑動開關") {
                let l_v = parseInt(left);
                let t_v = parseInt(top);
                if (col === 1) l_v = 30;
                else if (col > 1) l_v -= (100 * (col - 1));

                if (line === 0) t_v = 45;
                else if (line > 0) t_v -= (100 * line);

                s = websocketclient.createSimpleSwitchJS(name, color, unit, l_v, t_v, min, max, width, height, topic);
            }

            str += s;

            if (col >= 4) {
                line += 1;
                col = 0;
                left = 0;
                top += y_offset;
            }
        }
        return str;
    },

    'renderDashboard': function () {
        let charts = websocketclient.infos;
        let html = websocketclient.createDashboardHTML(charts);

        let iframe = document.getElementById("dashboardIframe");
        iframe.srcdoc = html;
    },

    'downloadDashboard': function () {
        let charts = websocketclient.infos;
        let html = websocketclient.createDashboardHTML(charts);
        var bb = new Blob([html], { type: 'text/plain' });
        var a = document.createElement('a');
        a.download = 'Dashboard.html';
        a.href = window.URL.createObjectURL(bb);
        a.click();
    },

    'settingMaps': function (latitude, longitude) {
        let lat = String(latitude).trim();
        let long = String(longitude).trim();
        let url = `https://maps.google.com/?q=${lat},${long}&output=embed`
        $('#mapsIframe').attr('src', url);
    },

    'chartInputOnChange': function () {
        let type = $('#chartInput').find(":selected").val();
        console.log(type)

        if (type === "甜甜圈圖") {
            $('#chartValueSize').val("200,200");
        } else if (type === "溫度圖") {
            $('#chartValueSize').val("100,100");
        } else if (type === "類比圖") {
            $('#chartValueSize').val("200,200");
        } else if (type === "水位圖") {
            $('#chartValueSize').val("0,0");
        } else if (type === "折線圖") {
            $('#chartValueSize').val("400,200");
        } else if (type === "長條圖") {
            $('#chartValueSize').val("400,200");
        } else if (type === "圖片") {
            $('#chartName').val("01");
            $('#chartValueSize').val("0,0");
        } else if (type === "圖片(base64)") {
            $('#chartName').val("01");
            $('#chartValueSize').val("0,0");
        } else if (type === "文字方塊") {
            $('#chartName').val("文字");
            $('#chartValueSize').val("0,0");
        } else if (type === "滑動開關") {
            $('#chartName').val("btn");
            $('#chartValueSize').val("0,0");
        } else {
            $('#chartValueSize').val("0,0");
        }

        if (type === "無") {
            $('#chartName').attr('disabled', 'disabled');
            $('#chartValueRange').attr('disabled', 'disabled');
            $('#chartValueUnit').attr('disabled', 'disabled');
        } else if (type === "文字方塊") {
            $('#chartName').removeAttr('disabled');
            $('#chartValueRange').attr('disabled', 'disabled');
            $('#chartValueUnit').removeAttr('disabled');
        } else if (type === "圖片" || type === "圖片(base64)" || type === "滑動開關") {
            $('#chartName').removeAttr('disabled');
            $('#chartValueRange').attr('disabled', 'disabled');
            $('#chartValueUnit').attr('disabled', 'disabled');
        } else {
            $('#chartName').removeAttr('disabled');
            $('#chartValueRange').removeAttr('disabled');
            $('#chartValueUnit').removeAttr('disabled');
        }
    }
};

websocketclient.prefill();
